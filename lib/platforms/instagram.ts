import type { PlatformAdapter, NormalizedSnapshot, NormalizedPost } from './types';

/**
 * Instagram API with Instagram Login (the 2024+ flow).
 *
 * This replaces the older Facebook-Login-mediated Instagram Graph API. The
 * new flow:
 *   1) User authorizes directly via instagram.com/oauth/authorize
 *   2) Code exchanges at api.instagram.com/oauth/access_token → short-lived
 *      user token (1h)
 *   3) Exchange short-lived → long-lived (~60d) at
 *      graph.instagram.com/access_token?grant_type=ig_exchange_token
 *   4) All data calls hit graph.instagram.com (NOT graph.facebook.com)
 *   5) Refresh extends the long-lived token by another 60d via
 *      graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token
 *
 * Requirements:
 *  - Instagram account must be Business or Creator (not Personal)
 *  - For Dev mode access, the account must be an Instagram Tester on the
 *    Meta app (App Roles → Instagram Testers → accepted invite)
 */

const AUTH = 'https://www.instagram.com/oauth/authorize';
const TOKEN = 'https://api.instagram.com/oauth/access_token';
const API = 'https://graph.instagram.com';

const SCOPES = [
  'instagram_business_basic',
  'instagram_business_manage_insights'
];

async function ig<T>(token: string, path: string): Promise<T> {
  const url = `${API}${path}${path.includes('?') ? '&' : '?'}access_token=${token}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`instagram ${path} ${res.status} ${text.slice(0, 200)}`);
  }
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
    // 1) Short-lived token (1h).
    const body = new URLSearchParams({
      client_id: process.env.INSTAGRAM_CLIENT_ID!,
      client_secret: process.env.INSTAGRAM_CLIENT_SECRET!,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code
    });
    const shortRes = await fetch(TOKEN, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body
    });
    if (!shortRes.ok) {
      const text = await shortRes.text().catch(() => '');
      throw new Error(`instagram token ${shortRes.status} ${text}`);
    }
    const shortJson = (await shortRes.json()) as {
      access_token: string;
      user_id: number | string;
    };

    // 2) Long-lived exchange (~60 days).
    const llUrl = new URL(`${API}/access_token`);
    llUrl.searchParams.set('grant_type', 'ig_exchange_token');
    llUrl.searchParams.set('client_secret', process.env.INSTAGRAM_CLIENT_SECRET!);
    llUrl.searchParams.set('access_token', shortJson.access_token);
    const llRes = await fetch(llUrl.toString(), { cache: 'no-store' });
    if (!llRes.ok) {
      const text = await llRes.text().catch(() => '');
      throw new Error(`instagram ig_exchange_token ${llRes.status} ${text}`);
    }
    const ll = (await llRes.json()) as {
      access_token: string;
      token_type?: string;
      expires_in?: number;
    };

    const externalId = String(shortJson.user_id);

    // Profile lookup for handle.
    let handle: string | undefined;
    try {
      const profile = await ig<{ username: string }>(
        ll.access_token,
        `/${externalId}?fields=username`
      );
      handle = profile.username;
    } catch {
      /* not fatal; we already have the user_id */
    }

    return {
      accessToken: ll.access_token,
      // No separate refresh token in this flow — we re-extend the access
      // token itself. Store it as both so `lib/token-manager.ts` can call
      // `refresh({ refreshToken })` and get an extension.
      refreshToken: ll.access_token,
      expiresAt: ll.expires_in
        ? new Date(Date.now() + ll.expires_in * 1000).toISOString()
        : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
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

    // Constrain post aggregates to the IG account-insights window (28d
    // rolling) so per-snapshot views/likes match `reach`/`profile_views`.
    const sinceMs = since
      ? Date.parse(since)
      : Date.now() - 28 * 24 * 60 * 60 * 1000;

    const profile = await ig<{
      followers_count: number;
      media_count: number;
      username: string;
    }>(
      accessToken,
      `/${externalId}?fields=followers_count,media_count,username`
    );
    out.followers = profile.followers_count;
    out.handle = `@${profile.username}`;
    out.profileUrl = `https://instagram.com/${profile.username}`;

    // Account-level insights — newer API requires `metric_type=total_value`.
    const insights = await ig<{
      data: Array<{
        name: string;
        total_value?: { value: number };
        values?: Array<{ value: number }>;
      }>;
    }>(
      accessToken,
      `/${externalId}/insights?metric=reach,profile_views&period=days_28&metric_type=total_value`
    ).catch(() => ({ data: [] }));
    for (const m of insights.data) {
      const v =
        m.total_value?.value ??
        m.values?.reduce((s, x) => s + (x.value || 0), 0);
      if (v == null) continue;
      if (m.name === 'reach') out.impressions = v;
      if (m.name === 'profile_views') out.profileVisits = v;
    }

    const media = await ig<{
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

    const enriched: NormalizedPost[] = [];
    for (const m of media.data) {
      let views = 0;
      let saves = 0;
      let shares = 0;
      try {
        const ins = await ig<{
          data: Array<{
            name: string;
            total_value?: { value: number };
            values?: Array<{ value: number }>;
          }>;
        }>(
          accessToken,
          `/${m.id}/insights?metric=views,saved,shares,reach&metric_type=total_value`
        );
        for (const x of ins.data) {
          const v =
            x.total_value?.value ??
            x.values?.reduce((s, y) => s + (y.value || 0), 0) ??
            0;
          if (x.name === 'views' || x.name === 'reach') views = Math.max(views, v);
          if (x.name === 'saved') saves = v;
          if (x.name === 'shares') shares = v;
        }
      } catch {
        /* per-post insights occasionally 404 on very fresh posts */
      }
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
   * Re-extend the long-lived token. The IG Login flow doesn't issue a
   * separate refresh token — the access token IS the refresh material. We
   * call `/refresh_access_token` to bump the expiry forward by ~60 days.
   *
   * Called by `lib/token-manager.ts` within 14 days of expiry.
   */
  async refresh({ refreshToken }) {
    const u = new URL(`${API}/refresh_access_token`);
    u.searchParams.set('grant_type', 'ig_refresh_token');
    u.searchParams.set('access_token', refreshToken);
    const res = await fetch(u.toString(), { cache: 'no-store' });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`instagram refresh ${res.status} ${text}`);
    }
    const j = (await res.json()) as {
      access_token: string;
      token_type?: string;
      expires_in?: number;
    };
    return {
      accessToken: j.access_token,
      refreshToken: j.access_token,
      expiresAt: j.expires_in
        ? new Date(Date.now() + j.expires_in * 1000).toISOString()
        : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()
    };
  }
};
