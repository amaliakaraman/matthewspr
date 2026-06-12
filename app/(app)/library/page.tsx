import { PageHeader } from '@/components/shell/primitives';
import { LibraryView } from '@/components/booking/LibraryView';
import { HeaderActions } from '@/components/booking/HeaderActions';

export const metadata = { title: 'Library · Matthews PR' };

export default function LibraryPage() {
  return (
    <>
      <PageHeader
        title="Library"
        subtitle="Email scripts & PR resources"
        actions={<HeaderActions />}
      />
      <LibraryView />
    </>
  );
}
