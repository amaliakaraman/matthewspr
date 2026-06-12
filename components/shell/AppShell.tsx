import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { signState } from '@/lib/crypto';
import { Sidebar } from './Sidebar';

/**
 * The single app frame: dark 248px sidebar + light scrollable content column.
 * Used by both the booking route group and the analytics (`/dashboard`) routes
 * so the whole product shares one shell.
 */
export async function AppShell({ children }: { children: React.ReactNode }) {
  const sb = supabaseServer();
  const {
    data: { user }
  } = await sb.auth.getUser();
  if (!user) redirect('/login');

  const csrf = signState(user.id);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white">
      <Sidebar user={{ email: user.email }} csrf={csrf} />
      <main className="flex h-screen min-w-0 flex-1 flex-col overflow-y-auto bg-white">
        {children}
      </main>
    </div>
  );
}
