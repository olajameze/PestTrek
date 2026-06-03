import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import Button from './ui/Button';

const DISMISS_KEY = 'pesttrace-tech-onboarding-dismissed';

const STEPS = [
  {
    title: 'Welcome to your logbook',
    body: 'This workspace is where you record every visit, treatment, and compliance detail for your company.',
  },
  {
    title: 'Log your first inspection',
    body: 'Use the form above to add client details, treatment type, photos, and signature. Required fields are marked with a red asterisk.',
  },
  {
    title: 'Works offline',
    body: 'If you lose signal on site, entries queue locally and sync automatically when you are back online.',
  },
];

export type OnboardingModalProps = {
  open: boolean;
  onClose: () => void;
  getSupabaseToken: () => Promise<string | null>;
};

export function isTechnicianOnboardingDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(DISMISS_KEY) === 'true';
}

export function dismissTechnicianOnboarding(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DISMISS_KEY, 'true');
}

export default function OnboardingModal({ open, onClose, getSupabaseToken }: OnboardingModalProps) {
  const [step, setStep] = useState(0);
  const [sessionOk, setSessionOk] = useState<boolean | null>(null);

  useEffect(() => {
    if (!open) return;
    const resetStep = window.setTimeout(() => setStep(0), 0);
    let cancelled = false;

    const verifySession = async () => {
      const token = await getSupabaseToken();
      if (!token) {
        if (!cancelled) setSessionOk(false);
        return;
      }
      try {
        const res = await fetch('/api/technician-profile', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancelled) setSessionOk(res.ok);
      } catch {
        if (!cancelled) setSessionOk(false);
      }
    };

    void verifySession();
    return () => {
      cancelled = true;
      window.clearTimeout(resetStep);
    };
  }, [open, getSupabaseToken]);

  const handleClose = useCallback(() => {
    dismissTechnicianOnboarding();
    onClose();
  }, [onClose]);

  const handleFinish = useCallback(() => {
    handleClose();
  }, [handleClose]);

  if (!open) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="technician-onboarding-title"
    >
      <div className="relative w-full max-w-lg rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <span className="text-sm font-semibold text-gray-700">
            Step {step + 1} of {STEPS.length}
          </span>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1.5 transition-colors hover:bg-gray-100"
            aria-label="Close onboarding"
          >
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-8">
          <h2 id="technician-onboarding-title" className="text-2xl font-bold text-navy">
            {current.title}
          </h2>
          <p className="mt-4 leading-relaxed text-gray-600">{current.body}</p>

          {sessionOk === false ? (
            <p className="mt-4 text-sm text-amber-800">
              Your session could not be verified. Sign in again if API actions fail.
            </p>
          ) : null}

          <div className="mt-6 flex gap-2">
            {STEPS.map((_, index) => (
              <div
                key={index}
                className={`h-2 w-2 rounded-full transition-all ${
                  index === step ? 'w-6 bg-primary-500' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-gray-200 px-6 py-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            <ChevronLeft className="mr-1 inline h-4 w-4" />
            Previous
          </Button>
          <div className="flex-1" />
          {isLast ? (
            <Button type="button" onClick={handleFinish}>
              Get started
            </Button>
          ) : (
            <Button type="button" onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
              Next
              <ChevronRight className="ml-1 inline h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
