import { auditScenariosCopy } from './content';
import { FadeIn } from './ProductVisual';

export default function AuditScenariosSection() {
  return (
    <section className="border-y border-slate-100 bg-white px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <FadeIn>
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">{auditScenariosCopy.title}</h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-600">{auditScenariosCopy.intro}</p>
          </div>
        </FadeIn>

        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {auditScenariosCopy.scenarios.map((scenario) => (
            <FadeIn key={scenario.title}>
              <article className="h-full rounded-2xl border border-slate-200 bg-slate-50/50 p-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{scenario.whoAsks}</p>
                <h3 className="mt-2 text-lg font-bold text-slate-900">{scenario.title}</h3>
                <p className="mt-1 text-sm font-medium text-emerald-800">{scenario.standard}</p>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  <span className="font-medium text-slate-800">They want: </span>
                  {scenario.theyWant}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  <span className="font-medium text-slate-800">You export: </span>
                  {scenario.youExport}
                </p>
              </article>
            </FadeIn>
          ))}
        </div>

        <p className="mt-10 max-w-3xl text-sm leading-relaxed text-slate-500">{auditScenariosCopy.disclaimer}</p>
      </div>
    </section>
  );
}
