'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Account, Insight } from '@/lib/supabase/types';
import { format } from 'date-fns';

const KINDS = [
  { value: 'weekly', label: 'Weekly Strategic Insight' },
  { value: 'recap_copy', label: 'Recap Copy / Captions' },
  { value: 'content_strategy', label: 'Content Strategy + Post Ideas' }
] as const;

export function InsightsPanel({
  accounts,
  activeAccountId,
  existing
}: {
  accounts: Account[];
  activeAccountId: string;
  existing: Insight[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [kind, setKind] =
    useState<(typeof KINDS)[number]['value']>('weekly');
  const [notes, setNotes] = useState('');
  const [result, setResult] = useState<Insight | null>(null);
  const [err, setErr] = useState('');

  async function generate() {
    setBusy(true);
    setErr('');
    setResult(null);
    try {
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: activeAccountId,
          kind,
          notes: notes || undefined
        })
      });
      const j = await res.json();
      if (!res.ok) {
        setErr(j.error || 'Failed');
        return;
      }
      setResult({
        id: j.insight_id,
        kind,
        output_md: '',
        output_json: j.output,
        created_at: new Date().toISOString()
      } as Insight);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <aside className="space-y-4">
        <div className="rounded-[16px] border border-white/[.07] bg-white/[.035] p-5 backdrop-blur-xl">
          <h3 className="mb-3 font-display text-sm font-bold">Account</h3>
          <div className="flex flex-col gap-1.5">
            {accounts.map((a) => (
              <a
                key={a.id}
                href={`?acct=${a.id}`}
                className={
                  'rounded-md px-3 py-2 text-xs font-semibold transition-colors ' +
                  (a.id === activeAccountId
                    ? 'bg-white/10 text-ink'
                    : 'text-ink-dim hover:bg-white/5')
                }
              >
                <span className="mr-2 rounded bg-brand-sky/15 px-1.5 py-[2px] text-[9px] uppercase tracking-[0.08em] text-brand-sky">
                  {a.tag}
                </span>
                {a.label}
              </a>
            ))}
          </div>
        </div>

        <div className="rounded-[16px] border border-white/[.07] bg-white/[.035] p-5 backdrop-blur-xl">
          <h3 className="mb-3 font-display text-sm font-bold">
            Generate insight
          </h3>
          <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-mute">
            Kind
          </label>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as never)}
            className="mb-3 w-full rounded-md border border-white/10 bg-white/[.04] px-3 py-2 text-sm text-ink"
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
          <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-mute">
            Owner notes (optional)
          </label>
          <textarea
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. We pushed YouTube Shorts this week and TikTok had a viral hook…"
            className="mb-3 w-full rounded-md border border-white/10 bg-white/[.04] px-3 py-2 text-sm text-ink placeholder-white/30"
          />
          <button
            disabled={busy}
            onClick={generate}
            className="btn-prim w-full rounded-md px-4 py-2.5 text-sm font-semibold"
          >
            {busy ? 'Asking Claude…' : 'Generate insight'}
          </button>
          {err && (
            <div className="mt-3 rounded bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {err}
            </div>
          )}
        </div>
      </aside>

      <section className="space-y-4">
        {result && (
          <InsightCard insight={result} fresh />
        )}
        {existing.map((i) => (
          <InsightCard key={i.id} insight={i} />
        ))}
        {!existing.length && !result && (
          <div className="rounded-2xl border border-dashed border-white/10 p-16 text-center text-sm text-ink-mute">
            No insights yet. Generate one on the left.
          </div>
        )}
      </section>
    </div>
  );
}

function InsightCard({ insight, fresh }: { insight: Insight; fresh?: boolean }) {
  const j: any = insight.output_json;
  return (
    <article
      className={
        'rounded-[18px] border bg-white/[.035] p-6 backdrop-blur-xl ' +
        (fresh ? 'border-brand-sky/40 shadow-[0_0_30px_rgba(56,189,248,.2)]' : 'border-white/[.07]')
      }
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-dim">
          {insight.kind.replace('_', ' ')}
        </span>
        <span className="text-[10px] text-ink-mute">
          {format(new Date(insight.created_at), "MMM d, yyyy 'at' h:mm a")}
        </span>
      </div>
      {j?.headline && (
        <h2 className="mb-2 font-display text-xl font-bold tracking-tight">
          {j.headline}
        </h2>
      )}
      {j?.summary_md && (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-dim">
          {j.summary_md}
        </p>
      )}
      {Array.isArray(j?.wins) && j.wins.length > 0 && (
        <Section title="Wins" color="#34D399" items={j.wins} />
      )}
      {Array.isArray(j?.watchouts) && j.watchouts.length > 0 && (
        <Section title="Watch-outs" color="#FB7185" items={j.watchouts} />
      )}
      {Array.isArray(j?.recommendations) && j.recommendations.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-mute">
            Recommendations
          </div>
          <div className="space-y-2">
            {j.recommendations.map((r: any, i: number) => (
              <div
                key={i}
                className="rounded-xl border border-white/[.07] bg-white/[.025] p-3"
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-[0.12em] text-ink-mute">
                    {r.platform}
                  </span>
                  <span
                    className={
                      'rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ' +
                      (r.impact === 'high'
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : r.impact === 'medium'
                        ? 'bg-amber-500/15 text-amber-300'
                        : 'bg-white/10 text-ink-mute')
                    }
                  >
                    {r.impact || 'med'}
                  </span>
                </div>
                <div className="text-sm font-semibold">{r.action}</div>
                <div className="mt-1 text-xs text-ink-dim">{r.rationale}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {Array.isArray(j?.callouts) && j.callouts.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {j.callouts.map((c: any, i: number) => (
            <span
              key={i}
              className={
                'rounded-full border px-2.5 py-1 text-[11px] font-semibold ' +
                (c.tone === 'good'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : c.tone === 'bad'
                  ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                  : 'border-white/10 bg-white/5 text-ink-dim')
              }
            >
              {c.label}: {c.value}
            </span>
          ))}
        </div>
      )}
      {!j && insight.output_md && (
        <pre className="whitespace-pre-wrap text-sm text-ink-dim">
          {insight.output_md}
        </pre>
      )}
    </article>
  );
}

function Section({
  title,
  color,
  items
}: {
  title: string;
  color: string;
  items: string[];
}) {
  return (
    <div className="mt-5">
      <div
        className="mb-2 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em]"
        style={{ color }}
      >
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: color }}
        />
        {title}
      </div>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="text-sm text-ink-dim">
            • {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
