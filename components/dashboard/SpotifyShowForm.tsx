'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function SpotifyShowForm({
  accountId,
  initialShowId
}: {
  accountId: string;
  initialShowId?: string;
}) {
  const [showId, setShowId] = useState(initialShowId || '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const res = await fetch('/api/platforms/spotify/set-show', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: accountId, show_id: showId })
      });
      const j = await res.json();
      if (!res.ok) {
        setErr(j.error || 'Failed');
        return;
      }
      setMsg(`Saved: ${j.show_id}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-white/10 bg-white/[.04] p-6 backdrop-blur-xl"
    >
      <p className="mb-4 text-sm text-ink-dim">
        Spotify needs the <strong>show ID</strong> separately because the OAuth
        handshake only identifies the user, not the podcast. Paste the bare ID,
        a <code className="rounded bg-white/5 px-1.5 py-0.5">spotify:show:…</code>{' '}
        URI, or the full{' '}
        <code className="rounded bg-white/5 px-1.5 py-0.5">open.spotify.com/show/…</code>{' '}
        URL.
      </p>
      <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-mute">
        Spotify show ID
      </label>
      <input
        type="text"
        value={showId}
        onChange={(e) => setShowId(e.target.value)}
        required
        placeholder="6kAsbP8pxwaU2kPibKTuHE"
        className="mb-4 w-full rounded-md border border-white/10 bg-white/[.04] px-3 py-2 text-sm"
      />
      <button
        disabled={busy}
        className="btn-prim w-full rounded-md px-4 py-2.5 text-sm font-semibold"
      >
        {busy ? 'Saving…' : 'Save show ID'}
      </button>
      {msg && (
        <div className="mt-3 rounded bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
          {msg}
        </div>
      )}
      {err && (
        <div className="mt-3 rounded bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          {err}
        </div>
      )}
    </form>
  );
}
