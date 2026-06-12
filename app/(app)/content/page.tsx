import { PageHeader } from '@/components/shell/primitives';
import { ContentView } from '@/components/booking/ContentView';
import { HeaderActions } from '@/components/booking/HeaderActions';

export const metadata = { title: 'Content · Matthews PR' };

export default function ContentPage() {
  return (
    <>
      <PageHeader
        title="Content"
        subtitle="KM social media"
        actions={<HeaderActions />}
      />
      <ContentView />
    </>
  );
}
