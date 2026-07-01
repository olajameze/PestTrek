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
import {
  isDevPreviewMode,
  PREVIEW_COMPANY,
  PREVIEW_CUSTOMERS,
  PREVIEW_PORTAL_URL,
} from '../lib/devPreview';

type CustomerRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  portalEnabled: boolean;
  sites: { id: string; label: string | null; address: string; postcode: string | null }[];
  _count: { logbookEntries: number; invoices: number };
};

export default function CustomersPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const isPreviewMode = router.isReady && isDevPreviewMode(router.query);
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [company, setCompany] = useState<{ plan: string | null; subscriptionStatus: string | null; trialEndsAt: string | null; paymentGraceEndsAt: string | null } | null>(null);
  const [selected, setSelected] = useState<CustomerRow | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [siteForm, setSiteForm] = useState({ address: '', postcode: '', label: '' });
  const [portalUrl, setPortalUrl] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function loadCustomers(token: string) {
    const res = await fetch('/api/customers', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to load customers');
    const data = await res.json();
    setCustomers(data.customers ?? []);
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
        setCustomers(JSON.parse(JSON.stringify(PREVIEW_CUSTOMERS)) as CustomerRow[]);
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
        await loadCustomers(session.access_token);
      }
      if (mounted) setLoading(false);
    }
    void init();
    return () => { mounted = false; };
  }, [router, router.isReady, isPreviewMode]);

  const hasBusiness = isPreviewMode || (company ? canUseBusinessFeatures(company.plan) && hasSubscriptionAccess(company) : false);

  async function createCustomer() {
    setError('');
    if (isPreviewMode) {
      const id = `cust-preview-${Date.now()}`;
      setCustomers((prev) => [
        ...prev,
        {
          id,
          name: form.name || 'New customer',
          email: form.email || null,
          phone: form.phone || null,
          portalEnabled: false,
          sites: [],
          _count: { logbookEntries: 0, invoices: 0 },
        },
      ]);
      setForm({ name: '', email: '', phone: '' });
      showToast('Preview mode', 'Customer added locally in preview mode.', 'success');
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? 'Failed to create customer');
      return;
    }
    setForm({ name: '', email: '', phone: '' });
    await loadCustomers(session.access_token);
  }

  async function addSite(customerId: string) {
    if (isPreviewMode) {
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === customerId
            ? {
                ...c,
                sites: [
                  ...c.sites,
                  {
                    id: `site-preview-${Date.now()}`,
                    label: siteForm.label || null,
                    address: siteForm.address || 'New site',
                    postcode: siteForm.postcode || null,
                  },
                ],
              }
            : c,
        ),
      );
      setSiteForm({ address: '', postcode: '', label: '' });
      showToast('Preview mode', 'Site added locally in preview mode.', 'success');
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch('/api/sites', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId, ...siteForm }),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? 'Failed to add site');
      return;
    }
    setSiteForm({ address: '', postcode: '', label: '' });
    await loadCustomers(session.access_token);
  }

  async function portalAction(customerId: string, action: 'enable' | 'regenerate') {
    if (isPreviewMode) {
      setPortalUrl(typeof window !== 'undefined' ? `${window.location.origin}${PREVIEW_PORTAL_URL}` : PREVIEW_PORTAL_URL);
      setCustomers((prev) => prev.map((c) => (c.id === customerId ? { ...c, portalEnabled: true } : c)));
      showToast('Preview mode', action === 'enable' ? 'Portal link copied for demo.' : 'Portal link regenerated (demo).', 'info');
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch(`/api/customers/${customerId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ portalAction: action }),
    });
    const data = await res.json();
    if (data.portal?.portalUrl) setPortalUrl(data.portal.portalUrl);
    await loadCustomers(session.access_token);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {isPreviewMode ? <DevPreviewBanner /> : null}
      <div className="flex">
        <Sidebar activeTab="customers" role="owner" previewMode={isPreviewMode} />
        <main className="min-h-screen flex-1 p-4 pt-20 lg:ml-64 lg:p-8 lg:pt-8">
          {loading ? (
            <Skeleton className="h-96 w-full" />
          ) : !hasBusiness ? (
            <Card className="max-w-xl space-y-4 p-6">
              <h1 className="text-2xl font-semibold text-navy">Customers & sites</h1>
              <p className="text-sm text-slate-600">Customer CRM is available on Business and Enterprise plans.</p>
              <Link href="/upgrade"><Button>Upgrade to Business</Button></Link>
            </Card>
          ) : (
            <div className="mx-auto max-w-6xl space-y-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h1 className="text-2xl font-semibold text-navy">Customers & sites</h1>
                <Link href={isPreviewMode ? '/invoices?preview=1' : '/invoices'} className="text-sm font-medium text-primary-600 hover:underline">Invoices</Link>
              </div>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-navy">Add customer</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <Button className="mt-4" onClick={() => void createCustomer()}>Create customer</Button>
              </Card>
              <div className="grid gap-4 lg:grid-cols-2">
                {customers.map((c) => (
                  <Card key={c.id} className="p-5">
                    <button type="button" className="w-full text-left" onClick={() => setSelected(selected?.id === c.id ? null : c)}>
                      <h3 className="text-lg font-semibold text-navy">{c.name}</h3>
                      <p className="text-sm text-slate-600">{c.email ?? 'No email'} · {c.sites.length} site(s) · {c._count.logbookEntries} jobs</p>
                    </button>
                    {selected?.id === c.id ? (
                      <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                        <ul className="space-y-1 text-sm text-slate-700">
                          {c.sites.map((s) => (
                            <li key={s.id}>{s.label ? `${s.label}: ` : ''}{s.address}{s.postcode ? `, ${s.postcode}` : ''}</li>
                          ))}
                        </ul>
                        <div className="grid gap-2 sm:grid-cols-3">
                          <input className="rounded border px-2 py-1 text-sm" placeholder="Site label" value={siteForm.label} onChange={(e) => setSiteForm({ ...siteForm, label: e.target.value })} />
                          <input className="rounded border px-2 py-1 text-sm sm:col-span-2" placeholder="Address" value={siteForm.address} onChange={(e) => setSiteForm({ ...siteForm, address: e.target.value })} />
                          <input className="rounded border px-2 py-1 text-sm" placeholder="Postcode" value={siteForm.postcode} onChange={(e) => setSiteForm({ ...siteForm, postcode: e.target.value })} />
                        </div>
                        <Button variant="secondary" onClick={() => void addSite(c.id)}>Add site</Button>
                        {(company?.plan === 'enterprise' || isPreviewMode) ? (
                          <div className="flex flex-wrap gap-2">
                            <Button variant="secondary" onClick={() => void portalAction(c.id, 'enable')}>Enable portal</Button>
                            <Button variant="secondary" onClick={() => void portalAction(c.id, 'regenerate')}>Regenerate link</Button>
                            {isPreviewMode ? (
                              <Link href={PREVIEW_PORTAL_URL} className="text-sm font-medium text-primary-600 hover:underline self-center">
                                Open demo portal
                              </Link>
                            ) : null}
                          </div>
                        ) : null}
                        {portalUrl && c.portalEnabled ? (
                          <p className="break-all text-xs text-slate-500">Portal: {portalUrl}</p>
                        ) : null}
                      </div>
                    ) : null}
                  </Card>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
