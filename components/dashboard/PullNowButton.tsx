'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

export function PullNowButton({
  accountId,
  platform,
  connected
}: {
  accountId: string;
  platform: string;
  connected: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const router = useRouter();

  async function pull() {
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: accountId, platform })
      });
      const j = await res.json();
      if (j.ok) {
        setMsg('✓ Updated');
        router.refresh();
      } else {
        setMsg(j.error || 'Pull failed');
      }
    } finally {
      setBusy(false);
    }
  }

  if (!connected) {
    return (
      <a
        href={`/api/platforms/${platform}/connect?account_id=${accountId}`}
        className="rounded-xl border border-white/10 bg-white/[.04] px-4 py-2.5 text-xs font-semibold text-ink-dim hover:bg-white/10"
      >
        Connect platform →
      </a>
    );
  }

  return (
    <button
      onClick={pull}
      disabled={busy}
      className={cn(
        'btn-prim rounded-xl px-4 py-2.5 text-xs font-semibold transition-all',
        busy && 'opacity-60'
      )}
    >
      {busy ? 'Pulling…' : msg || 'Pull fresh snapshot'}
    </button>
  );
}
