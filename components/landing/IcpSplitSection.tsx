import Link from 'next/link';
import { icpSegments } from './content';
import { FadeIn } from './ProductVisual';

export default function IcpSplitSection() {
  return (
    <section id="who-its-for" className="border-t border-slate-100 bg-slate-50 px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <FadeIn>
          <div className="mb-12 max-w-2xl">
            <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">Who it fits</h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-600">
              One person with a van or a growing fleet. Same product, different plan when you need more visibility.
            </p>
          </div>
        </FadeIn>

        <div className="space-y-6">
          {icpSegments.map((segment, idx) => (
            <FadeIn key={segment.title}>
              <article
                className={`rounded-2xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10 ${
                  idx === 1 ? 'lg:ml-12' : 'lg:mr-12'
                }`}
              >
                <div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
                  <div className="lg:w-2/5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">{segment.planHint}</p>
                    <h3 className="mt-2 text-2xl font-bold text-slate-900">{segment.title}</h3>
                    <p className="mt-4 text-sm leading-relaxed text-slate-700">{segment.fits}</p>
                    <div className="mt-6 flex flex-wrap gap-3">
                      <Link
                        href={segment.cta.href}
                        className="inline-flex rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        {segment.cta.label}
                      </Link>
                      <Link
                        href="/pricing"
                        className="inline-flex rounded-xl bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-200"
                      >
                        View pricing
                      </Link>
                    </div>
                  </div>
                  <ul className="lg:w-3/5 space-y-3 text-slate-600">
                    {segment.pains.map((pain, painIdx) => (
                      <li key={`${segment.title}-${painIdx}`} className="flex gap-3 leading-relaxed">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden />
                        <span>{pain}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
