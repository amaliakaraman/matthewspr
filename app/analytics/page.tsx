import { redirect } from 'next/navigation';

// Social Analytics lives under /dashboard; /analytics is a friendly alias.
export default function AnalyticsAlias() {
  redirect('/dashboard');
}
