import dynamic from 'next/dynamic';
import Link from 'next/link';
import Button from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';

const SchedulingCalendar = dynamic(() => import('../components/scheduling/SchedulingCalendar'), {
  ssr: false,
  loading: () => <Skeleton className="h-[720px] w-full" />,
});

/** Local-only preview route — no login required. Disabled in production builds. */
export default function SchedulingDemoPage() {
  if (process.env.NODE_ENV !== 'development') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <p className="text-sm text-slate-600">Scheduling demo is only available in local development.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-zinc-200 bg-white px-4 py-4 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Link href="/" className="text-lg font-semibold text-navy">
            Pest Trace
          </Link>
          <Link href="/auth/signin">
            <Button size="sm">Sign in</Button>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-4 lg:p-8">
        <SchedulingCalendar canWrite={false} demoMode />
      </main>
    </div>
  );
}
