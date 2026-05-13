'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { MemberRole, OrgInvite } from '@/lib/supabase/types';

export interface TeamMember {
  user_id: string;
  email: string | null;
  role: MemberRole;
  joined_at: string;
  is_self: boolean;
}

const ROLES: MemberRole[] = ['owner', 'admin', 'editor', 'viewer'];

export function TeamPanel({
  members,
  invites,
  canManage
}: {
  members: TeamMember[];
  invites: OrgInvite[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<MemberRole>('editor');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setOk('');
    setBusy(true);
    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role })
      });
      const j = await res.json();
      if (!res.ok) {
        setErr(j.error || 'Failed');
        return;
      }
      setOk(`Invite sent to ${email}`);
      setEmail('');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function revoke(inviteId: string) {
    if (!confirm('Revoke this pending invite?')) return;
    await fetch('/api/team/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invite_id: inviteId })
    });
    router.refresh();
  }

  async function changeRole(userId: string, nextRole: MemberRole | null) {
    const action = nextRole === null ? 'remove this member' : `change role to ${nextRole}`;
    if (!confirm(`Are you sure you want to ${action}?`)) return;
    const res = await fetch('/api/team/role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, role: nextRole })
    });
    const j = await res.json();
    if (!res.ok) {
      alert(j.error || 'Failed');
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <Card>
          <h3 className="mb-3 font-display text-sm font-bold">
            Invite a teammate
          </h3>
          <form onSubmit={invite} className="grid gap-3 md:grid-cols-[1fr_180px_140px]">
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@example.com"
            />
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-mute">
                Role
              </span>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as MemberRole)}
                className="w-full rounded-md border border-white/10 bg-white/[.04] px-3 py-2 text-sm"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? 'Sending…' : 'Send invite'}
              </Button>
            </div>
          </form>
          {ok && (
            <p className="mt-3 text-xs font-semibold text-emerald-300">{ok}</p>
          )}
          {err && (
            <p className="mt-3 text-xs font-semibold text-rose-300">{err}</p>
          )}
          <p className="mt-3 text-[11px] text-ink-mute">
            Invites are claimed automatically when the invitee signs in with the
            same email — no separate signup link to send.
          </p>
        </Card>
      )}

      <Card>
        <h3 className="mb-3 font-display text-sm font-bold">Members</h3>
        <div className="overflow-hidden rounded-lg border border-white/[.07]">
          {members.map((m) => (
            <div
              key={m.user_id}
              className="flex items-center justify-between border-b border-white/[.05] px-4 py-3 last:border-b-0"
            >
              <div>
                <div className="text-sm font-semibold">
                  {m.email || m.user_id}
                  {m.is_self && (
                    <span className="ml-2 text-[10px] uppercase tracking-[0.14em] text-ink-mute">
                      you
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-[11px] text-ink-mute">
                  joined {format(new Date(m.joined_at), 'MMM d, yyyy')}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canManage && !m.is_self ? (
                  <>
                    <select
                      defaultValue={m.role}
                      onChange={(e) =>
                        changeRole(m.user_id, e.target.value as MemberRole)
                      }
                      className="rounded-md border border-white/10 bg-white/[.04] px-2 py-1 text-xs"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => changeRole(m.user_id, null)}
                    >
                      Remove
                    </Button>
                  </>
                ) : (
                  <Badge tone={m.role === 'owner' ? 'info' : 'neutral'}>
                    {m.role}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 font-display text-sm font-bold">Pending invites</h3>
        {invites.length === 0 && (
          <p className="text-sm text-ink-mute">No pending invites.</p>
        )}
        <div className="space-y-2">
          {invites.map((i) => (
            <div
              key={i.id}
              className="flex items-center justify-between rounded-lg border border-white/[.07] px-4 py-3"
            >
              <div>
                <div className="text-sm font-semibold">{i.email}</div>
                <div className="mt-0.5 text-[11px] text-ink-mute">
                  invited {format(new Date(i.created_at), 'MMM d, yyyy')} ·{' '}
                  <Badge tone="info">{i.role}</Badge>
                </div>
              </div>
              {canManage && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => revoke(i.id)}
                >
                  Revoke
                </Button>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
