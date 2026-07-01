import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Card from '../ui/Card';
import { supabase } from '../../lib/supabase';
import { isDevPreviewMode, PREVIEW_COMPLIANCE_ALERTS } from '../../lib/devPreview';

type AlertRow = { id: string; type: string; message: string; createdAt: string };

export default function ComplianceAlertsWidget() {
  const router = useRouter();
  const isPreviewMode = router.isReady && isDevPreviewMode(router.query);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (isPreviewMode) {
        if (mounted) {
          setAlerts(PREVIEW_COMPLIANCE_ALERTS);
          setLoading(false);
        }
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (mounted) setLoading(false);
        return;
      }
      const res = await fetch('/api/compliance-alerts', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok && mounted) {
        const data = await res.json();
        setAlerts(data.alerts ?? []);
      }
      if (mounted) setLoading(false);
    }
    void load();
    return () => { mounted = false; };
  }, [isPreviewMode]);

  if (loading) return null;
  if (alerts.length === 0) return null;

  return (
    <Card className="space-y-3 border-amber-200 bg-amber-50 p-5" data-testid="compliance-alerts-widget">
      <h3 className="text-lg font-semibold text-amber-900">Compliance alerts</h3>
      <ul className="space-y-2 text-sm text-amber-950">
        {alerts.slice(0, 5).map((a) => (
          <li key={a.id} className="rounded-lg bg-white/70 px-3 py-2">{a.message}</li>
        ))}
      </ul>
    </Card>
  );
}
