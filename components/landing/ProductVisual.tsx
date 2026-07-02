import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

export default function ProductVisual({ type }: { type: string }) {
  if (type === 'mobile-app-ui') {
    return (
      <div className="relative mx-auto h-[450px] w-64 overflow-hidden rounded-[2.5rem] border-[6px] border-slate-800 bg-slate-900 shadow-2xl">
        <div className="absolute left-1/2 top-0 z-10 h-5 w-24 -translate-x-1/2 rounded-b-xl bg-slate-800" />
        <div className="h-full bg-white p-4 pt-10">
          <div className="mb-4 h-3 w-20 rounded bg-slate-100" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="mb-2 flex items-center gap-2 rounded-xl border border-slate-100 p-3">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-emerald-100">
                <div className="h-2 w-2 rounded-full bg-emerald-600" />
              </div>
              <div className="flex-1 space-y-1.5">
                <div className="h-1.5 w-full rounded bg-slate-100" />
                <div className="h-1.5 w-2/3 rounded bg-slate-50" />
              </div>
            </div>
          ))}
          <div className="absolute bottom-4 left-4 right-4 flex h-10 items-center justify-center rounded-lg bg-emerald-500 text-xs font-bold text-white">
            Capture Job Details
          </div>
        </div>
      </div>
    );
  }

  if (type === 'dashboard-view') {
    return (
      <div className="flex aspect-video w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="w-16 space-y-3 border-r border-slate-100 bg-slate-50 p-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="aspect-square w-full rounded-lg bg-slate-200" />
          ))}
        </div>
        <div className="flex-1 p-4">
          <div className="mb-6 flex justify-between">
            <div className="h-4 w-32 rounded bg-slate-100" />
            <div className="h-4 w-16 rounded bg-emerald-100" />
          </div>
          <div className="mb-6 grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-lg border border-slate-100 bg-slate-50" />
            ))}
          </div>
          <div className="relative h-32 overflow-hidden rounded-lg border border-slate-100 bg-slate-50">
            <div className="absolute bottom-0 left-0 right-0 flex h-16 items-end gap-1 bg-emerald-500/10 px-2">
              {[40, 70, 45, 90, 65, 80, 50].map((h, i) => (
                <div key={i} style={{ height: `${h}%` }} className="flex-1 rounded-t-sm bg-emerald-500" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'report-preview') {
    return (
      <div className="mx-auto aspect-[1/1.2] w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-lg">
        <div className="mb-6 flex items-center justify-between border-b-2 border-slate-900 pb-4">
          <div className="text-xs font-bold uppercase tracking-widest text-slate-400">Compliance Report</div>
          <div className="h-6 w-6 rounded bg-emerald-500" />
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="h-2 w-1/3 rounded bg-slate-200" />
            <div className="h-4 w-full rounded bg-slate-100" />
          </div>
          <div className="flex h-24 w-full items-center justify-center rounded-lg border border-dashed border-slate-200 text-xs italic text-slate-300">
            Photo Evidence
          </div>
          <div className="border-t border-slate-100 pt-8">
            <div className="flex h-10 w-32 items-end rounded border border-slate-100 bg-slate-50 p-2">
              <div className="h-px w-full bg-slate-300" />
            </div>
            <div className="mt-2 text-[10px] text-slate-400">Technician Signature</div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export const FadeIn = ({ children, delay = 0 }: { children: ReactNode; delay?: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-50px' }}
    transition={{ duration: 0.6, delay }}
  >
    {children}
  </motion.div>
);
