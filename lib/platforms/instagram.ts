import type { PlatformAdapter, NormalizedSnapshot, NormalizedPost } from './types';

/**
 * Instagram Graph API (Business/Creator accounts only).
 *
 * Flow:
 *  1) User authorizes via Facebook Login → returns access token.
 *  2) Find the Page → find IG Business Account ID.
 *  3) Query `/{ig-user-id}/insights` for account metrics and
 *     `/{ig-user-id}/media` for top posts.
 *
 * Scopes (Facebook permissions):
 *  - instagram_basic
 *  - instagram_manage_insights
 *  - pages_show_list
 *  - pages_read_engagement
 */
const AUTH = 'https://www.facebook.com/v21.0/dialog/oauth';
const TOKEN = 'https://graph.facebook.com/v21.0/oauth/access_token';
const API = 'https://graph.facebook.com/v21.0';

const SCOPES = [
  'instagram_basic',
  'instagram_manage_insights',
  'pages_show_list',
  'pages_read_engagement'
];

async function igFetch<T>(token: string, path: string): Promise<T> {
  const url = `${API}${path}${path.includes('?') ? '&' : '?'}access_token=${token}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`instagram ${path} ${res.status}`);
  return (await res.json()) as T;
}

export const instagram: PlatformAdapter = {
  kind: 'instagram',

  authorizeUrl({ state, redirectUri }) {
    const u = new URL(AUTH);
    u.searchParams.set('client_id', process.env.INSTAGRAM_CLIENT_ID!);
    u.searchParams.set('redirect_uri', redirectUri);
    u.searchParams.set('response_type', 'code');
    u.searchParams.set('scope', SCOPES.join(','));
    u.searchParams.set('state', state);
    return u.toString();
  },

  async exchangeCode({ code, redirectUri }) {
    const u = new URL(TOKEN);
    u.searchParams.set('client_id', process.env.INSTAGRAM_CLIENT_ID!);
    u.searchParams.set('client_secret', process.env.INSTAGRAM_CLIENT_SECRET!);
    u.searchParams.set('redirect_uri', redirectUri);
    u.searchParams.set('code', code);
    const res = await fetch(u.toString(), { cache: 'no-store' });
    if (!res.ok) throw new Error(`instagram token ${res.status}`);
    const j = await res.json();
    const accessToken = j.access_token as string;

    // Exchange the short-lived user token for a long-lived (~60d) one. This
    // is what we'll need to re-extend going forward (and what `refresh()`
    // expects to receive via `refresh_token_enc`).
    let userLongLived = accessToken;
    let userExpiresInSec: number | undefined = j.expires_in;
    try {
      const ll = new URL(TOKEN);
      ll.searchParams.set('grant_type', 'fb_exchange_token');
      ll.searchParams.set('client_id', process.env.INSTAGRAM_CLIENT_ID!);
      ll.searchParams.set('client_secret', process.env.INSTAGRAM_CLIENT_SECRET!);
      ll.searchParams.set('fb_exchange_token', accessToken);
      const llRes = await fetch(ll.toString(), { cache: 'no-store' });
      if (llRes.ok) {
        const llJ = await llRes.json();
        userLongLived = llJ.access_token || accessToken;
        userExpiresInSec = llJ.expires_in ?? userExpiresInSec;
      }
    } catch {
      /* fall back to the short-lived token; refresh() will still upgrade it */
    }

    // Find the IG business account by walking the user's pages. Page tokens
    // derived from a long-lived user token are themselves long-lived and are
    // what we actually use for `/insights` calls.
    const pages = await igFetch<{
      data: Array<{ id: string; name: string; access_token: string }>;
    }>(userLongLived, '/me/accounts');
    let externalId: string | undefined;
    let handle: string | undefined;
    let pageToken = userLongLived;
    for (const p of pages.data) {
      try {
        const ig = await igFetch<{ instagram_business_account?: { id: string; username: string } }>(
          p.access_token,
          `/${p.id}?fields=instagram_business_account{id,username}`
        );
        if (ig.instagram_business_account) {
          externalId = ig.instagram_business_account.id;
          handle = ig.instagram_business_account.username;
          pageToken = p.access_token;
          break;
        }
      } catch {}
    }

    return {
      accessToken: pageToken,
      // Instagram has no separate refresh token; the long-lived USER token
      // doubles as its own re-extension input via `fb_exchange_token`. We
      // persist it in `refresh_token_enc` so `getValidAccessToken` has
      // something to call `refresh()` with within the 14-day pre-expiry lead.
      refreshToken: userLongLived,
      expiresAt: userExpiresInSec
        ? new Date(Date.now() + userExpiresInSec * 1000).toISOString()
        : undefined,
      externalId,
      handle: handle ? `@${handle}` : undefined,
      profileUrl: handle ? `https://instagram.com/${handle}` : undefined
    };
  },

  async pullSnapshot({ accessToken, externalId, topN = 6, since }) {
    const out: NormalizedSnapshot = {
      platform: 'instagram',
      capturedAt: new Date().toISOString(),
      topPosts: [],
      raw: {}
    };
    if (!externalId) return out;

    // Restrict the per-snapshot aggregates to the same window the
    // account-level `reach`/`profile_views` numbers use (the API's 28-day
    // rolling window). Otherwise the per-snapshot `views`/`likes` are sums
    // over an arbitrarily large bag of posts that span multiple periods.
    const sinceMs = since
      ? Date.parse(since)
      : Date.now() - 28 * 24 * 60 * 60 * 1000;

    const profile = await igFetch<{
      followers_count: number;
      media_count: number;
      username: string;
    }>(accessToken, `/${externalId}?fields=followers_count,media_count,username`);
    out.followers = profile.followers_count;
    out.handle = `@${profile.username}`;
    out.profileUrl = `https://instagram.com/${profile.username}`;

    const insights = await igFetch<{
      data: Array<{ name: string; values: Array<{ value: number }> }>;
    }>(
      accessToken,
      `/${externalId}/insights?metric=reach,profile_views&period=days_28`
    ).catch(() => ({ data: [] }));
    for (const m of insights.data) {
      if (m.name === 'reach') out.impressions = m.values?.[0]?.value;
      if (m.name === 'profile_views') out.profileVisits = m.values?.[0]?.value;
    }

    const media = await igFetch<{
      data: Array<{
        id: string;
        caption?: string;
        media_url?: string;
        permalink: string;
        thumbnail_url?: string;
        timestamp: string;
        media_type: string;
        like_count?: number;
        comments_count?: number;
      }>;
    }>(
      accessToken,
      `/${externalId}/media?fields=id,caption,media_url,permalink,thumbnail_url,timestamp,media_type,like_count,comments_count&limit=30`
    );

    // For each, pull insights (views, plays, saves)
    const enriched: NormalizedPost[] = [];
    for (const m of media.data.slice(0, 30)) {
      let views = 0,
        saves = 0,
        shares = 0;
      try {
        const ins = await igFetch<{
          data: Array<{ name: string; values: Array<{ value: number }> }>;
        }>(accessToken, `/${m.id}/insights?metric=plays,saved,shares,reach`);
        for (const x of ins.data) {
          if (x.name === 'plays' || x.name === 'reach') views = Math.max(views, x.values?.[0]?.value || 0);
          if (x.name === 'saved') saves = x.values?.[0]?.value || 0;
          if (x.name === 'shares') shares = x.values?.[0]?.value || 0;
        }
      } catch {}
      enriched.push({
        externalId: m.id,
        permalink: m.permalink,
        caption: m.caption,
        title: (m.caption || '').slice(0, 80),
        mediaUrl: m.media_url,
        thumbUrl: m.thumbnail_url || m.media_url,
        postedAt: m.timestamp,
        likes: m.like_count,
        comments: m.comments_count,
        views,
        saves,
        shares
      });
    }
    const inWindow = enriched.filter((p) => {
      const t = p.postedAt ? Date.parse(p.postedAt) : NaN;
      return Number.isFinite(t) ? t >= sinceMs : true;
    });

    out.topPosts = inWindow
      .sort((a, b) => (b.views || b.likes || 0) - (a.views || a.likes || 0))
      .slice(0, topN);
    out.likes = inWindow.reduce((s, p) => s + (p.likes || 0), 0);
    out.views = inWindow.reduce((s, p) => s + (p.views || 0), 0);

    out.raw = { profile, insights, media: media.data };
    return out;
  },

  /**
   * "Refresh" for Instagram is really a re-extension. The input
   * (`refreshToken`) is the previously-issued long-lived USER token. We pass
   * it back to `fb_exchange_token` to reset its 60-day clock, then re-derive
   * the long-lived PAGE token from `/me/accounts` (the page token is what's
   * actually used for `/insights` calls).
   *
   * Called by `lib/token-manager.ts` within 14 days of expiry.
   */
  async refresh({ refreshToken }) {
    const u = new URL(TOKEN);
    u.searchParams.set('grant_type', 'fb_exchange_token');
    u.searchParams.set('client_id', process.env.INSTAGRAM_CLIENT_ID!);
    u.searchParams.set('client_secret', process.env.INSTAGRAM_CLIENT_SECRET!);
    u.searchParams.set('fb_exchange_token', refreshToken);
    const res = await fetch(u.toString(), { cache: 'no-store' });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`instagram refresh ${res.status} ${text}`);
    }
    const j = (await res.json()) as { access_token: string; expires_in?: number };
    const userLongLived = j.access_token;

    let pageToken = userLongLived;
    try {
      const pages = await igFetch<{
        data: Array<{ id: string; access_token: string; instagram_business_account?: { id: string } }>;
      }>(userLongLived, '/me/accounts?fields=id,access_token,instagram_business_account');
      const withIg = pages.data.find((p) => p.instagram_business_account);
      if (withIg) pageToken = withIg.access_token;
    } catch {
      /* fall back to the user token; pull will surface any auth issue */
    }

    return {
      accessToken: pageToken,
      refreshToken: userLongLived,
      expiresAt: j.expires_in
        ? new Date(Date.now() + j.expires_in * 1000).toISOString()
        : undefined
    };
  }
};
