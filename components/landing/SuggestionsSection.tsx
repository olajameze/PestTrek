import { useState } from 'react';
import Button from '../ui/Button';

const CATEGORIES = [
  { value: 'Chemical tracking', label: 'Chemical tracking' },
  { value: 'Reporting', label: 'Reporting' },
  { value: 'Certifications', label: 'Certifications' },
  { value: 'Mobile app', label: 'Mobile app' },
  { value: 'Other', label: 'Other' },
] as const;

export default function SuggestionsSection() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [category, setCategory] = useState<string>('Reporting');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || undefined,
          email: email.trim() || undefined,
          suggestion: suggestion.trim(),
          category,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = typeof data.error === 'string' ? data.error : 'Something went wrong.';
        setError(msg);
        return;
      }
      setName('');
      setEmail('');
      setSuggestion('');
      setCategory('Reporting');
      setDone(true);
    } catch {
      setError('Please try again later');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      id="suggestions"
      data-testid="landing-suggestions-section"
      className="border-y border-slate-200 bg-white px-6 py-24"
    >
      <div className="mx-auto max-w-2xl">
        <h2 className="text-center text-3xl font-bold text-slate-900 sm:text-4xl">
          Got an idea for a compliance feature?
        </h2>
        <p className="mt-4 text-center text-lg text-slate-600">
          Tell us what would make audits and field paperwork easier. No account required.
        </p>

        {done ? (
          <div
            data-testid="suggestions-thank-you"
            className="mt-10 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center text-emerald-950"
          >
            <p className="font-semibold">Thank you. We read every suggestion.</p>
            <p className="mt-2 text-sm text-emerald-900">
              If you shared an email, we may follow up about roadmap fit (never for spam).
            </p>
            <button
              type="button"
              className="mt-4 text-sm font-semibold text-emerald-800 underline"
              onClick={() => setDone(false)}
            >
              Submit another idea
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-10 space-y-5">
            <div>
              <label htmlFor="suggestion-name" className="block text-sm font-medium text-slate-700">
                Name <span className="text-slate-400">(optional)</span>
              </label>
              <input
                id="suggestion-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label htmlFor="suggestion-email" className="block text-sm font-medium text-slate-700">
                Email <span className="text-slate-400">(optional)</span>
              </label>
              <input
                id="suggestion-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label htmlFor="suggestion-category" className="block text-sm font-medium text-slate-700">
                Category
              </label>
              <select
                id="suggestion-category"
                data-testid="suggestion-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="suggestion-body" className="block text-sm font-medium text-slate-700">
                Your suggestion <span className="text-red-500">*</span>
              </label>
              <textarea
                id="suggestion-body"
                data-testid="suggestion-body"
                required
                rows={5}
                value={suggestion}
                onChange={(e) => setSuggestion(e.target.value)}
                placeholder="Describe the compliance workflow or report you need (min. 10 characters)."
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
              />
            </div>
            {error ? (
              <div data-testid="suggestions-error" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            ) : null}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button type="submit" data-testid="suggestion-submit" disabled={submitting} variant="success">
                {submitting ? 'Sending…' : 'Submit suggestion'}
              </Button>
              <p className="text-sm text-slate-500">
                Optional email only if you want a reply about roadmap fit.
              </p>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
