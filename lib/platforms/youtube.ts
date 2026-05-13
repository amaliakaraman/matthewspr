import type { PlatformAdapter, NormalizedSnapshot, NormalizedPost } from './types';

/**
 * YouTube Data API v3 adapter.
 * Scopes:
 *  - https://www.googleapis.com/auth/youtube.readonly
 *  - https://www.googleapis.com/auth/yt-analytics.readonly  (channel analytics)
 */
const AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN = 'https://oauth2.googleapis.com/token';
const API = 'https://www.googleapis.com/youtube/v3';
const ANALYTICS = 'https://youtubeanalytics.googleapis.com/v2';

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly'
];

async function ytFetch<T>(token: string, url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store'
  });
  if (!res.ok) throw new Error(`youtube ${url} ${res.status}`);
  return (await res.json()) as T;
}

export const youtube: PlatformAdapter = {
  kind: 'youtube',

  authorizeUrl({ state, redirectUri }) {
    const u = new URL(AUTH);
    u.searchParams.set('client_id', process.env.YOUTUBE_CLIENT_ID!);
    u.searchParams.set('redirect_uri', redirectUri);
    u.searchParams.set('response_type', 'code');
    u.searchParams.set('scope', SCOPES.join(' '));
    u.searchParams.set('access_type', 'offline');
    u.searchParams.set('prompt', 'consent');
    u.searchParams.set('state', state);
    return u.toString();
  },

  async exchangeCode({ code, redirectUri }) {
    const res = await fetch(TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.YOUTUBE_CLIENT_ID!,
        client_secret: process.env.YOUTUBE_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });
    if (!res.ok) throw new Error(`youtube token ${res.status}`);
    const j = await res.json();

    const ch = await ytFetch<{
      items: Array<{
        id: string;
        snippet: { title: string; customUrl?: string };
      }>;
    }>(j.access_token, `${API}/channels?part=snippet&mine=true`);
    const channel = ch.items?.[0];

    return {
      accessToken: j.access_token,
      refreshToken: j.refresh_token,
      expiresAt: new Date(Date.now() + j.expires_in * 1000).toISOString(),
      scope: j.scope,
      externalId: channel?.id,
      handle: channel?.snippet.title,
      profileUrl: channel?.snippet.customUrl
        ? `https://youtube.com/${channel.snippet.customUrl}`
        : channel?.id
        ? `https://youtube.com/channel/${channel.id}`
        : undefined
    };
  },

  async refresh({ refreshToken }) {
    const res = await fetch(TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: process.env.YOUTUBE_CLIENT_ID!,
        client_secret: process.env.YOUTUBE_CLIENT_SECRET!,
        grant_type: 'refresh_token'
      })
    });
    if (!res.ok) throw new Error(`youtube refresh ${res.status}`);
    const j = await res.json();
    return {
      accessToken: j.access_token,
      refreshToken,
      expiresAt: new Date(Date.now() + j.expires_in * 1000).toISOString()
    };
  },

  async pullSnapshot({ accessToken, externalId, topN = 5 }) {
    const out: NormalizedSnapshot = {
      platform: 'youtube',
      capturedAt: new Date().toISOString(),
      topPosts: [],
      raw: {}
    };

    // Channel stats
    const ch = await ytFetch<{
      items: Array<{
        id: string;
        snippet: { title: string };
        statistics: {
          subscriberCount: string;
          viewCount: string;
          videoCount: string;
        };
        contentDetails: { relatedPlaylists: { uploads: string } };
      }>;
    }>(
      accessToken,
      `${API}/channels?part=snippet,statistics,contentDetails&${externalId ? `id=${externalId}` : 'mine=true'}`
    );
    const channel = ch.items?.[0];
    if (!channel) return out;
    out.handle = channel.snippet.title;
    out.followers = parseInt(channel.statistics.subscriberCount || '0', 10);
    out.views = parseInt(channel.statistics.viewCount || '0', 10);
    out.episodes = parseInt(channel.statistics.videoCount || '0', 10);

    // Top recent uploads
    const uploads = channel.contentDetails.relatedPlaylists.uploads;
    const pl = await ytFetch<{
      items: Array<{
        contentDetails: { videoId: string };
        snippet: { title: string; publishedAt: string; thumbnails: { high?: { url: string } } };
      }>;
    }>(
      accessToken,
      `${API}/playlistItems?part=snippet,contentDetails&playlistId=${uploads}&maxResults=20`
    );
    const ids = pl.items.map((i) => i.contentDetails.videoId);
    const vid = await ytFetch<{
      items: Array<{
        id: string;
        snippet: { title: string; publishedAt: string; thumbnails: { high?: { url: string } } };
        statistics: { viewCount?: string; likeCount?: string; commentCount?: string };
      }>;
    }>(
      accessToken,
      `${API}/videos?part=snippet,statistics&id=${ids.join(',')}`
    );
    const top: NormalizedPost[] = vid.items
      .map((v) => ({
        externalId: v.id,
        title: v.snippet.title,
        postedAt: v.snippet.publishedAt,
        thumbUrl: v.snippet.thumbnails?.high?.url,
        permalink: `https://youtube.com/watch?v=${v.id}`,
        views: parseInt(v.statistics.viewCount || '0', 10),
        likes: parseInt(v.statistics.likeCount || '0', 10),
        comments: parseInt(v.statistics.commentCount || '0', 10)
      }))
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, topN);

    out.topPosts = top;
    out.raw = { channel, videos: vid.items };
    return out;
  }
};
