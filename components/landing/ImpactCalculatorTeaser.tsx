import Link from 'next/link';
import { impactCalculatorTeaser } from '../../lib/marketing/impactCalculatorCopy';

export default function ImpactCalculatorTeaser() {
  return (
    <section className="px-6 py-16">
      <div className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-slate-50 p-8 text-center sm:p-10">
        <h2 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">{impactCalculatorTeaser.title}</h2>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
          {impactCalculatorTeaser.body}
        </p>
        <Link
          href={impactCalculatorTeaser.href}
          className="mt-8 inline-flex rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-emerald-600"
        >
          {impactCalculatorTeaser.cta}
        </Link>
      </div>
    </section>
  );
}
