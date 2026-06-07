import { useRouter } from 'next/router';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { useActivation } from '../../lib/hooks/useActivation';
import { ACTIVATION_MILESTONES } from '../../lib/activation/companyActivation';

const CHECKLIST_LABELS: Record<(typeof ACTIVATION_MILESTONES)[number], string> = {
  first_customer_created: 'Create first customer',
  first_site_created: 'Create first site',
  first_job_completed: 'Complete first job',
  first_photo_uploaded: 'Upload first photo',
  first_report_generated: 'Generate first report',
};

export default function OnboardingChecklist() {
  const router = useRouter();
  const { data, loading, dismissChecklist } = useActivation();

  if (loading || !data) return null;
  if (data.checklistDismissed || data.completionPercent >= 100) return null;

  const handleDismiss = async () => {
    try {
      await dismissChecklist();
    } catch {
      // Non-blocking; checklist reappears on next refresh if dismiss failed.
    }
  };

  const handleNextAction = () => {
    if (data.nextAction?.href) {
      router.push(data.nextAction.href);
    }
  };

  return (
    <Card className="mb-6 space-y-4" data-testid="onboarding-checklist">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Getting started</p>
          <h2 className="text-xl font-semibold text-navy">Onboarding checklist</h2>
          <p className="mt-1 text-sm text-slate-600">
            {data.completionPercent}% complete — finish these steps to get the most from PestTrace.
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-sm text-slate-500 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded-md shrink-0"
          aria-label="Dismiss onboarding checklist"
        >
          Dismiss
        </button>
      </div>

      <div
        className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuenow={data.completionPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Onboarding progress"
      >
        <div
          className="h-full rounded-full bg-primary-600 transition-all duration-300"
          style={{ width: `${data.completionPercent}%` }}
        />
      </div>

      <ul className="space-y-2">
        {ACTIVATION_MILESTONES.map((milestone) => {
          const done = data.milestones[milestone];
          return (
            <li
              key={milestone}
              className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${
                done ? 'border-green-200 bg-green-50 text-green-900' : 'border-zinc-200 bg-white text-slate-700'
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  done ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-600'
                }`}
                aria-hidden
              >
                {done ? '✓' : '○'}
              </span>
              <span>{CHECKLIST_LABELS[milestone]}</span>
            </li>
          );
        })}
      </ul>

      {data.nextAction ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-primary-200 bg-primary-50 p-4">
          <p className="text-sm text-primary-900">
            <span className="font-semibold">Next:</span> {data.nextAction.label}
          </p>
          <Button variant="primary" size="sm" onClick={handleNextAction}>
            Continue setup
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
