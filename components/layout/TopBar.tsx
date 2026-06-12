/**
 * Chrome (brand, nav, sign-out) now lives in the app shell
 * (`components/shell/AppShell` + `Sidebar`). This component is intentionally a
 * no-op so the existing analytics pages that still call <TopBar /> render
 * cleanly inside the shell without duplicating navigation.
 */
export function TopBar(_props: {
  user: { id: string; email?: string | null };
}) {
  return null;
}
