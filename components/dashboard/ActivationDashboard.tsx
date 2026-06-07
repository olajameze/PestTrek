import Card from '../ui/Card';
import { useActivation } from '../../lib/hooks/useActivation';

export default function ActivationDashboard() {
  const { data, loading } = useActivation();

  if (loading) {
    return (
      <Card className="space-y-4">
        <p className="text-sm text-slate-500">Loading activation score…</p>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card className="space-y-5" data-testid="activation-dashboard">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Account activation</p>
        <h3 className="text-xl font-semibold text-navy">Activation score</h3>
      </div>

      <div className="flex flex-col items-start gap-2 rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-slate-500">Overall progress</p>
          <p className="text-3xl font-semibold text-navy">{data.score}%</p>
        </div>
        <p className="text-sm text-slate-600 sm:text-right">
          {data.completed.length} of {data.completed.length + data.remaining.length} actions complete
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h4 className="mb-2 text-sm font-semibold text-slate-700">Completed</h4>
          {data.completed.length === 0 ? (
            <p className="text-sm text-slate-500">No onboarding actions completed yet.</p>
          ) : (
            <ul className="space-y-2">
              {data.completed.map((item) => (
                <li key={item.milestone} className="rounded-2xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
                  <span className="font-medium">{item.label}</span>
                  {item.completedAt ? (
                    <span className="mt-0.5 block text-xs text-green-700">
                      {new Date(item.completedAt).toLocaleDateString()}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h4 className="mb-2 text-sm font-semibold text-slate-700">Remaining</h4>
          {data.remaining.length === 0 ? (
            <p className="text-sm text-slate-500">All activation steps are complete.</p>
          ) : (
            <ul className="space-y-2">
              {data.remaining.map((item) => (
                <li key={item.milestone} className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-slate-700">
                  {item.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}
