import type { PlatformAdapter, NormalizedSnapshot, NormalizedPost } from './types';

/**
 * X (Twitter) API v2 — OAuth 2.0 + PKCE.
 *
 * The free tier is heavily rate-limited and excludes most analytics.
 * Basic ($100/mo) gives us user metrics + recent tweets.
 *
 * Scopes: tweet.read users.read offline.access
 */
const AUTH = 'https://twitter.com/i/oauth2/authorize';
const TOKEN = 'https://api.twitter.com/2/oauth2/token';
const API = 'https://api.twitter.com/2';

const SCOPES = ['tweet.read', 'users.read', 'offline.access'];

async function xFetch<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store'
  });
  if (!res.ok) throw new Error(`x ${path} ${res.status}`);
  return (await res.json()) as T;
}

export const x: PlatformAdapter = {
  kind: 'x',

  authorizeUrl({ state, redirectUri, pkceChallenge }) {
    const u = new URL(AUTH);
    u.searchParams.set('response_type', 'code');
    u.searchParams.set('client_id', process.env.X_CLIENT_ID!);
    u.searchParams.set('redirect_uri', redirectUri);
    u.searchParams.set('scope', SCOPES.join(' '));
    u.searchParams.set('state', state);
    u.searchParams.set('code_challenge', pkceChallenge || 'challenge');
    u.searchParams.set('code_challenge_method', 'S256');
    return u.toString();
  },

  async exchangeCode({ code, pkceVerifier, redirectUri }) {
    const basic = Buffer.from(
      `${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`
    ).toString('base64');
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: pkceVerifier || '',
      client_id: process.env.X_CLIENT_ID!
    });
    const res = await fetch(TOKEN, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body
    });
    if (!res.ok) throw new Error(`x token ${res.status}`);
    const j = await res.json();
    const me = await xFetch<{
      data: {
        id: string;
        username: string;
        name: string;
        public_metrics: { followers_count: number; following_count: number; tweet_count: number };
      };
    }>(j.access_token, '/users/me?user.fields=public_metrics');
    return {
      accessToken: j.access_token,
      refreshToken: j.refresh_token,
      expiresAt: new Date(Date.now() + j.expires_in * 1000).toISOString(),
      scope: j.scope,
      externalId: me.data.id,
      handle: `@${me.data.username}`,
      profileUrl: `https://x.com/${me.data.username}`
    };
  },

  /**
   * Refresh an X OAuth 2.0 access token. CRITICAL: X rotates the refresh
   * token on every call — the old one is invalidated the instant the new one
   * is generated. The caller (`lib/token-manager.ts`) must persist the new
   * `refreshToken` before doing anything else.
   *
   * `client_id` is required in the body even when using Basic auth (X's quirk
   * vs. the OAuth 2.0 spec).
   */
  async refresh({ refreshToken }) {
    const basic = Buffer.from(
      `${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`
    ).toString('base64');
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.X_CLIENT_ID!
    });
    const res = await fetch(TOKEN, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body,
      cache: 'no-store'
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`x refresh ${res.status} ${text}`);
    }
    const j = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };
    return {
      accessToken: j.access_token,
      refreshToken: j.refresh_token,
      expiresAt: new Date(Date.now() + j.expires_in * 1000).toISOString()
    };
  },

  async pullSnapshot({ accessToken, externalId, topN = 5 }) {
    const out: NormalizedSnapshot = {
      platform: 'x',
      capturedAt: new Date().toISOString(),
      topPosts: [],
      raw: {}
    };
    const me = await xFetch<{
      data: {
        id: string;
        username: string;
        public_metrics: { followers_count: number; tweet_count: number };
      };
    }>(accessToken, `/users/me?user.fields=public_metrics`);
    out.followers = me.data.public_metrics.followers_count;
    out.episodes = me.data.public_metrics.tweet_count;
    out.handle = `@${me.data.username}`;
    out.profileUrl = `https://x.com/${me.data.username}`;

    const tweets = await xFetch<{
      data: Array<{
        id: string;
        text: string;
        created_at: string;
        public_metrics: {
          retweet_count: number;
          reply_count: number;
          like_count: number;
          quote_count: number;
          impression_count?: number;
        };
      }>;
    }>(
      accessToken,
      `/users/${externalId || me.data.id}/tweets?max_results=20&tweet.fields=public_metrics,created_at`
    ).catch(() => ({ data: [] }));

    out.topPosts = (tweets.data || [])
      .map<NormalizedPost>((t) => ({
        externalId: t.id,
        title: t.text.slice(0, 80),
        permalink: `https://x.com/${me.data.username}/status/${t.id}`,
        postedAt: t.created_at,
        impressions: t.public_metrics.impression_count,
        likes: t.public_metrics.like_count,
        comments: t.public_metrics.reply_count,
        shares: t.public_metrics.retweet_count
      }))
      .sort((a, b) => (b.impressions || b.likes || 0) - (a.impressions || a.likes || 0))
      .slice(0, topN);

    out.impressions = (tweets.data || []).reduce(
      (s, t) => s + (t.public_metrics.impression_count || 0),
      0
    );
    out.likes = (tweets.data || []).reduce((s, t) => s + t.public_metrics.like_count, 0);

    out.raw = { me, tweets: tweets.data };
    return out;
  }
};
