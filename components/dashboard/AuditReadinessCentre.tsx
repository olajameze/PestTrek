import { useRouter } from 'next/router';
import { useState } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import type { AuditReadinessSummary } from '../../lib/api/mockDashboardData';
import { supabase } from '../../lib/supabase';

interface AuditReadinessCentreProps {
  auditReadiness?: AuditReadinessSummary;
  loading: boolean;
  canExport?: boolean;
}

export default function AuditReadinessCentre({ auditReadiness, loading, canExport = true }: AuditReadinessCentreProps) {
  const router = useRouter();
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/export/audit-pack', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) {
        throw new Error('Export failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `pesttrace-audit-pack-${Date.now()}.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      /* toast handled by caller if needed */
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card className="space-y-5" data-testid="audit-readiness-centre">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Audit readiness</p>
          <h3 className="text-xl font-semibold text-navy">Inspection preparation centre</h3>
          <p className="mt-1 text-sm text-slate-600">Last 90 days of compliance signals for your account.</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => router.push('/reports')}>
          Open reports
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading audit readiness…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-2xl border border-zinc-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Reports</p>
              <p className="mt-1 text-2xl font-semibold text-navy">{auditReadiness?.reportCount ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Missing signatures</p>
              <p className="mt-1 text-2xl font-semibold text-navy">{auditReadiness?.missingSignatures ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Expiring qualifications</p>
              <p className="mt-1 text-2xl font-semibold text-navy">{auditReadiness?.expiringQualifications ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Open issues</p>
              <p className="mt-1 text-2xl font-semibold text-navy">{auditReadiness?.openComplianceIssues ?? 0}</p>
            </div>
          </div>

          <Button variant="primary" size="sm" onClick={handleExport} disabled={exporting || !canExport}>
            {exporting ? 'Preparing audit pack…' : canExport ? 'Export audit pack' : 'Upgrade for audit pack'}
          </Button>
          {!canExport ? (
            <p className="text-xs text-slate-500">Audit pack ZIP export is available on Business and Enterprise plans.</p>
          ) : null}
        </>
      )}
    </Card>
  );
}
