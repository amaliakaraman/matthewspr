/**
 * Hand-written types. After running migrations you can replace this with
 * `supabase gen types typescript --local > lib/supabase/types.ts` for
 * fully accurate generated types.
 */

export type PlatformKind =
  | 'spotify' | 'captivate' | 'youtube'
  | 'instagram' | 'tiktok' | 'linkedin' | 'x';

export type AccountKind = 'personal' | 'show';
export type MemberRole = 'owner' | 'admin' | 'editor' | 'viewer';
export type ConnectionStatus =
  | 'connected' | 'disconnected' | 'expired' | 'manual_only' | 'error';

export interface Org {
  id: string;
  name: string;
  slug: string;
  brand_color: string | null;
  logo_url: string | null;
  created_at: string;
}

export interface Account {
  id: string;
  org_id: string;
  label: string;
  tag: string;
  kind: AccountKind;
  brand_color: string | null;
  position: number;
  created_at: string;
}

export interface PlatformConnection {
  id: string;
  account_id: string;
  platform: PlatformKind;
  handle: string | null;
  profile_url: string | null;
  external_id: string | null;
  status: ConnectionStatus;
  access_token_enc: string | null;
  refresh_token_enc: string | null;
  token_expires_at: string | null;
  scope: string | null;
  connected_at: string | null;
  last_pull_at: string | null;
  last_pull_error: string | null;
  last_refresh_at: string | null;
  refresh_lock_until: string | null;
  meta: Record<string, unknown>;
}

export interface Snapshot {
  id: string;
  org_id: string;
  account_id: string;
  connection_id: string | null;
  platform: PlatformKind;
  captured_at: string;
  period_label: string | null;
  period_start: string | null;
  period_end: string | null;
  source: 'manual' | 'api_pull' | 'cron' | 'import';
  followers: number | null;
  growth: number | null;
  views: number | null;
  impressions: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  watch_seconds: number | null;
  avg_watch_seconds: number | null;
  engagement_rate: number | null;
  profile_visits: number | null;
  downloads: number | null;
  plays: number | null;
  unique_listeners: number | null;
  episodes: number | null;
  raw: Record<string, unknown>;
  created_at: string;
}

export interface Post {
  id: string;
  snapshot_id: string;
  account_id: string;
  platform: PlatformKind;
  external_id: string | null;
  posted_at: string | null;
  title: string | null;
  caption: string | null;
  permalink: string | null;
  media_url: string | null;
  media_blob_url: string | null;
  thumb_blob_url: string | null;
  is_top: boolean;
  rank: number | null;
  views: number | null;
  impressions: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  follows: number | null;
  visits: number | null;
  watch_seconds: number | null;
  avg_watch_seconds: number | null;
  downloads: number | null;
  plays: number | null;
  meta: Record<string, unknown>;
}

export interface Insight {
  id: string;
  org_id: string;
  account_id: string | null;
  snapshot_id: string | null;
  kind: string;
  prompt: string | null;
  output_md: string;
  output_json: unknown;
  model: string;
  tokens_in: number | null;
  tokens_out: number | null;
  created_at: string;
}

export interface OrgInvite {
  id: string;
  org_id: string;
  email: string;
  role: MemberRole;
  invited_by: string | null;
  created_at: string;
  claimed_at: string | null;
  claimed_by: string | null;
}

export interface OrgMember {
  org_id: string;
  user_id: string;
  role: MemberRole;
  invited_email: string | null;
  joined_at: string;
}

export interface Recap {
  id: string;
  org_id: string;
  title: string;
  period_label: string | null;
  period_start: string | null;
  period_end: string | null;
  template: string;
  account_ids: string[];
  layout: Record<string, unknown>;
  pdf_blob_url: string | null;
  png_blob_urls: string[];
  cover_blob_url: string | null;
  notes_md: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CronRun {
  id: string;
  job: string;
  org_id: string | null;
  started_at: string;
  finished_at: string | null;
  ok: boolean | null;
  message: string | null;
  results: Record<string, unknown>;
}

/**
 * Minimal Database type — enough for Supabase client generic typing.
 * Replace with generated types in production.
 *
 * NOTE: must satisfy `GenericSchema` from @supabase/postgrest-js, which (as of
 * supabase-js >= 2.71) requires `Tables`, `Views`, `Functions`, and a
 * `Relationships: []` field on every table. Drop any of these and the typed
 * client silently falls back to `Schema = never`, which makes `.insert(...)`
 * infer as `never[]` and breaks every write at the type level.
 */
type TableOf<T> = {
  Row: T;
  Insert: Partial<T>;
  Update: Partial<T>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      orgs: TableOf<Org>;
      accounts: TableOf<Account>;
      platform_connections: TableOf<PlatformConnection>;
      snapshots: TableOf<Snapshot>;
      posts: TableOf<Post>;
      insights: TableOf<Insight>;
      recaps: TableOf<Recap>;
      org_invites: TableOf<OrgInvite>;
      org_members: TableOf<OrgMember>;
      cron_runs: TableOf<CronRun>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
