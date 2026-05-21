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
 * Docs: https://developers.captivate.fm/
 *
 * KNOWN LIMITATION: Captivate's public REST API does NOT expose per-episode
 * or per-show download counts. Those numbers are visible in Captivate's web
 * dashboard but the analytics endpoints powering that UI are private and
 * undocumented. We surface what IS available (episode count, episode
 * metadata, publish dates) and leave `downloads` for manual entry via the
 * Manual Snapshot form. Confirmed against the v1 API on 2026-05-21.
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
        shows: Array<{
          id: string;
          title: string;
          episode_count?: number;
          published_date?: string;
          last_episode_title?: string;
          last_episode_published?: string;
          last_episode_id?: string;
          // Captivate also returns the show artwork and the show creation
          // date on this payload. We persist them in `raw` so the dashboard
          // can render a proper podcast hero + "show launched" tile without
          // needing extra API calls.
          artwork?: string;
          created?: string;
        }>;
      }>(session, `/users/${userId}/shows`);

      // If the connection has a show_id pinned in `meta`, prefer that;
      // otherwise default to the first show on the account. This keeps the
      // adapter usable when a single Captivate account hosts multiple shows
      // (which is common — e.g. KM has TMMP plus a corporate show).
      const show = shows.shows?.[0];
      if (!show) return result;
      result.handle = show.title;
      result.episodes = show.episode_count;
      result.profileUrl = `https://app.captivate.fm/episode-list/${show.id}`;

      const eps = await caFetch<{
        success: boolean;
        episodes: Array<{
          id: string;
          title: string;
          published_date: string;
          episode_number?: number;
          slug?: string;
        }>;
      }>(session, `/shows/${show.id}/episodes`);

      const all = eps.episodes || [];

      // Captivate's public API doesn't return download counts. Newest episodes
      // are the best proxy for "what to highlight in the recap" without that
      // data — we sort by publish date and show the most recent N.
      const recent = [...all]
        .sort(
          (a, b) =>
            Date.parse(b.published_date) - Date.parse(a.published_date)
        )
        .slice(0, topN);

      result.topPosts = recent.map<NormalizedPost>((e) => ({
        externalId: e.id,
        title: e.title,
        permalink: e.slug
          ? `https://app.captivate.fm/episode/${e.slug}`
          : undefined,
        postedAt: e.published_date
      }));

      // Leave `result.downloads` unset (null in DB). UI will show "—" and the
      // Manual Snapshot form is the supported path for entering this number.

      result.raw = { shows: shows.shows, episodes: all };
    } catch (e) {
      console.warn('captivate pull warning', e);
    }
    return result;
  }
};
