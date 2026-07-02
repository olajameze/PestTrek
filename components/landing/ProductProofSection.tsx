import Link from 'next/link';
import Image from 'next/image';
import { productProofPanels } from '../../lib/marketing/productProof';

type ProductVisualProps = {
  type: string;
};

function ProductVisual({ type }: ProductVisualProps) {
  if (type === 'mobile-app-ui') {
    return (
      <div className="relative w-64 h-[450px] bg-slate-900 rounded-[2.5rem] border-[6px] border-slate-800 shadow-2xl overflow-hidden mx-auto">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 bg-slate-800 rounded-b-xl z-10" />
        <div className="p-4 pt-10 bg-white h-full">
          <div className="h-3 w-20 bg-slate-100 rounded mb-4" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-3 border border-slate-100 rounded-xl mb-2 flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-emerald-100 flex items-center justify-center">
                <div className="w-2 h-2 bg-emerald-600 rounded-full" />
              </div>
              <div className="flex-1 space-y-1.5">
                <div className="h-1.5 w-full bg-slate-100 rounded" />
                <div className="h-1.5 w-2/3 bg-slate-50 rounded" />
              </div>
            </div>
          ))}
          <div className="absolute bottom-4 left-4 right-4 h-10 bg-emerald-500 rounded-lg flex items-center justify-center font-bold text-white text-xs">
            Capture Job Details
          </div>
        </div>
      </div>
    );
  }

  if (type === 'dashboard-view') {
    return (
      <div className="w-full aspect-video bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden flex">
        <div className="w-16 bg-slate-50 border-r border-slate-100 p-2 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="w-full aspect-square bg-slate-200 rounded-lg" />
          ))}
        </div>
        <div className="flex-1 p-4">
          <div className="flex justify-between mb-6">
            <div className="h-4 w-32 bg-slate-100 rounded" />
            <div className="h-4 w-16 bg-emerald-100 rounded" />
          </div>
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-slate-50 border border-slate-100 rounded-lg" />
            ))}
          </div>
          <div className="h-32 bg-slate-50 border border-slate-100 rounded-lg relative overflow-hidden">
            <div className="absolute bottom-0 left-0 right-0 h-16 bg-emerald-500/10 flex items-end px-2 gap-1">
              {[40, 70, 45, 90, 65, 80, 50].map((h, i) => (
                <div key={i} style={{ height: `${h}%` }} className="flex-1 bg-emerald-500 rounded-t-sm" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'report-preview') {
    return (
      <div className="w-full aspect-[1/1.2] bg-white rounded-lg border border-slate-200 shadow-lg p-8 max-w-sm mx-auto">
        <div className="border-b-2 border-slate-900 pb-4 mb-6 flex justify-between items-center">
          <div className="font-bold text-xs uppercase tracking-widest text-slate-400">Compliance Report</div>
          <div className="h-6 w-6 bg-emerald-500 rounded" />
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="h-2 w-1/3 bg-slate-200 rounded" />
            <div className="h-4 w-full bg-slate-100 rounded" />
          </div>
          <div className="h-24 w-full border border-dashed border-slate-200 rounded-lg flex items-center justify-center italic text-slate-300 text-xs">
            Photo Evidence
          </div>
          <div className="pt-8 border-t border-slate-100">
            <div className="h-10 w-32 bg-slate-50 rounded border border-slate-100 flex items-end p-2">
              <div className="w-full h-px bg-slate-300" />
            </div>
            <div className="text-[10px] text-slate-400 mt-2">Technician Signature</div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default function ProductProofSection() {
  return (
    <section id="product-proof" className="border-y border-slate-100 bg-slate-50 py-24 px-6">
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
