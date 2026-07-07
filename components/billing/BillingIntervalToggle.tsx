import type { BillingInterval } from '../../lib/marketing/pricing';

type BillingIntervalToggleProps = {
  value: BillingInterval;
  onChange: (interval: BillingInterval) => void;
  className?: string;
};

export default function BillingIntervalToggle({ value, onChange, className = '' }: BillingIntervalToggleProps) {
  return (
    <div
      className={`inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 ${className}`}
      role="group"
      aria-label="Billing interval"
    >
      <button
        type="button"
        onClick={() => onChange('month')}
        aria-pressed={value === 'month'}
        className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
          value === 'month' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        Monthly
      </button>
      <button
        type="button"
        onClick={() => onChange('year')}
        aria-pressed={value === 'year'}
        className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
          value === 'year' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        Yearly
      </button>
    </div>
  );
}
