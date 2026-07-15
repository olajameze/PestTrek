import Link from 'next/link';
import { complianceWorkflow } from '../../lib/marketing/complianceCopy';
import { jobRecordFieldsCopy } from './content';
import { FadeIn } from './ProductVisual';

export default function JobRecordFieldsSection() {
  return (
    <section className="bg-slate-50 px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <FadeIn>
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">{jobRecordFieldsCopy.title}</h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-600">{jobRecordFieldsCopy.intro}</p>
          </div>
        </FadeIn>

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {complianceWorkflow.fieldGroups.map((group) => (
            <FadeIn key={group.title}>
              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <h3 className="text-base font-bold text-slate-900">{group.title}</h3>
                <ul className="mt-4 space-y-2 text-sm text-slate-600">
                  {group.fields.map((field) => (
                    <li key={field} className="flex gap-2">
                      <span className="text-slate-400" aria-hidden>
                        ·
                      </span>
                      <span>{field}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn>
          <p className="mt-10 text-sm text-slate-500">
            {jobRecordFieldsCopy.caption}{' '}
            <Link href="/dashboard?preview=1" className="font-semibold text-emerald-700 underline-offset-2 hover:underline">
              Open the demo dashboard
            </Link>
            .
          </p>
        </FadeIn>
      </div>
    </section>
  );
}
