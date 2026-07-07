import Link from 'next/link';
import { FadeIn } from './ProductVisual';

const EXPLORE_LINKS = [
  {
    href: '/features',
    title: 'Features',
    body: 'Field logbook, dashboard, reports, and tier specific analytics.',
  },
  {
    href: '/compliance',
    title: 'Compliance',
    body: 'Job fields, audit readiness, stewardship records, and audit pack exports.',
  },
  {
    href: '/product',
    title: 'Product tour',
    body: 'Screenshots and video from the technician logbook and owner dashboard.',
  },
  {
    href: '/for-teams',
    title: 'For your team',
    body: 'Separate secure access for business admins and field technicians.',
  },
  {
    href: '/pricing',
    title: 'Pricing',
    body: 'Pro, Business, and Enterprise. Every plan includes a 7 day free trial.',
  },
  {
    href: '/about',
    title: 'About',
    body: 'Who built PestTrace and why we focus on pest control compliance.',
  },
] as const;

export default function MarketingExploreGrid() {
  return (
    <section className="px-6 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <FadeIn>
          <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Dig deeper</h2>
              <p className="mt-2 max-w-lg text-base text-slate-600">
                Product proof, compliance detail, and pricing each have their own page if you want more than this scroll.
              </p>
            </div>
            <Link href="/pricing" className="text-sm font-semibold text-emerald-600 hover:text-emerald-700">
              View pricing
            </Link>
          </div>
        </FadeIn>

        <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-3">
          {EXPLORE_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="min-w-[240px] shrink-0 snap-start rounded-2xl border border-slate-200 bg-slate-50 p-5 transition hover:border-emerald-300 hover:bg-white sm:min-w-0"
            >
              <h3 className="text-base font-bold text-slate-900">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.body}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
