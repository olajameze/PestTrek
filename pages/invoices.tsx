import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { supabase } from '../lib/supabase';
import Sidebar from '../components/sidebar';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import DevPreviewBanner from '../components/dev/DevPreviewBanner';
import { useToast } from '../components/ui/ToastProvider';
import { hasSubscriptionAccess } from '../lib/subscriptionAccess';
import { isCompanyOwnerSession } from '../lib/auth/resolveWorkspaceRoute';
import { canUseBusinessFeatures } from '../lib/businessFeatures/planAccess';
import { isDevPreviewMode, PREVIEW_COMPANY, PREVIEW_INVOICES } from '../lib/devPreview';

type InvoiceRow = {
  id: string;
  number: string;
  status: string;
  total: string;
  issuedAt: string;
  customer: { name: string };
};

export default function InvoicesPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const isPreviewMode = router.isReady && isDevPreviewMode(router.query);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [company, setCompany] = useState<{ plan: string | null; subscriptionStatus: string | null; trialEndsAt: string | null; paymentGraceEndsAt: string | null } | null>(null);
  const [logbookEntryId, setLogbookEntryId] = useState('');

  async function loadInvoices(token: string) {
    const res = await fetch('/api/invoices', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const data = await res.json();
    setInvoices(data.invoices ?? []);
  }

  useEffect(() => {
    if (!router.isReady) return;
    let mounted = true;

    async function init() {
      if (isPreviewMode) {
        setCompany({
          plan: PREVIEW_COMPANY.plan,
          subscriptionStatus: PREVIEW_COMPANY.subscriptionStatus,
          trialEndsAt: PREVIEW_COMPANY.trialEndsAt,
          paymentGraceEndsAt: PREVIEW_COMPANY.paymentGraceEndsAt,
        });
        setInvoices(JSON.parse(JSON.stringify(PREVIEW_INVOICES)) as InvoiceRow[]);
        if (mounted) setLoading(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/auth/signin');
        return;
      }
      const ownerRes = await fetch('/api/company', { headers: { Authorization: `Bearer ${session.access_token}` } });
      const companyData = ownerRes.ok ? await ownerRes.json() : null;
      if (!isCompanyOwnerSession(session.user.email, companyData)) {
        router.replace('/technician');
        return;
      }
      if (mounted) {
        setCompany({
          plan: companyData.plan ?? null,
          subscriptionStatus: companyData.subscriptionStatus ?? null,
          trialEndsAt: companyData.trialEndsAt ?? null,
          paymentGraceEndsAt: companyData.paymentGraceEndsAt ?? null,
        });
      }
      if (canUseBusinessFeatures(companyData.plan) && hasSubscriptionAccess(companyData)) {
        await loadInvoices(session.access_token);
      }
      if (mounted) setLoading(false);
    }
    void init();
    return () => { mounted = false; };
  }, [router, router.isReady, isPreviewMode]);

  const hasBusiness = isPreviewMode || (company ? canUseBusinessFeatures(company.plan) && hasSubscriptionAccess(company) : false);

  async function createFromJob() {
    if (isPreviewMode) {
      if (!logbookEntryId.trim()) return;
      setInvoices((prev) => [
        {
          id: `inv-preview-${Date.now()}`,
          number: `INV-${1004 + prev.length}`,
          status: 'draft',
          total: '210.00',
          issuedAt: new Date().toISOString(),
          customer: { name: 'Preview customer' },
        },
        ...prev,
      ]);
      setLogbookEntryId('');
      showToast('Preview mode', 'Invoice created locally in preview mode.', 'success');
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !logbookEntryId.trim()) return;
    const res = await fetch('/api/invoices', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ logbookEntryId: logbookEntryId.trim() }),
    });
    if (res.ok) {
      setLogbookEntryId('');
      await loadInvoices(session.access_token);
    }
  }

  async function downloadPdf(id: string) {
    if (isPreviewMode) {
      showToast('Preview mode', 'PDF download requires a signed-in Business account.', 'info');
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch(`/api/invoices/${id}/pdf`, { headers: { Authorization: `Bearer ${session.access_token}` } });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice-${id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportCsv() {
    if (isPreviewMode) {
      const header = 'ContactName,InvoiceNumber,InvoiceDate,DueDate,Description,Quantity,UnitAmount,TaxType,AccountCode';
      const rows = invoices.map(
        (inv) =>
          `"${inv.customer.name}","${inv.number}","${inv.issuedAt.slice(0, 10)}","","Pest treatment",1,${Number(inv.total).toFixed(2)},"VAT","200"`,
      );
      const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'invoices-xero-preview.csv';
      a.click();
      URL.revokeObjectURL(url);
      showToast('Preview mode', 'Sample Xero CSV downloaded.', 'success');
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch('/api/invoices/export-csv', { headers: { Authorization: `Bearer ${session.access_token}` } });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'invoices-xero.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {isPreviewMode ? <DevPreviewBanner /> : null}
      <div className="flex">
        <Sidebar activeTab="invoices" role="owner" previewMode={isPreviewMode} />
        <main className="min-h-screen flex-1 p-4 pt-20 lg:ml-64 lg:p-8 lg:pt-8">
          {loading ? (
            <Skeleton className="h-96 w-full" />
          ) : !hasBusiness ? (
            <Card className="max-w-xl space-y-4 p-6">
              <h1 className="text-2xl font-semibold text-navy">Invoices</h1>
              <p className="text-sm text-slate-600">Invoicing is available on Business and Enterprise plans.</p>
              <Link href="/upgrade"><Button>Upgrade to Business</Button></Link>
            </Card>
          ) : (
            <div className="mx-auto max-w-4xl space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-semibold text-navy">Invoices</h1>
                <div className="flex gap-2">
                  <Link href={isPreviewMode ? '/customers?preview=1' : '/customers'} className="text-sm font-medium text-primary-600 hover:underline">Customers</Link>
                  <Button variant="secondary" onClick={() => void exportCsv()}>Export CSV (Xero)</Button>
                </div>
              </div>
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-navy">Create from completed job</h2>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                  <input className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Logbook entry ID" value={logbookEntryId} onChange={(e) => setLogbookEntryId(e.target.value)} />
                  <Button onClick={() => void createFromJob()}>Create invoice</Button>
                </div>
              </Card>
              <Card className="overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Number</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Total</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="border-t border-slate-100">
                        <td className="px-4 py-3 font-medium">{inv.number}</td>
                        <td className="px-4 py-3">{inv.customer.name}</td>
                        <td className="px-4 py-3 capitalize">{inv.status}</td>
                        <td className="px-4 py-3">£{Number(inv.total).toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <button type="button" className="text-primary-600 hover:underline" onClick={() => void downloadPdf(inv.id)}>PDF</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {invoices.length === 0 ? <p className="p-6 text-sm text-slate-500">No invoices yet.</p> : null}
              </Card>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
