import Link from 'next/link';
import { impactCalculatorTeaser } from '../../lib/marketing/impactCalculatorCopy';
import { FadeIn } from './ProductVisual';

export default function ImpactCalculatorTeaser() {
  return (
    <section className="px-6 py-12">
      <FadeIn>
        <div className="mx-auto flex max-w-6xl flex-col gap-6 rounded-2xl bg-emerald-600 px-8 py-8 text-white sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <div className="max-w-xl">
            <h2 className="text-xl font-bold sm:text-2xl">{impactCalculatorTeaser.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-emerald-50 sm:text-base">{impactCalculatorTeaser.body}</p>
          </div>
          <Link
            href={impactCalculatorTeaser.href}
            className="inline-flex shrink-0 rounded-xl bg-white px-6 py-3 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50"
          >
            {impactCalculatorTeaser.cta}
          </Link>
        </div>
      </FadeIn>
    </section>
  );
}
