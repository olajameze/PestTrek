import { regulationUrgency } from './content';
import { FadeIn } from './ProductVisual';

export default function RegulationUrgencySection() {
  return (
    <section className="border-y border-amber-100 bg-amber-50 px-6 py-16">
      <FadeIn>
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-4 text-3xl font-extrabold text-amber-900">{regulationUrgency.title}</h2>
          {regulationUrgency.body.split('\n\n').map((paragraph) => (
            <p key={paragraph} className="mb-4 text-lg leading-relaxed text-amber-800 opacity-90">
              {paragraph}
            </p>
          ))}
        </div>
      </FadeIn>
    </section>
  );
}
