'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function CaptivateConnectForm({ accountId }: { accountId: string }) {
  const [apiKey, setApiKey] = useState('');
  const [userId, setUserId] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/platforms/captivate/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: accountId, api_key: apiKey, captivate_user_id: userId })
      });
      const j = await res.json();
      if (!res.ok) {
        setErr(j.error || 'Failed');
        return;
      }
      router.push('/dashboard/settings?ok=captivate');
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
        Captivate uses an API key, not OAuth. Generate one at{' '}
        <a
          href="https://captivate.fm"
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-sky underline"
        >
          captivate.fm
        </a>{' '}
        → Account → Integrations.
      </p>
      <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-mute">
        Captivate User ID
      </label>
      <input
        type="text"
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        required
        className="mb-4 w-full rounded-md border border-white/10 bg-white/[.04] px-3 py-2 text-sm"
      />
      <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-mute">
        API Key
      </label>
      <input
        type="password"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        required
        className="mb-4 w-full rounded-md border border-white/10 bg-white/[.04] px-3 py-2 text-sm"
      />
      <button
        disabled={busy}
        className="btn-prim w-full rounded-md px-4 py-2.5 text-sm font-semibold"
      >
        {busy ? 'Connecting…' : 'Connect Captivate'}
      </button>
      {err && (
        <div className="mt-3 rounded bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          {err}
        </div>
      )}
    </form>
  );
}
