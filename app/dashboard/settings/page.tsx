import { supabaseServer, supabaseAdmin } from '@/lib/supabase/server';
import { TopBar } from '@/components/layout/TopBar';
import { PLATFORM_META } from '@/lib/platforms';
import { PlatformIcon } from '@/components/dashboard/PlatformIcon';
import { redirect } from 'next/navigation';
import type {
  ConnectionStatus,
  PlatformKind,
  Account,
  PlatformConnection,
  OrgInvite
} from '@/lib/supabase/types';
import { TeamPanel, type TeamMember } from '@/components/dashboard/TeamPanel';

export const dynamic = 'force-dynamic';

const PLATFORMS: PlatformKind[] = [
  'instagram',
  'tiktok',
  'linkedin',
  'x',
  'youtube',
  'spotify',
  'captivate'
];

const STATUS_PILL: Record<ConnectionStatus, { label: string; cls: string }> = {
  connected: {
    label: 'Connected',
    cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
  },
  expired: {
    label: 'Expired',
    cls: 'border-rose-500/30 bg-rose-500/10 text-rose-300'
  },
  error: {
    label: 'Error',
    cls: 'border-rose-500/30 bg-rose-500/10 text-rose-300'
  },
  manual_only: {
    label: 'Manual only',
    cls: 'border-white/15 bg-white/[.05] text-ink-mute'
  },
  disconnected: {
    label: 'Not connected',
    cls: 'border-white/15 bg-white/[.05] text-ink-mute'
  }
};

function pillForConnection(conn: PlatformConnection | undefined) {
  if (!conn) return STATUS_PILL.disconnected;
  if (conn.status !== 'connected') return STATUS_PILL[conn.status];
  // Connected but expiring soon → amber warning.
  if (conn.token_expires_at) {
    const ms = new Date(conn.token_expires_at).getTime() - Date.now();
    if (ms < 7 * 24 * 60 * 60 * 1000) {
      return {
        label: 'Expiring soon',
        cls: 'border-amber-500/30 bg-amber-500/10 text-amber-300'
      };
    }
  }
  return STATUS_PILL.connected;
}

function relTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  const past = ms < 0;
  const abs = Math.abs(ms);
  const m = Math.round(abs / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return past ? `${m}m ago` : `in ${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return past ? `${h}h ago` : `in ${h}h`;
  const d = Math.round(h / 24);
  return past ? `${d}d ago` : `in ${d}d`;
}

function tokenValidityLine(conn: PlatformConnection | undefined): string | null {
  if (!conn?.token_expires_at) return null;
  const rel = relTime(conn.token_expires_at);
  if (!rel) return null;
  const ms = new Date(conn.token_expires_at).getTime() - Date.now();
  return ms < 0 ? `Token expired ${rel}` : `Token valid for ${rel.replace(/^in /, '')}`;
}

export default async function SettingsPage({
  searchParams
}: {
  searchParams: { ok?: string; err?: string };
}) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');

  const { data: member } = await sb
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!member) redirect('/dashboard');

  const { data: accounts } = await sb
    .from('accounts')
    .select('*')
    .eq('org_id', member.org_id)
    .order('position');

  const { data: connections } = await sb
    .from('platform_connections')
    .select('*')
    .in('account_id', (accounts || []).map((a) => a.id));

  const byAccount = new Map<string, PlatformConnection[]>();
  for (const c of connections || []) {
    if (!byAccount.has(c.account_id)) byAccount.set(c.account_id, []);
    byAccount.get(c.account_id)!.push(c);
  }

  // Team data
  const canManage = member.role === 'owner' || member.role === 'admin';
  const { data: rawMembers } = await sb
    .from('org_members')
    .select('user_id, role, joined_at')
    .eq('org_id', member.org_id)
    .order('joined_at');
  const { data: invites } = await sb
    .from('org_invites')
    .select('*')
    .eq('org_id', member.org_id)
    .is('claimed_at', null)
    .order('created_at', { ascending: false });

  // Fetch member emails via the admin client (auth.users isn't reachable via RLS).
  const emailById = new Map<string, string>();
  try {
    const admin = supabaseAdmin();
    const ids = (rawMembers || []).map((m) => m.user_id);
    for (const id of ids) {
      const { data } = await admin.auth.admin.getUserById(id);
      if (data?.user?.email) emailById.set(id, data.user.email);
    }
  } catch {
    // Service role key not present locally — fall through with user IDs only.
  }

  const teamMembers: TeamMember[] = (rawMembers || []).map((m) => ({
    user_id: m.user_id,
    role: m.role,
    joined_at: m.joined_at,
    email: emailById.get(m.user_id) ?? null,
    is_self: m.user_id === user.id
  }));

  return (
    <main className="pb-20">
      <TopBar user={user} />
      <div className="px-9">
        <div className="mb-6 mt-4">
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Settings
          </h1>
          <div className="mt-1 text-sm text-ink-dim">
            Connect platforms, manage your team, configure your org.
          </div>
        </div>

        {searchParams.ok && (
          <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            ✓ {searchParams.ok} connected.
          </div>
        )}
        {searchParams.err && (
          <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {decodeURIComponent(searchParams.err)}
          </div>
        )}

        {(accounts as Account[] | null)?.map((a) => (
          <section
            key={a.id}
            className="mb-8 rounded-[18px] border border-white/[.07] bg-white/[.035] p-6 backdrop-blur-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="rounded bg-brand-sky/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-brand-sky">
                  {a.tag}
                </span>
                <h2 className="font-display text-xl font-bold">{a.label}</h2>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {PLATFORMS.map((p) => {
                const meta = PLATFORM_META[p];
                const conn = byAccount.get(a.id)?.find((c) => c.platform === p);
                const connected = conn?.status === 'connected';
                const pill = pillForConnection(conn);
                const validity = tokenValidityLine(conn);
                const lastRefresh = relTime(
                  conn?.last_refresh_at ?? conn?.last_pull_at ?? null
                );
                return (
                  <div
                    key={p}
                    className="rounded-xl border border-white/[.07] bg-white/[.025] p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-white"
                        style={{
                          background:
                            p === 'instagram' ? meta.gradient : meta.color
                        }}
                      >
                        <PlatformIcon kind={p} className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-semibold">{meta.name}</div>
                          <span
                            className={
                              'rounded-full border px-2 py-[1px] text-[10px] font-semibold uppercase tracking-wide ' +
                              pill.cls
                            }
                          >
                            {pill.label}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-ink-mute">
                          {connected
                            ? conn?.handle || '—'
                            : conn?.status === 'error'
                            ? 'Reconnect required'
                            : conn?.status === 'expired'
                            ? 'Token expired · reconnect'
                            : conn?.status === 'manual_only'
                            ? 'Manual entry only'
                            : 'Not connected'}
                        </div>
                      </div>
                    </div>

                    {(validity || lastRefresh || conn?.last_pull_error) && (
                      <div className="mt-3 space-y-1 rounded-lg border border-white/[.05] bg-white/[.02] px-3 py-2 text-[11px] text-ink-mute">
                        {validity && <div>{validity}</div>}
                        {lastRefresh && <div>Last refreshed {lastRefresh}</div>}
                        {conn?.last_pull_error && (
                          <div
                            className="truncate text-rose-300/80"
                            title={conn.last_pull_error}
                          >
                            {conn.last_pull_error}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="mt-3 flex items-center justify-between">
                      <a
                        href={`/api/platforms/${p}/connect?account_id=${a.id}`}
                        className={
                          'rounded-md px-3 py-1.5 text-xs font-semibold ' +
                          (connected
                            ? 'border border-white/10 bg-white/5 text-ink-dim hover:bg-white/10'
                            : 'btn-prim')
                        }
                      >
                        {connected ? 'Reconnect' : 'Connect'}
                      </a>
                      <div className="flex items-center gap-3">
                        {p === 'spotify' && (
                          <a
                            href={`/dashboard/settings/spotify/${a.id}`}
                            className="text-[11px] font-semibold text-brand-sky hover:text-brand-sky/80"
                          >
                            Set show ID →
                          </a>
                        )}
                        <a
                          href={meta.docsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-ink-mute hover:text-ink"
                        >
                          Docs ↗
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        <section>
          <h2 className="mb-4 font-display text-xl font-bold">Team</h2>
          <TeamPanel
            members={teamMembers}
            invites={(invites as OrgInvite[] | null) || []}
            canManage={canManage}
          />
        </section>
      </div>
    </main>
  );
}
