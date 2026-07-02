import Link from 'next/link';
import Image from 'next/image';
import MarketingPageShell from '../components/landing/MarketingPageShell';
import {
  COMPLIANCE_PAGE_DESCRIPTION,
  COMPLIANCE_PAGE_TITLE,
  complianceAuditPack,
  complianceDashboard,
  complianceHero,
  complianceReports,
  complianceRules,
  complianceStewardship,
  complianceWorkflow,
} from '../lib/marketing/complianceCopy';

export default function CompliancePage() {
  return (
    <MarketingPageShell
      title={`${COMPLIANCE_PAGE_TITLE} — PestTrace`}
      description={COMPLIANCE_PAGE_DESCRIPTION}
      canonicalPath="/compliance"
    >
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:py-20">
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">{complianceHero.title}</h1>
        <p className="mt-6 text-lg leading-relaxed text-slate-600 sm:text-xl">{complianceHero.subtitle}</p>

        <section className="mt-16">
          <h2 className="text-2xl font-bold text-slate-900">{complianceWorkflow.title}</h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600">{complianceWorkflow.intro}</p>
          <div className="mt-8 space-y-6">
            {complianceWorkflow.fieldGroups.map((group) => (
              <article key={group.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900">{group.title}</h3>
                <ul className="mt-4 space-y-2 text-sm text-slate-600">
                  {group.fields.map((field) => (
                    <li key={field} className="flex gap-2">
                      <span className="text-emerald-500">✓</span>
                      <span>{field}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-16 rounded-3xl border border-emerald-100 bg-emerald-50 p-8">
          <h2 className="text-2xl font-bold text-emerald-950">{complianceRules.title}</h2>
          <p className="mt-3 text-emerald-900">{complianceRules.body}</p>
          <ul className="mt-5 space-y-2 text-sm text-emerald-900">
            {complianceRules.rules.map((rule) => (
              <li key={rule} className="flex gap-2">
                <span>•</span>
                <span>{rule}</span>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-sm text-emerald-800">{complianceRules.footnote}</p>
        </section>

        <section className="mt-16">
          <h2 className="text-2xl font-bold text-slate-900">{complianceDashboard.title}</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {complianceDashboard.items.map((item) => (
              <article key={item.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="font-bold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-16 rounded-3xl border border-slate-200 bg-slate-900 p-8 text-white sm:p-10">
          <h2 className="text-2xl font-bold">{complianceAuditPack.title}</h2>
          <p className="mt-4 text-slate-300">{complianceAuditPack.intro}</p>
          <ul className="mt-6 space-y-2 text-sm text-slate-200">
            {complianceAuditPack.contents.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-emerald-400">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <Link
            href={complianceAuditPack.ctaHref}
            className="mt-8 inline-flex rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-emerald-600"
          >
            {complianceAuditPack.cta}
          </Link>
        </section>

        <section className="mt-16">
          <h2 className="text-2xl font-bold text-slate-900">{complianceStewardship.title}</h2>
          <div className="mt-4 space-y-4 text-base leading-relaxed text-slate-600">
            {complianceStewardship.paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 40)}>{paragraph}</p>
            ))}
          </div>
          <p className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {complianceStewardship.disclaimer}
          </p>
        </section>

        <section className="mt-16 rounded-3xl border border-slate-200 bg-slate-50 p-8">
          <h2 className="text-xl font-bold text-slate-900">{complianceReports.title}</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">{complianceReports.body}</p>
        </section>

        <div className="mt-12 overflow-hidden rounded-2xl border border-slate-200">
          <Image
            src="/marketing/treatment-logbook.png"
            alt="PestTrace treatment logbook with compliance export options"
            width={1200}
            height={750}
            className="w-full"
          />
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/auth/signup"
            className="inline-flex rounded-xl bg-emerald-500 px-8 py-4 text-lg font-bold text-white transition hover:bg-emerald-600"
          >
            Start Free Trial
          </Link>
        </div>
      </div>
    </MarketingPageShell>
  );
}
