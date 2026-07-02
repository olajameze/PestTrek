import Link from 'next/link';
import { icpSegments } from './content';

export default function IcpSplitSection() {
  return (
    <section id="who-its-for" className="py-24 px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 text-center">
          <h2 className="mb-4 text-3xl font-extrabold sm:text-5xl">Built for how you run your business</h2>
          <p className="mx-auto max-w-2xl text-lg text-slate-500">
            Whether you are a one-person operation or managing a growing fleet, PestTrace scales with your compliance
            needs.
          </p>
        </div>
        <div className="grid gap-8 md:grid-cols-2">
          {icpSegments.map((segment) => (
            <article
              key={segment.title}
              className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm"
            >
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">{segment.planHint}</p>
              <h3 className="mt-2 text-2xl font-bold text-slate-900">{segment.title}</h3>
              <ul className="mt-6 space-y-3 text-slate-600">
                {segment.pains.map((pain, index) => (
                  <li key={`${segment.title}-${index}`} className="flex gap-3">
                    <span className="text-amber-500 shrink-0">•</span>
                    <span>{pain}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-sm font-medium leading-relaxed text-slate-700">{segment.fits}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href={segment.cta.href}
                  className="inline-flex rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  {segment.cta.label}
                </Link>
                <a
                  href="#pricing"
                  className="inline-flex rounded-xl bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-200"
                >
                  View pricing
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
