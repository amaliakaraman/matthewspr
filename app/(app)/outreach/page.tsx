import { PageHeader } from '@/components/shell/primitives';
import { OutreachView } from '@/components/booking/OutreachView';
import { HeaderActions } from '@/components/booking/HeaderActions';

export const metadata = { title: 'Outreach · Matthews PR' };

export default function OutreachPage() {
  return (
    <>
      <PageHeader
        title="Outreach"
        subtitle="Prospective guests"
        actions={<HeaderActions />}
      />
      <OutreachView />
    </>
  );
}
