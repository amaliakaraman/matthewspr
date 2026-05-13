/**
 * The common interface every platform integration speaks. New platforms must
 * implement this — that's how the dashboard, snapshot worker, and recap
 * builder all stay platform-agnostic.
 */

import type { PlatformKind } from '@/lib/supabase/types';

export interface NormalizedPost {
  externalId?: string;
  permalink?: string;
  postedAt?: string;
  title?: string;
  caption?: string;
  mediaUrl?: string;
  thumbUrl?: string;

  views?: number;
  impressions?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  follows?: number;
  visits?: number;
  watchSeconds?: number;
  avgWatchSeconds?: number;
  downloads?: number;
  plays?: number;
}

export interface NormalizedSnapshot {
  platform: PlatformKind;
  capturedAt: string;
  handle?: string;
  profileUrl?: string;
  externalId?: string;

  followers?: number;
  growth?: number;
  views?: number;
  impressions?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  watchSeconds?: number;
  avgWatchSeconds?: number;
  engagementRate?: number;
  profileVisits?: number;
  downloads?: number;
  plays?: number;
  uniqueListeners?: number;
  episodes?: number;

  topPosts: NormalizedPost[];
  raw: unknown;
}

export interface PlatformAdapter {
  kind: PlatformKind;

  /** Build the OAuth authorize URL. PKCE-aware where applicable. */
  authorizeUrl(args: {
    state: string;
    pkceChallenge?: string;
    redirectUri: string;
  }): string;

  /** Exchange auth code for tokens. */
  exchangeCode(args: {
    code: string;
    pkceVerifier?: string;
    redirectUri: string;
  }): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: string;
    scope?: string;
    externalId?: string;
    handle?: string;
    profileUrl?: string;
  }>;

  /** Refresh an expired access token. */
  refresh?(args: { refreshToken: string }): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: string;
  }>;

  /** Pull a fresh snapshot + top posts for a connected account. */
  pullSnapshot(args: {
    accessToken: string;
    externalId?: string;
    handle?: string;
    /** ISO date — only return posts from this point forward. */
    since?: string;
    /** Max top posts to include. */
    topN?: number;
    /** `platform_connections.meta` — adapter-specific overrides (e.g. Spotify show ID). */
    meta?: Record<string, unknown>;
  }): Promise<NormalizedSnapshot>;
}

export interface OAuthScopeSpec {
  scopes: string[];
  /** Some platforms need a separate Login Kit scope. */
  loginKitScopes?: string[];
}
