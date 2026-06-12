import { PageHeader } from '@/components/shell/primitives';
import { BookingsBoard } from '@/components/booking/BookingsBoard';
import { HeaderActions } from '@/components/booking/HeaderActions';

export const metadata = { title: 'Bookings · Matthews PR' };

export default function BookingsPage() {
  return (
    <>
      <PageHeader
        title="Bookings"
        subtitle="Podcast guest pipeline"
        actions={<HeaderActions />}
      />
      <BookingsBoard />
    </>
  );
}
