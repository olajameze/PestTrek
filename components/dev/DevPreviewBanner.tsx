import Link from 'next/link';
import { previewHref } from '../../lib/devPreview';

export default function DevPreviewBanner() {
  if (process.env.NODE_ENV !== 'development') return null;

  return (
    <div className="sticky top-0 z-[100] border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-sm text-amber-950">
      <strong>Developer preview</strong> — mock data only, no sign-in required. API writes are disabled.{' '}
      <Link href="/dev-demo" className="font-semibold underline hover:text-amber-900">
        All demo pages
      </Link>
    </div>
  );
}

export function DevPreviewPageLinks() {
  const links = [
    { label: 'Dashboard', href: previewHref('/dashboard?tab=technicians') },
    { label: 'Scheduling', href: previewHref('/scheduling') },
    { label: 'Customers & CRM', href: previewHref('/customers') },
    { label: 'Invoices', href: previewHref('/invoices') },
    { label: 'Reports', href: previewHref('/reports') },
    { label: 'Client portal', href: '/portal/demo?preview=1' },
    { label: 'Upgrade page', href: previewHref('/upgrade') },
    { label: 'Technician logbook', href: previewHref('/technician') },
  ];

  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {links.map((link) => (
        <li key={link.href}>
          <Link
            href={link.href}
            className="block rounded-xl border border-slate-200 bg-white px-4 py-3 font-medium text-navy shadow-sm transition hover:border-primary-300 hover:bg-primary-50"
          >
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
