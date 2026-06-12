'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    const sb = supabaseBrowser();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="glass w-full max-w-md rounded-3xl p-10">
        <h1 className="text-[28px] font-bold tracking-[-0.01em] text-ink">
          Matthews PR Dashboard
        </h1>

        <form onSubmit={submit} className="mt-8 space-y-4">
          <div>
            <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-mute">
              Email
            </label>
            <input
              type="email"
              required
              autoFocus
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="amalia.karaman@matthews.com"
              className="w-full rounded-xl border border-white/10 bg-white/[.04] px-4 py-3 text-sm text-ink placeholder-white/30 outline-none focus:border-brand-sky focus:ring-2 focus:ring-brand-sky/20"
            />
          </div>
          <div>
            <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-mute">
              Password
            </label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-white/10 bg-white/[.04] px-4 py-3 text-sm text-ink placeholder-white/30 outline-none focus:border-brand-sky focus:ring-2 focus:ring-brand-sky/20"
            />
          </div>
          <button
            type="submit"
            disabled={busy || !email || !password}
            className="btn-prim w-full rounded-xl px-5 py-3 text-sm font-semibold disabled:opacity-50"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          {err && (
            <div className="rounded-lg bg-rose-500/10 px-4 py-3 text-xs text-rose-300">
              {err}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
