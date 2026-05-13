'use client';
import { useState } from 'react';
import type { Account, Snapshot, Post } from '@/lib/supabase/types';
import { RecapPages } from './RecapPages';

type Template = 'km-full' | 'tmmp-full' | 'combined';

const TEMPLATES = [
  { id: 'km-full', label: 'KM Socials · Full', desc: 'Cover + IG + TikTok + LinkedIn + X' },
  { id: 'tmmp-full', label: 'TMMP Socials · Full', desc: 'Cover + IG + TikTok + YouTube + Spotify' },
  { id: 'combined', label: 'Combined Recap', desc: 'Both accounts, every platform' }
] as const;

export function RecapStudio({
  accounts,
  snapshotsByAccount
}: {
  accounts: Account[];
  snapshotsByAccount: Record<string, Array<Snapshot & { posts: Post[] }>>;
}) {
  const [tmpl, setTmpl] = useState<Template>('combined');
  const [period, setPeriod] = useState(
    accounts
      .flatMap((a) => snapshotsByAccount[a.id] || [])
      .find((s) => s.period_label)?.period_label || ''
  );
  const [busy, setBusy] = useState<null | 'save' | 'pdf'>(null);
  const [msg, setMsg] = useState('');

  function accountIdsFor(t: Template) {
    return t === 'km-full'
      ? accounts.filter((a) => a.tag === 'KM').map((a) => a.id)
      : t === 'tmmp-full'
      ? accounts.filter((a) => a.tag === 'TMMP').map((a) => a.id)
      : accounts.map((a) => a.id);
  }

  async function saveRecap(t: Template) {
    const res = await fetch('/api/recap/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account_ids: accountIdsFor(t),
        template: t,
        period_label: period
      })
    });
    const j = await res.json();
    if (!res.ok || !j.recap_id) throw new Error(j.error || 'save failed');
    return j.recap_id as string;
  }

  async function onSave() {
    setBusy('save');
    setMsg('');
    try {
      await saveRecap(tmpl);
      setMsg('Saved recap definition.');
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusy(null);
    }
  }

  async function onDownloadPdf() {
    setBusy('pdf');
    setMsg('');
    try {
      const recapId = await saveRecap(tmpl);
      window.location.href = `/api/recap/${recapId}/pdf`;
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="space-y-3 lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-[16px] border border-white/[.07] bg-white/[.035] p-5 backdrop-blur-xl">
          <h3 className="mb-3 font-display text-sm font-bold">Template</h3>
          <div className="space-y-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => setTmpl(t.id as Template)}
                className={
                  'w-full rounded-xl border p-3 text-left transition-colors ' +
                  (tmpl === t.id
                    ? 'border-brand-sky bg-brand-sky/10'
                    : 'border-white/10 bg-white/[.025] hover:bg-white/5')
                }
              >
                <div className="text-sm font-semibold">{t.label}</div>
                <div className="mt-0.5 text-[11px] text-ink-mute">
                  {t.desc}
                </div>
              </button>
            ))}
          </div>

          <h3 className="mb-2 mt-5 font-display text-sm font-bold">Period</h3>
          <input
            type="text"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            placeholder="April 22 – May 6"
            className="w-full rounded-md border border-white/10 bg-white/[.04] px-3 py-2 text-sm"
          />
        </div>

        <div className="rounded-[16px] border border-white/[.07] bg-white/[.035] p-5 backdrop-blur-xl no-print">
          <h3 className="mb-3 font-display text-sm font-bold">Export</h3>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => window.print()}
              className="btn-prim w-full rounded-md px-3 py-2 text-sm font-semibold"
            >
              Print preview / save as PDF
            </button>
            <button
              onClick={onDownloadPdf}
              disabled={busy !== null}
              className="w-full rounded-md border border-brand-sky/40 bg-brand-sky/10 px-3 py-2 text-sm font-semibold text-brand-sky hover:bg-brand-sky/15 disabled:opacity-60"
            >
              {busy === 'pdf' ? 'Generating PDF…' : 'Download PDF (server-rendered)'}
            </button>
            <button
              onClick={onSave}
              disabled={busy !== null}
              className="w-full rounded-md border border-white/10 bg-white/[.04] px-3 py-2 text-center text-sm font-semibold text-ink-dim hover:bg-white/10 disabled:opacity-60"
            >
              {busy === 'save' ? 'Saving…' : 'Save recap definition'}
            </button>
            {msg && (
              <div className="rounded bg-white/[.04] px-3 py-2 text-[11px] text-ink-dim">
                {msg}
              </div>
            )}
          </div>
        </div>
      </aside>

      <div className="flex flex-col items-center gap-4">
        <RecapPages
          template={tmpl}
          accounts={accounts}
          snapshotsByAccount={snapshotsByAccount}
          period={period}
        />
      </div>
    </div>
  );
}
