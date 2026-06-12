import { PageHeader } from '@/components/shell/primitives';
import { ContentView } from '@/components/booking/ContentView';
import { HeaderActions } from '@/components/booking/HeaderActions';

export const metadata = { title: 'Content · Matthews PR' };

export default function ContentPage() {
  return (
    <>
      <PageHeader
        title="Content"
        subtitle="Social Media"
        actions={<HeaderActions />}
      />
      <ContentView />
    </>
  );
}
