import Link from 'next/link';
import { pricingPlans } from './content';
import { FadeIn } from './ProductVisual';
import type { LandingPricingProps } from '../../lib/geoCurrency';
import { PRICING_TRIAL_FOOTNOTE } from '../../lib/marketingPlanFeatures';

export default function PricingSection({
  pricingGbpLabels,
  pricingApproxLabels,
  pricingFxNote,
}: LandingPricingProps) {
  return (
    <section className="bg-slate-50 px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mb-20 text-center">
          <h1 className="mb-4 text-4xl font-extrabold sm:text-5xl">Simple, transparent pricing</h1>
          <p className="text-lg text-slate-500 sm:text-xl">
            Choose a plan that fits your business and scale as you grow. All plans include a 7-day free trial — no
            contracts, no risk.
          </p>
        </div>
        <div className="grid gap-8 md:grid-cols-3">
          {pricingPlans.map((plan, idx) => (
            <FadeIn key={plan.name} delay={plan.isPopular ? 0.1 : 0}>
              <div
                className={`h-full rounded-[2rem] border bg-white p-6 sm:p-10 ${
                  plan.isPopular ? 'relative border-emerald-500 ring-4 ring-emerald-500/5' : 'border-slate-200'
                }`}
              >
                {plan.isPopular ? (
                  <span className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-4 py-1 text-sm font-bold tracking-wide text-white">
                    MOST POPULAR
                  </span>
                ) : null}
                <h2 className="mb-2 text-xl font-bold">{plan.name}</h2>
                <p className="mb-4 text-sm font-medium leading-relaxed text-slate-500">{plan.bestFor}</p>
                <div className="mb-6">
                  <div>
                    <span className="text-4xl font-black sm:text-5xl">
                      {pricingGbpLabels[idx] ?? `£${plan.price}`}
                    </span>
                    <span className="text-sm text-slate-400">{plan.cadence}</span>
                  </div>
                  {pricingApproxLabels[idx] ? (
                    <p className="mt-1 text-sm font-medium text-slate-400">{pricingApproxLabels[idx]}</p>
                  ) : null}
                </div>
                <Link
                  href={plan.href}
                  className={`mb-8 block rounded-xl py-4 text-center font-bold transition ${
                    plan.isPopular
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100 hover:bg-emerald-600'
                      : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  {plan.cta}
                </Link>
                <ul className="space-y-3 text-sm font-medium text-slate-600">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-3">
                      <span className="shrink-0 text-base text-emerald-500">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </FadeIn>
          ))}
        </div>
        <p className="mx-auto mt-12 max-w-3xl text-center text-sm leading-relaxed text-slate-500">
          {PRICING_TRIAL_FOOTNOTE}
          {pricingFxNote ? ` ${pricingFxNote}` : ''}
        </p>
      </div>
    </section>
  );
}
