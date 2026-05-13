import type { PlatformAdapter, NormalizedSnapshot, NormalizedPost } from './types';

/**
 * LinkedIn — OpenID Connect for profile + organization social actions.
 * For per-post analytics on personal profiles LinkedIn does not offer a
 * public API; we pull what's available and surface manual entry for the rest.
 *
 * Scopes: openid profile email w_member_social r_liteprofile
 */
const AUTH = 'https://www.linkedin.com/oauth/v2/authorization';
const TOKEN = 'https://www.linkedin.com/oauth/v2/accessToken';
const API = 'https://api.linkedin.com/v2';

const SCOPES = ['openid', 'profile', 'email'];

async function liFetch<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store'
  });
  if (!res.ok) throw new Error(`linkedin ${path} ${res.status}`);
  return (await res.json()) as T;
}

export const linkedin: PlatformAdapter = {
  kind: 'linkedin',

  authorizeUrl({ state, redirectUri }) {
    const u = new URL(AUTH);
    u.searchParams.set('response_type', 'code');
    u.searchParams.set('client_id', process.env.LINKEDIN_CLIENT_ID!);
    u.searchParams.set('redirect_uri', redirectUri);
    u.searchParams.set('scope', SCOPES.join(' '));
    u.searchParams.set('state', state);
    return u.toString();
  },

  async exchangeCode({ code, redirectUri }) {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET!
    });
    const res = await fetch(TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    if (!res.ok) throw new Error(`linkedin token ${res.status}`);
    const j = await res.json();
    const me = await liFetch<{
      sub: string;
      name: string;
      given_name: string;
      family_name: string;
      email: string;
    }>(j.access_token, '/userinfo').catch(() => null);
    return {
      accessToken: j.access_token,
      expiresAt: new Date(Date.now() + j.expires_in * 1000).toISOString(),
      scope: j.scope,
      externalId: me?.sub,
      handle: me?.name,
      profileUrl: 'https://linkedin.com/in/me'
    };
  },

  async pullSnapshot({ accessToken }) {
    // LinkedIn personal-profile analytics aren't available via the standard
    // public Marketing API. Returns minimal info; rely on manual entry for
    // impressions/likes/follower counts (the May 6 PDF workflow).
    return {
      platform: 'linkedin',
      capturedAt: new Date().toISOString(),
      topPosts: [],
      raw: { note: 'Personal LinkedIn analytics require Marketing API + Company Page access.' }
    };
  }
};
