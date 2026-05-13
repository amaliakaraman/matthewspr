import type { PlatformAdapter, NormalizedSnapshot, NormalizedPost } from './types';

/**
 * Spotify Web API adapter.
 *
 * Two modes:
 *  • Artist/show-profile read (public Web API) — followers + popularity.
 *  • Spotify for Podcasters analytics — currently no public API. We pull what
 *    we can via the Web API and supplement with manual entry / CSV.
 *
 * Scopes:
 *  • user-read-private  — current user's profile
 *  • user-follow-read   — artists I follow (useful for verifying account)
 *  • user-read-email
 */
const AUTH = 'https://accounts.spotify.com/authorize';
const TOKEN = 'https://accounts.spotify.com/api/token';
const API = 'https://api.spotify.com/v1';

const SCOPES = ['user-read-private', 'user-read-email', 'user-follow-read'];

async function spFetch<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store'
  });
  if (!res.ok) throw new Error(`spotify ${path} ${res.status}`);
  return (await res.json()) as T;
}

export const spotify: PlatformAdapter = {
  kind: 'spotify',

  authorizeUrl({ state, redirectUri }) {
    const u = new URL(AUTH);
    u.searchParams.set('client_id', process.env.SPOTIFY_CLIENT_ID!);
    u.searchParams.set('response_type', 'code');
    u.searchParams.set('redirect_uri', redirectUri);
    u.searchParams.set('scope', SCOPES.join(' '));
    u.searchParams.set('state', state);
    return u.toString();
  },

  async exchangeCode({ code, redirectUri }) {
    const basic = Buffer.from(
      `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
    ).toString('base64');
    const res = await fetch(TOKEN, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri
      })
    });
    if (!res.ok) throw new Error(`spotify token ${res.status}`);
    const j = (await res.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      scope: string;
    };
    const me = await spFetch<{ id: string; display_name: string; external_urls: { spotify: string } }>(
      j.access_token,
      '/me'
    );
    return {
      accessToken: j.access_token,
      refreshToken: j.refresh_token,
      expiresAt: new Date(Date.now() + j.expires_in * 1000).toISOString(),
      scope: j.scope,
      externalId: me.id,
      handle: me.display_name,
      profileUrl: me.external_urls.spotify
    };
  },

  async refresh({ refreshToken }) {
    const basic = Buffer.from(
      `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
    ).toString('base64');
    const res = await fetch(TOKEN, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    });
    if (!res.ok) throw new Error(`spotify refresh ${res.status}`);
    const j = await res.json();
    return {
      accessToken: j.access_token,
      refreshToken: j.refresh_token ?? refreshToken,
      expiresAt: new Date(Date.now() + j.expires_in * 1000).toISOString()
    };
  },

  /**
   * `externalId` here is the authenticated user's Spotify ID (saved at OAuth
   * exchange). The **show** ID for the podcast is stored separately on
   * `platform_connections.meta.show_id` (set via the Settings → Spotify form
   * after connecting). Without it, this adapter no-ops cleanly.
   */
  async pullSnapshot({ accessToken, topN = 5, meta }) {
    const showId =
      meta && typeof (meta as Record<string, unknown>).show_id === 'string'
        ? ((meta as Record<string, unknown>).show_id as string)
        : undefined;
    const result: NormalizedSnapshot = {
      platform: 'spotify',
      capturedAt: new Date().toISOString(),
      topPosts: [],
      raw: {}
    };
    if (!showId) return result;

    try {
      const show = await spFetch<{
        name: string;
        publisher: string;
        total_episodes: number;
        external_urls: { spotify: string };
      }>(accessToken, `/shows/${showId}?market=US`);
      result.handle = show.name;
      result.profileUrl = show.external_urls.spotify;
      result.episodes = show.total_episodes;
      result.raw = { show };

      const eps = await spFetch<{
        items: Array<{
          id: string;
          name: string;
          release_date: string;
          external_urls: { spotify: string };
          images: Array<{ url: string }>;
        }>;
      }>(accessToken, `/shows/${showId}/episodes?limit=${topN}&market=US`);

      const top: NormalizedPost[] = eps.items.map((e) => ({
        externalId: e.id,
        title: e.name,
        permalink: e.external_urls.spotify,
        postedAt: e.release_date,
        thumbUrl: e.images?.[0]?.url
      }));
      result.topPosts = top;
    } catch (e) {
      // Show-level analytics aren't always returned — caller can fall back.
      console.warn('spotify pull warning', e);
    }
    return result;
  }
};
