import Image from 'next/image';
import { featureCards } from './content';
import ProductVisual, { FadeIn } from './ProductVisual';

export default function FeaturesSection() {
  return (
    <section className="mx-auto max-w-7xl space-y-40 px-6 py-24">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="mb-4 text-4xl font-extrabold sm:text-5xl">Everything you need to stay compliant and in control</h1>
        <p className="text-lg text-slate-500">
          Field logbook, owner dashboard, and audit exports — built around pest control job records, not generic SaaS templates.
        </p>
      </div>
      {featureCards.map((feature, idx) => (
        <div
          key={feature.title}
          className={`flex flex-col items-center gap-16 md:flex-row ${idx % 2 !== 0 ? 'md:flex-row-reverse' : ''}`}
        >
          <div className="flex-1">
            <FadeIn>
              <h2 className="mb-6 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{feature.title}</h2>
              <p className="text-lg leading-relaxed text-slate-500 sm:text-xl">{feature.body}</p>
            </FadeIn>
          </div>
          <div className="w-full flex-1">
            <FadeIn delay={0.2}>
              {'screenshots' in feature && feature.screenshots?.length ? (
                <div className="space-y-4">
                  {feature.screenshots.map((shot) => (
                    <Image
                      key={shot.src}
                      src={shot.src}
                      alt={shot.alt}
                      width={1200}
                      height={750}
                      className="w-full rounded-xl border border-slate-200 shadow-xl"
                    />
                  ))}
                </div>
              ) : (
                <ProductVisual type={feature.visual} />
              )}
            </FadeIn>
          </div>
        </div>
      ))}
    </section>
  );
}
