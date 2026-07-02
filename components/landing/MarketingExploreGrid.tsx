import Link from 'next/link';

const EXPLORE_LINKS = [
  {
    href: '/features',
    title: 'Features',
    body: 'Field logbook, dashboard, reports, and tier-specific analytics.',
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
    body: 'Pro, Business, and Enterprise — 7-day free trial on every plan.',
  },
  {
    href: '/about',
    title: 'About',
    body: 'Who built PestTrace and why we focus on pest control compliance.',
  },
] as const;

export default function MarketingExploreGrid() {
  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">Explore PestTrace</h2>
          <p className="mx-auto mt-3 max-w-2xl text-lg text-slate-500">
            Dedicated pages for product proof, compliance depth, and pricing — not just one long scroll.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {EXPLORE_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-emerald-200 hover:shadow-md"
            >
              <h3 className="text-lg font-bold text-slate-900">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.body}</p>
              <span className="mt-4 inline-flex text-sm font-semibold text-emerald-600">Learn more →</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
