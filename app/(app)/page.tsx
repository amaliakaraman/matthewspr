import { PageHeader } from '@/components/shell/primitives';
import { TodayView } from '@/components/booking/TodayView';
import { HeaderActions } from '@/components/booking/HeaderActions';

export const metadata = { title: 'Today · Matthews PR' };

export default function TodayPage() {
  return (
    <>
      <PageHeader title="Today" actions={<HeaderActions />} />
      <TodayView />
    </>
  );
}
