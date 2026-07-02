import Link from 'next/link';
import Image from 'next/image';
import { productProofPanels } from '../../lib/marketing/productProof';
import ProductVisual from './ProductVisual';

export default function ProductProofSection() {
  return (
    <section className="border-y border-slate-100 bg-slate-50 px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mb-14 text-center">
          <h2 className="mb-4 text-3xl font-extrabold sm:text-5xl">See PestTrace in action</h2>
          <p className="mx-auto max-w-2xl text-lg text-slate-500">
            From the van to the audit folder — every screen is built for pest control compliance, not generic
            project management.
          </p>
        </div>
        <div className="grid gap-10 lg:grid-cols-3">
          {productProofPanels.map((panel) => (
            <article
              key={panel.title}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="mb-6 overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 p-4">
                {panel.videoSrc ? (
                  <video
                    controls
                    playsInline
                    preload="metadata"
                    className="h-auto w-full rounded-lg bg-slate-900"
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
                    className="h-auto w-full rounded-lg"
                  />
                ) : (
                  <ProductVisual type={panel.visual} />
                )}
              </div>
              <h3 className="text-xl font-bold text-slate-900">{panel.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{panel.caption}</p>
            </article>
          ))}
        </div>
        <div className="mt-12 text-center">
          <Link
            href="/dashboard?preview=1"
            className="inline-flex rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Explore interactive preview
          </Link>
          <p className="mt-3 text-xs text-slate-500">Read-only demo dashboard — no account required.</p>
        </div>
      </div>
    </section>
  );
}
