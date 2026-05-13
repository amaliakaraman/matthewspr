'use client';

import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sent' | 'error'>('idle');
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('idle');
    setErr('');
    const sb = supabaseBrowser();
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo:
          (typeof window !== 'undefined' ? window.location.origin : '') +
          '/api/auth/callback'
      }
    });
    if (error) {
      setStatus('error');
      setErr(error.message);
    } else {
      setStatus('sent');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="glass w-full max-w-md rounded-3xl p-10">
        <div className="mb-8 flex items-center gap-4">
          <div className="relative h-12 w-12 rounded-2xl bg-[conic-gradient(from_130deg,#38BDF8,#7C3AED,#E1306C,#F59E0B,#38BDF8)] p-[3px]">
            <div className="flex h-full w-full items-center justify-center rounded-xl bg-surface-0">
              <span className="text-xl">⚡</span>
            </div>
          </div>
          <div>
            <div className="font-display text-xl font-bold">KM Socials</div>
            <div className="text-xs uppercase tracking-[0.18em] text-ink-mute">
              Command Center
            </div>
          </div>
        </div>

        <h1 className="font-display text-3xl font-bold tracking-tight">
          Sign in.
        </h1>
        <p className="mt-2 text-sm text-ink-dim">
          We&apos;ll email you a magic link. No password required.
        </p>

        <form onSubmit={submit} className="mt-8 space-y-4">
          <div>
            <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-mute">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="amalia.karaman@matthews.com"
              className="w-full rounded-xl border border-white/10 bg-white/[.04] px-4 py-3 text-sm text-ink placeholder-white/30 outline-none focus:border-brand-sky focus:ring-2 focus:ring-brand-sky/20"
            />
          </div>
          <button
            type="submit"
            className="btn-prim w-full rounded-xl px-5 py-3 text-sm font-semibold"
          >
            Send magic link
          </button>
          {status === 'sent' && (
            <div className="rounded-lg bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300">
              Check your inbox for the link. (Don&apos;t forget spam.)
            </div>
          )}
          {status === 'error' && (
            <div className="rounded-lg bg-rose-500/10 px-4 py-3 text-xs text-rose-300">
              {err}
            </div>
          )}
        </form>

        <p className="mt-6 text-center text-xs text-ink-mute">
          By signing in you agree to be a real human. That&apos;s it.
        </p>
      </div>
    </div>
  );
}
