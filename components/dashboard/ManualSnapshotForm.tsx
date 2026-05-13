'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { PLATFORM_META } from '@/lib/platforms';
import type { Account, PlatformKind } from '@/lib/supabase/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

const PLATFORMS: PlatformKind[] = [
  'instagram',
  'tiktok',
  'linkedin',
  'x',
  'youtube',
  'spotify',
  'captivate'
];

type NumField =
  | 'followers'
  | 'growth'
  | 'views'
  | 'impressions'
  | 'likes'
  | 'profile_visits'
  | 'downloads'
  | 'plays';

interface PostRow {
  title: string;
  permalink: string;
  thumb_blob_url: string;
  views: string;
  likes: string;
  impressions: string;
  follows: string;
  visits: string;
  downloads: string;
  plays: string;
}

const emptyPost = (): PostRow => ({
  title: '',
  permalink: '',
  thumb_blob_url: '',
  views: '',
  likes: '',
  impressions: '',
  follows: '',
  visits: '',
  downloads: '',
  plays: ''
});

function parseInt0(v: string): number | null {
  if (!v) return null;
  const n = parseInt(v.replace(/[^\d-]/g, ''), 10);
  return Number.isNaN(n) ? null : n;
}

export function ManualSnapshotForm({
  accounts,
  defaultAccountId,
  defaultPlatform
}: {
  accounts: Account[];
  defaultAccountId?: string;
  defaultPlatform?: PlatformKind;
}) {
  const router = useRouter();
  const [accountId, setAccountId] = useState(
    defaultAccountId || accounts[0]?.id || ''
  );
  const [platform, setPlatform] = useState<PlatformKind>(
    defaultPlatform || 'instagram'
  );
  const [periodLabel, setPeriodLabel] = useState('');
  const [fields, setFields] = useState<Record<NumField, string>>({
    followers: '',
    growth: '',
    views: '',
    impressions: '',
    likes: '',
    profile_visits: '',
    downloads: '',
    plays: ''
  });
  const [posts, setPosts] = useState<PostRow[]>([emptyPost()]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  const meta = PLATFORM_META[platform];
  const visibleFields = useMemo<NumField[]>(() => {
    const base: NumField[] = ['followers', 'growth'];
    if (platform === 'captivate' || platform === 'spotify') {
      return [...base, 'downloads', 'plays'];
    }
    if (platform === 'linkedin' || platform === 'x') {
      return [...base, 'impressions', 'likes', 'profile_visits'];
    }
    if (platform === 'youtube') {
      return [...base, 'views', 'likes'];
    }
    return [...base, 'views', 'likes', 'impressions', 'profile_visits'];
  }, [platform]);

  function setField(k: NumField, v: string) {
    setFields((prev) => ({ ...prev, [k]: v }));
  }

  function setPostField<K extends keyof PostRow>(idx: number, k: K, v: PostRow[K]) {
    setPosts((prev) => prev.map((p, i) => (i === idx ? { ...p, [k]: v } : p)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setOk('');
    setBusy(true);
    try {
      const cleanPosts = posts
        .filter((p) => p.title || p.permalink || p.thumb_blob_url)
        .map((p) => ({
          title: p.title || undefined,
          permalink: p.permalink || undefined,
          thumb_blob_url: p.thumb_blob_url || undefined,
          views: parseInt0(p.views),
          likes: parseInt0(p.likes),
          impressions: parseInt0(p.impressions),
          follows: parseInt0(p.follows),
          visits: parseInt0(p.visits),
          downloads: parseInt0(p.downloads),
          plays: parseInt0(p.plays)
        }));
      const body = {
        account_id: accountId,
        platform,
        period_label: periodLabel || undefined,
        followers: parseInt0(fields.followers),
        growth: parseInt0(fields.growth),
        views: parseInt0(fields.views),
        impressions: parseInt0(fields.impressions),
        likes: parseInt0(fields.likes),
        profile_visits: parseInt0(fields.profile_visits),
        downloads: parseInt0(fields.downloads),
        plays: parseInt0(fields.plays),
        posts: cleanPosts.length ? cleanPosts : undefined
      };
      const res = await fetch('/api/snapshots/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setErr(j.error || 'Save failed');
        return;
      }
      setOk('Snapshot saved.');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Card>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-mute">
              Account
            </span>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full rounded-md border border-white/10 bg-white/[.04] px-3 py-2 text-sm"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.tag} · {a.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-mute">
              Platform
            </span>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as PlatformKind)}
              className="w-full rounded-md border border-white/10 bg-white/[.04] px-3 py-2 text-sm"
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {PLATFORM_META[p].name}
                </option>
              ))}
            </select>
          </label>
          <Input
            label="Period label"
            value={periodLabel}
            onChange={(e) => setPeriodLabel(e.target.value)}
            placeholder="April 22 – May 6"
          />
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 font-display text-sm font-bold">
          {meta.name} metrics
        </h3>
        <div className="grid gap-4 md:grid-cols-3">
          {visibleFields.map((f) => (
            <Input
              key={f}
              label={f.replace('_', ' ')}
              inputMode="numeric"
              value={fields[f]}
              onChange={(e) => setField(f, e.target.value)}
              placeholder="0"
            />
          ))}
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-sm font-bold">Top posts (optional)</h3>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setPosts((p) => [...p, emptyPost()])}
          >
            + Add post
          </Button>
        </div>
        <div className="space-y-3">
          {posts.map((p, i) => (
            <div
              key={i}
              className="rounded-xl border border-white/[.07] bg-white/[.025] p-3"
            >
              <div className="mb-3 grid gap-3 md:grid-cols-2">
                <Input
                  label="Title"
                  value={p.title}
                  onChange={(e) => setPostField(i, 'title', e.target.value)}
                />
                <Input
                  label="Permalink"
                  value={p.permalink}
                  onChange={(e) => setPostField(i, 'permalink', e.target.value)}
                  placeholder="https://…"
                />
              </div>
              <Input
                label="Thumbnail URL (optional)"
                value={p.thumb_blob_url}
                onChange={(e) =>
                  setPostField(i, 'thumb_blob_url', e.target.value)
                }
                placeholder="https://…"
              />
              <div className="mt-3 grid gap-3 md:grid-cols-4">
                <Input
                  label="Views"
                  inputMode="numeric"
                  value={p.views}
                  onChange={(e) => setPostField(i, 'views', e.target.value)}
                />
                <Input
                  label="Likes"
                  inputMode="numeric"
                  value={p.likes}
                  onChange={(e) => setPostField(i, 'likes', e.target.value)}
                />
                <Input
                  label="Impressions"
                  inputMode="numeric"
                  value={p.impressions}
                  onChange={(e) =>
                    setPostField(i, 'impressions', e.target.value)
                  }
                />
                <Input
                  label="Follows"
                  inputMode="numeric"
                  value={p.follows}
                  onChange={(e) => setPostField(i, 'follows', e.target.value)}
                />
              </div>
              {posts.length > 1 && (
                <div className="mt-3 text-right">
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() =>
                      setPosts((prev) => prev.filter((_, j) => j !== i))
                    }
                  >
                    Remove
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save snapshot'}
        </Button>
        {ok && (
          <span className="text-xs font-semibold text-emerald-300">{ok}</span>
        )}
        {err && (
          <span className="text-xs font-semibold text-rose-300">{err}</span>
        )}
      </div>
    </form>
  );
}
