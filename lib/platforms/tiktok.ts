import type { PlatformAdapter, NormalizedSnapshot, NormalizedPost } from './types';

/**
 * TikTok Login Kit + Display API.
 * Scopes: user.info.basic, user.info.profile, user.info.stats, video.list
 * Docs: https://developers.tiktok.com/doc/login-kit-web/
 */
const AUTH = 'https://www.tiktok.com/v2/auth/authorize';
const TOKEN = 'https://open.tiktokapis.com/v2/oauth/token/';
const API = 'https://open.tiktokapis.com/v2';

const SCOPES = ['user.info.basic', 'user.info.profile', 'user.info.stats', 'video.list'];

async function ttFetch<T>(token: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store'
  });
  if (!res.ok) throw new Error(`tiktok ${path} ${res.status}`);
  return (await res.json()) as T;
}

export const tiktok: PlatformAdapter = {
  kind: 'tiktok',

  authorizeUrl({ state, redirectUri, pkceChallenge }) {
    const u = new URL(AUTH);
    u.searchParams.set('client_key', process.env.TIKTOK_CLIENT_KEY!);
    u.searchParams.set('redirect_uri', redirectUri);
    u.searchParams.set('response_type', 'code');
    u.searchParams.set('scope', SCOPES.join(','));
    u.searchParams.set('state', state);
    if (pkceChallenge) {
      u.searchParams.set('code_challenge', pkceChallenge);
      u.searchParams.set('code_challenge_method', 'S256');
    }
    return u.toString();
  },

  async exchangeCode({ code, pkceVerifier, redirectUri }) {
    const body = new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri
    });
    if (pkceVerifier) body.set('code_verifier', pkceVerifier);
    const res = await fetch(TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    if (!res.ok) throw new Error(`tiktok token ${res.status}`);
    const j = await res.json();
    const me = await ttFetch<{
      data: { user: { open_id: string; union_id: string; display_name: string; username: string } };
    }>(j.access_token, '/user/info/?fields=open_id,union_id,display_name,username');
    return {
      accessToken: j.access_token,
      refreshToken: j.refresh_token,
      expiresAt: new Date(Date.now() + j.expires_in * 1000).toISOString(),
      scope: j.scope,
      externalId: me.data.user.open_id,
      handle: me.data.user.username ? `@${me.data.user.username}` : me.data.user.display_name,
      profileUrl: me.data.user.username ? `https://tiktok.com/@${me.data.user.username}` : undefined
    };
  },

  async refresh({ refreshToken }) {
    const res = await fetch(TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY!,
        client_secret: process.env.TIKTOK_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    });
    if (!res.ok) throw new Error(`tiktok refresh ${res.status}`);
    const j = await res.json();
    return {
      accessToken: j.access_token,
      refreshToken: j.refresh_token,
      expiresAt: new Date(Date.now() + j.expires_in * 1000).toISOString()
    };
  },

  async pullSnapshot({ accessToken, topN = 6 }) {
    const out: NormalizedSnapshot = {
      platform: 'tiktok',
      capturedAt: new Date().toISOString(),
      topPosts: [],
      raw: {}
    };
    const me = await ttFetch<{
      data: {
        user: {
          open_id: string;
          username: string;
          display_name: string;
          follower_count: number;
          following_count: number;
          likes_count: number;
          video_count: number;
        };
      };
    }>(
      accessToken,
      '/user/info/?fields=open_id,username,display_name,follower_count,following_count,likes_count,video_count'
    );
    out.followers = me.data.user.follower_count;
    out.likes = me.data.user.likes_count;
    out.episodes = me.data.user.video_count;
    out.handle = `@${me.data.user.username}`;
    out.profileUrl = `https://tiktok.com/@${me.data.user.username}`;

    const vids = await ttFetch<{
      data: {
        videos: Array<{
          id: string;
          title?: string;
          create_time: number;
          cover_image_url: string;
          share_url: string;
          view_count: number;
          like_count: number;
          comment_count: number;
          share_count: number;
          duration: number;
        }>;
      };
    }>(
      accessToken,
      '/video/list/?fields=id,title,create_time,cover_image_url,share_url,view_count,like_count,comment_count,share_count,duration',
      { max_count: 20 }
    );

    out.topPosts = vids.data.videos
      .map<NormalizedPost>((v) => ({
        externalId: v.id,
        title: v.title?.slice(0, 80),
        permalink: v.share_url,
        thumbUrl: v.cover_image_url,
        postedAt: new Date(v.create_time * 1000).toISOString(),
        views: v.view_count,
        likes: v.like_count,
        comments: v.comment_count,
        shares: v.share_count
      }))
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, topN);
    out.views = vids.data.videos.reduce((s, v) => s + (v.view_count || 0), 0);

    out.raw = { me, videos: vids.data.videos };
    return out;
  }
};
