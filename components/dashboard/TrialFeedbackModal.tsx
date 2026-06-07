import { useState } from 'react';
import Button from '../ui/Button';
import {
  TRIAL_FEEDBACK_REASON_LABELS,
  TRIAL_UPGRADE_FEEDBACK_REASONS,
  type TrialUpgradeFeedbackReason,
} from '../../lib/trial/upgradeFeedback';
import { supabase } from '../../lib/supabase';

interface TrialFeedbackModalProps {
  open: boolean;
  onClose: () => void;
}

export default function TrialFeedbackModal({ open, onClose }: TrialFeedbackModalProps) {
  const [reason, setReason] = useState<TrialUpgradeFeedbackReason>('just_evaluating');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const dismiss = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch('/api/trial-feedback', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'dismiss' }),
      });
    } catch {
      /* non-blocking */
    }
    onClose();
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/trial-feedback', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason, comment: comment.trim() || undefined }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || 'Failed to submit feedback');
      }
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      onClick={dismiss}
      onKeyDown={(e) => {
        if (e.key === 'Escape') dismiss();
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="trial-feedback-title"
        className="max-w-lg w-full rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="trial-feedback-title" className="text-xl font-bold text-navy">
          What is preventing you from upgrading?
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Your feedback helps us improve PestTrace. This is optional and takes less than a minute.
        </p>

        <fieldset className="mt-4 space-y-2">
          {TRIAL_UPGRADE_FEEDBACK_REASONS.map((value) => (
            <label key={value} className="flex cursor-pointer items-center gap-3 rounded-xl border border-zinc-200 px-3 py-2 text-sm">
              <input
                type="radio"
                name="trial-feedback-reason"
                value={value}
                checked={reason === value}
                onChange={() => setReason(value)}
              />
              <span>{TRIAL_FEEDBACK_REASON_LABELS[value]}</span>
            </label>
          ))}
        </fieldset>

        {reason === 'other' ? (
          <textarea
            className="mt-4 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
            rows={3}
            placeholder="Tell us more (optional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        ) : null}

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={dismiss} disabled={submitting}>
            Skip for now
          </Button>
          <Button variant="primary" onClick={submit} disabled={submitting}>
            {submitting ? 'Sending…' : 'Send feedback'}
          </Button>
        </div>
      </div>
    </div>
  );
}
