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
        className="rounded-lg border border-mx-field bg-white px-4 py-2.5 text-[12.5px] font-bold text-mx-body hover:border-mx-fieldHover"
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
        'rounded-lg bg-mx-blue px-4 py-2.5 text-[12.5px] font-bold text-white shadow-glow transition-all hover:bg-mx-blueDeep',
        busy && 'opacity-60'
      )}
    >
      {busy ? 'Pulling…' : msg || 'Pull fresh snapshot'}
    </button>
  );
}
