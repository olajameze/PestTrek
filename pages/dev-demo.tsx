import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { DevPreviewPageLinks } from '../components/dev/DevPreviewBanner';
import { isDevPreviewMode, previewHref } from '../lib/devPreview';

export default function DevDemoPage() {
  const router = useRouter();

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') {
      void router.replace('/');
    }
  }, [router]);

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const previewReady = router.isReady && isDevPreviewMode(router.query);

  return (
    <>
      <Head>
        <title>Developer demo | Pest Trace</title>
      </Head>
      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-2xl space-y-6">
          <header className="space-y-2 text-center">
            <p className="text-sm font-medium uppercase tracking-wide text-primary-600">Development only</p>
            <h1 className="text-3xl font-bold text-navy">Live feature demo</h1>
            <p className="text-slate-600">
              Browse Business &amp; Enterprise features with mock data — no customer sign-in. Start the dev server, then open any link below (each uses{' '}
              <code className="rounded bg-slate-200 px-1">?preview=1</code>).
            </p>
          </header>

          <Card className="space-y-4 p-6">
            <h2 className="text-lg font-semibold text-navy">Quick start</h2>
            <p className="text-sm text-slate-600">
              Run <code className="rounded bg-slate-100 px-1">npm run dev</code>, then click through the pages. Sidebar navigation keeps preview mode as you move around.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href={previewHref('/dashboard?tab=technicians')}>
                <Button>Open dashboard demo</Button>
              </Link>
              <Link href={previewHref('/customers')}>
                <Button variant="secondary">CRM &amp; portal</Button>
              </Link>
            </div>
          </Card>

          <Card className="space-y-4 p-6">
            <h2 className="text-lg font-semibold text-navy">All demo pages</h2>
            <DevPreviewPageLinks />
          </Card>

          <Card className="space-y-3 p-6 text-sm text-slate-600">
            <h2 className="text-lg font-semibold text-navy">What you can preview</h2>
            <ul className="list-inside list-disc space-y-1">
              <li>Enterprise plan — CRM, scheduling with customer/site picker, invoicing, compliance alerts</li>
              <li>Client portal (token <code className="rounded bg-slate-100 px-1">demo</code>)</li>
              <li>Dashboard widgets — audit readiness, compliance alerts, scheduling cards</li>
              <li>Settings toggles for job-complete email and white-label branding</li>
            </ul>
            <p>
              Signed-in production data still requires your owner account. Preview mode never calls mutating APIs.
            </p>
          </Card>

          {previewReady ? (
            <p className="text-center text-xs text-slate-500">Preview query detected on this page — you are in demo mode.</p>
          ) : null}
        </div>
      </div>
    </>
  );
}
