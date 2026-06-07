import { supabase } from '../supabase';
import type { ActivationMilestone } from '../activation/companyActivation';

export type ActivationApiResponse = {
  completionPercent: number;
  score: number;
  milestones: Record<ActivationMilestone, boolean>;
  events: Record<ActivationMilestone, string | null>;
  nextAction: {
    label: string;
    href: string;
    milestone: ActivationMilestone;
  } | null;
  checklistDismissed: boolean;
  checklistDismissedAt: string | null;
  completed: Array<{ milestone: ActivationMilestone; label: string; completedAt: string | null }>;
  remaining: Array<{ milestone: ActivationMilestone; label: string }>;
};

async function authHeaders(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not signed in');
  }
  return { Authorization: `Bearer ${session.access_token}` };
}

export async function fetchActivation(): Promise<ActivationApiResponse> {
  const res = await fetch('/api/activation', {
    headers: await authHeaders(),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json() as Promise<ActivationApiResponse>;
}

export async function recordReportGenerated(): Promise<{ recorded: boolean; firstReportGeneratedAt: string }> {
  const res = await fetch('/api/activation/report-generated', {
    method: 'POST',
    headers: await authHeaders(),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json() as Promise<{ recorded: boolean; firstReportGeneratedAt: string }>;
}

export async function dismissActivationChecklist(): Promise<ActivationApiResponse> {
  const res = await fetch('/api/activation', {
    method: 'PATCH',
    headers: {
      ...(await authHeaders()),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'dismiss_checklist' }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json() as Promise<ActivationApiResponse>;
}
