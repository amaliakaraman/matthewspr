import type { DerivedStage } from '@/lib/demo/booking-fixtures';

type Tone = 'amber' | 'blue' | 'teal' | 'green';

export const STAGE_META: Record<
  DerivedStage,
  { label: string; tone: Tone; dot: string }
> = {
  pending: { label: 'Pending', tone: 'amber', dot: 'bg-mx-dotAmber' },
  in_progress: { label: 'In Progress', tone: 'blue', dot: 'bg-mx-blue' },
  recorded: { label: 'Recorded', tone: 'teal', dot: 'bg-mx-dotTeal' },
  completed: { label: 'Completed', tone: 'green', dot: 'bg-mx-dotGreen' }
};
