import Link from 'next/link';
import Image from 'next/image';
import { productProofPanels } from '../../lib/marketing/productProof';
import ProductVisual, { FadeIn } from './ProductVisual';

export default function ProductProofSection() {
  return (
    <section className="border-y border-slate-100 bg-white px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <FadeIn>
          <div className="mb-16 max-w-xl">
            <p className="text-sm font-semibold text-emerald-600">Inside the product</p>
            <h2 className="mt-3 text-3xl font-bold leading-tight text-slate-900 sm:text-4xl">
              From the van to the audit folder
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-600">
              Every screen is shaped around pest control compliance, not a generic project tool with a green logo slapped
              on.
            </p>
          </div>
        </FadeIn>

        <div className="space-y-20">
          {productProofPanels.map((panel, idx) => {
            const reversed = idx % 2 === 1;
            return (
              <FadeIn key={panel.title}>
                <article
                  className={`flex flex-col gap-10 lg:items-center ${
                    reversed ? 'lg:flex-row-reverse' : 'lg:flex-row'
                  }`}
                >
                  <div className="lg:w-1/2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {String(idx + 1).padStart(2, '0')}
                    </p>
                    <h3 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">{panel.title}</h3>
                    <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">{panel.caption}</p>
                  </div>
                  <div className="lg:w-1/2">
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-sm">
                      {panel.videoSrc ? (
                        <video
                          controls
                          playsInline
                          preload="metadata"
                          className="h-auto w-full rounded-xl bg-slate-900"
                          aria-label={panel.imageAlt ?? panel.title}
                        >
                          <source src={panel.videoSrc} type="video/mp4" />
                          Your browser does not support the video tag.
                        </video>
                      ) : panel.imageSrc ? (
                        <Image
                          src={panel.imageSrc}
                          alt={panel.imageAlt ?? panel.title}
                          width={640}
                          height={480}
                          className="h-auto w-full rounded-xl"
                        />
                      ) : (
                        <ProductVisual type={panel.visual} />
                      )}
                    </div>
                  </div>
                </article>
              </FadeIn>
            );
          })}
        </div>

        <FadeIn>
          <div className="mt-16 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-6">
            <Link
              href="/dashboard?preview=1"
              className="inline-flex rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Open the demo dashboard
            </Link>
            <p className="text-sm text-slate-500">Read only preview. No account needed.</p>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
