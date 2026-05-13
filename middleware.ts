import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

/**
 * Refreshes the Supabase session on every server-rendered route.
 * Without this, server-component-only reads will receive stale tokens.
 */
export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: { headers: req.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => req.cookies.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => {
          req.cookies.set({ name, value, ...options });
          res = NextResponse.next({ request: { headers: req.headers } });
          res.cookies.set({ name, value, ...options });
        },
        remove: (name: string, options: CookieOptions) => {
          req.cookies.set({ name, value: '', ...options });
          res = NextResponse.next({ request: { headers: req.headers } });
          res.cookies.set({ name, value: '', ...options });
        }
      }
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Gate /dashboard behind auth
  const path = req.nextUrl.pathname;
  if (!user && (path.startsWith('/dashboard') || path === '/')) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  if (user && path === '/login') {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return res;
}

export const config = {
  // Only gate the UI shell. API routes authenticate themselves; running
  // supabase.auth.getUser() on every API request just doubles latency for no
  // benefit.
  matcher: ['/', '/dashboard/:path*', '/login']
};
