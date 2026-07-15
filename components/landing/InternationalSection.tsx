import { internationalCopy } from './content';
import { FadeIn } from './ProductVisual';

export default function InternationalSection() {
  return (
    <section className="px-6 py-16 sm:py-20">
      <FadeIn>
        <div className="mx-auto max-w-6xl rounded-2xl border border-slate-200 bg-white px-8 py-10 sm:px-12 sm:py-12">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">{internationalCopy.title}</h2>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-600 sm:text-lg">
            {internationalCopy.body}
          </p>
          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
            {internationalCopy.regions.map((region) => (
              <li key={region}>{region}</li>
            ))}
          </ul>
        </div>
      </FadeIn>
    </section>
  );
}
