import Link from 'next/link';
import { getClientSupportEmail } from '../../lib/supportEmail';

export default function LandingFooter() {
  const supportAddr = getClientSupportEmail();
  const currentYear = new Date().getFullYear();
  return (
    <footer className="bg-navy border-t border-slate-800 py-8 text-slate-300">
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 text-sm sm:grid-cols-12 sm:px-6">
        <div className="sm:col-span-4">
          <p className="text-lg font-semibold text-white">Pest Trace</p>
          <p className="mt-3 max-w-sm text-sm leading-6 text-slate-400">
            A modern pest control compliance platform for technicians and teams.
          </p>
          <div className="mt-4 flex items-center gap-4">
            <a
              href="https://www.linkedin.com/company/pesttrace/?viewAsMember=true"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex rounded-md text-slate-400 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              aria-label="Pest Trace on LinkedIn (opens in a new tab)"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="size-6 shrink-0"
                aria-hidden
              >
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </a>
            <a
              href="https://www.facebook.com/share/1LGktsR83z/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex rounded-md text-slate-400 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              aria-label="Pest Trace on Facebook (opens in a new tab)"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="size-6 shrink-0"
                aria-hidden
              >
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
            </a>
          </div>
        </div>

        <div className="sm:col-span-4">
          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Quick links</p>
          <div className="mt-3 flex flex-col gap-2 text-sm text-slate-300">
            <Link href="/blog" className="transition hover:text-white">
              Blog
            </Link>
            <Link href="/privacy" className="transition hover:text-white">
              Privacy Policy
            </Link>
            <Link href="/terms" className="transition hover:text-white">
              Terms of Service
            </Link>
            <Link href="/contact" className="transition hover:text-white">
              Contact
            </Link>
            {process.env.NODE_ENV !== 'production' ? (
              <Link href="/auth/super-admin" className="transition hover:text-white">
                Super Admin
              </Link>
            ) : null}
          </div>
        </div>

        <div className="sm:col-span-4">
          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Contact</p>
          <div className="mt-3 space-y-2 text-sm text-slate-300">
            <p>
              Support:{' '}
              <a href={`mailto:${supportAddr}`} className="text-white underline">
                {supportAddr}
              </a>
            </p>
            <p>
              Created by <a href="https://jgdev.co.uk" target="_blank" rel="noreferrer" className="text-white underline">jgdev.co.uk</a>
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-8 flex w-full max-w-6xl flex-col gap-3 border-t border-slate-800 px-4 pt-8 text-xs text-slate-500 sm:px-6 sm:flex-row sm:items-center sm:justify-between">
        <p>© {currentYear} Pest Trace. All rights reserved.</p>
        <p>Compliance reporting designed for pest control teams.</p>
      </div>
    </footer>
  );
}
