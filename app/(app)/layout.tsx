import { AppShell } from '@/components/shell/AppShell';
import { BookingProvider } from '@/components/booking/BookingProvider';

export const dynamic = 'force-dynamic';

export default function AppGroupLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell>
      <BookingProvider>{children}</BookingProvider>
    </AppShell>
  );
}
