import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';

const NAV_LINKS = [
  { href: '/features', label: 'Features' },
  { href: '/product', label: 'Product' },
  { href: '/compliance', label: 'Compliance' },
  { href: '/for-teams', label: 'For your team' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/about', label: 'About' },
  { href: '/blog', label: 'Blog' },
  { href: '/faq', label: 'FAQ' },
] as const;

export default function LandingNav() {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => router.pathname === href;

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-100 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4 sm:px-6 sm:py-5">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <Image
            src="/pest-trace.png"
            alt="PestTrace Logo"
            width={40}
            height={40}
            priority
            className="h-10 w-10 object-contain"
          />
          <span className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Pest<span className="text-emerald-600">Trace</span>
          </span>
        </Link>

        <div className="hidden min-w-0 flex-1 items-center justify-center gap-4 lg:flex xl:gap-6">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`whitespace-nowrap text-sm font-medium transition ${
                isActive(link.href) ? 'text-emerald-600' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-0">
          <button
            type="button"
            className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-900 lg:hidden"
            onClick={() => setMobileOpen((open) => !open)}
            aria-expanded={mobileOpen}
            aria-label="Toggle menu"
          >
            Menu
          </button>
          <Link
            href="/auth/signin?role=admin"
            className="hidden rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 sm:inline-flex sm:text-sm"
          >
            Business Login
          </Link>
          <Link
            href="/auth/signin?role=technician"
            className="hidden rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-900 transition hover:bg-slate-200 sm:inline-flex sm:text-sm"
          >
            Technician Login
          </Link>
        </div>
      </div>

      {mobileOpen ? (
        <div className="border-t border-slate-100 px-4 py-4 lg:hidden">
          <div className="grid gap-2 sm:grid-cols-2">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`rounded-xl px-4 py-3 text-sm font-semibold ${
                  isActive(link.href) ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-700'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Link
              href="/auth/signin?role=admin"
              className="rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white"
            >
              Business Login
            </Link>
            <Link
              href="/auth/signin?role=technician"
              className="rounded-xl bg-slate-100 px-4 py-3 text-center text-sm font-semibold text-slate-900"
            >
              Technician Login
            </Link>
          </div>
        </div>
      ) : null}
    </nav>
  );
}
