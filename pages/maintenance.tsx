import { getClientSupportEmail } from '../lib/supportEmail';

export default function MaintenancePage() {
  const supportEmail = getClientSupportEmail();

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-16 text-white">
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
          PestTrace
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Scheduled maintenance</h1>
        <p className="mt-4 text-sm text-slate-200 sm:text-base">
          We are currently applying updates to improve reliability and performance. Please check
          back shortly.
        </p>
        <p className="mt-6 text-xs text-slate-300">
          Need urgent support? Contact support at{' '}
          <a className="text-emerald-300 underline underline-offset-2" href={`mailto:${supportEmail}`}>
            {supportEmail}
          </a>
          .
        </p>
      </div>
    </main>
  );
}

