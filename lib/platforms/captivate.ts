import type { PlatformAdapter, NormalizedSnapshot, NormalizedPost } from './types';

/**
 * Captivate.fm adapter.
 *
 * Captivate uses a two-step auth: POST `/authenticate/token` with
 * `username` (user ID) + `token` (API key) returning a short-lived session
 * token, which is then sent as `Authorization: Bearer <session>` on every
 * subsequent call.
 *
 * Because session tokens are short-lived we re-authenticate at the start of
 * every snapshot pull rather than persisting the session.
 *
 * Docs: https://docs.captivate.fm/
 */
const API = 'https://api.captivate.fm';

async function caAuthenticate(userId: string, apiKey: string): Promise<string> {
  const body = new URLSearchParams({ username: userId, token: apiKey });
  const res = await fetch(`${API}/authenticate/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store'
  });
  if (!res.ok) throw new Error(`captivate authenticate ${res.status}`);
  const j = (await res.json()) as {
    success?: boolean;
    user?: { token?: string };
    token?: string;
  };
  const token = j.user?.token || j.token;
  if (!token) throw new Error('captivate authenticate: no token in response');
  return token;
}

async function caFetch<T>(session: string, path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${session}` },
    cache: 'no-store'
  });
  if (!res.ok) throw new Error(`captivate ${path} ${res.status}`);
  return (await res.json()) as T;
}

export const captivate: PlatformAdapter = {
  kind: 'captivate',

  authorizeUrl({ redirectUri }) {
    return `${redirectUri}?platform=captivate&prompt=api-key`;
  },

  async exchangeCode({ code }) {
    return {
      accessToken: code,
      externalId: process.env.CAPTIVATE_USER_ID || undefined
    };
  },

  async pullSnapshot({ accessToken, externalId, topN = 5 }) {
    const userId = externalId || process.env.CAPTIVATE_USER_ID;
    const result: NormalizedSnapshot = {
      platform: 'captivate',
      capturedAt: new Date().toISOString(),
      topPosts: [],
      raw: {}
    };
    if (!userId) return result;

    try {
      const session = await caAuthenticate(userId, accessToken);

      const shows = await caFetch<{
        success: boolean;
        shows: Array<{ id: string; title: string; episodes?: number }>;
      }>(session, `/users/${userId}/shows`);
      const show = shows.shows?.[0];
      if (!show) return result;
      result.handle = show.title;
      result.episodes = show.episodes;

      const eps = await caFetch<{
        success: boolean;
        episodes: Array<{
          id: string;
          title: string;
          published_date: string;
          downloads_total?: number;
          shows_url?: string;
        }>;
      }>(session, `/shows/${show.id}/episodes`);

      const all = eps.episodes || [];
      const sorted = all
        .filter((e) => typeof e.downloads_total === 'number')
        .sort((a, b) => (b.downloads_total || 0) - (a.downloads_total || 0))
        .slice(0, topN);

      const total = all.reduce((s, e) => s + (e.downloads_total || 0), 0);
      result.downloads = total;

      result.topPosts = sorted.map<NormalizedPost>((e) => ({
        externalId: e.id,
        title: e.title,
        permalink: e.shows_url,
        postedAt: e.published_date,
        downloads: e.downloads_total
      }));

      result.raw = { shows: shows.shows, episodes: all };
    } catch (e) {
      console.warn('captivate pull warning', e);
    }
    return result;
  }
};
