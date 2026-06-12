import { PageHeader } from '@/components/shell/primitives';
import { ScheduleView } from '@/components/booking/ScheduleView';
import { HeaderActions } from '@/components/booking/HeaderActions';

export const metadata = { title: 'Schedule · Matthews PR' };

export default function SchedulePage() {
  return (
    <>
      <PageHeader
        title="Schedule"
        subtitle="Recordings, availability & travel"
        actions={<HeaderActions />}
      />
      <ScheduleView />
    </>
  );
}
