import Link from 'next/link';
import { teamRoleHighlights } from './content';
import { FadeIn } from './ProductVisual';

export default function TeamsSection() {
  return (
    <section className="border-y border-slate-100 bg-slate-50 px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <FadeIn>
          <div className="mb-14 text-center">
            <h1 className="mb-4 text-4xl font-extrabold sm:text-5xl">Built for owners and field teams</h1>
            <p className="mx-auto max-w-2xl text-lg text-slate-500">
              One platform with the right access for each role — secure sign-in, guided technician onboarding, and a
              single source of truth for compliance.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-2">
            {teamRoleHighlights.map((block) => (
              <article key={block.role} className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">{block.audience}</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">{block.role}</h2>
                <ul className="mt-6 space-y-3 text-slate-600">
                  {block.points.map((point) => (
                    <li key={point} className="flex gap-3">
                      <span className="text-emerald-500">✓</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={block.cta.href}
                  className="mt-8 inline-flex rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  {block.cta.label}
                </Link>
              </article>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
