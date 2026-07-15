import { regulationUrgency } from './content';
import { FadeIn } from './ProductVisual';

export default function RegulationUrgencySection() {
  const paragraphs = regulationUrgency.body.split('\n\n');
  const lead = paragraphs[0] ?? '';
  const rest = paragraphs.slice(1);

  return (
    <section className="bg-amber-50 px-6 py-14 sm:py-20">
      <FadeIn>
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start lg:gap-16">
          <div>
            <p className="text-sm font-semibold text-amber-800">{regulationUrgency.eyebrow}</p>
            <h2 className="mt-3 text-3xl font-bold leading-tight text-amber-950 sm:text-4xl">
              {regulationUrgency.title}
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-amber-900/90">{lead}</p>
          </div>
          <div className="rounded-2xl border border-amber-200/80 bg-white/70 p-6 sm:p-8">
            {rest.map((paragraph) => (
              <p key={paragraph} className="mb-4 last:mb-0 text-base leading-relaxed text-amber-900/85">
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </FadeIn>
    </section>
  );
}
