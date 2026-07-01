import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

type PortalData = {
  customer: { name: string; companyName: string | null };
  sites: { id: string; address: string; postcode: string | null; label: string | null }[];
  jobs: { id: string; date: string; treatment: string; address: string; postcode: string | null }[];
  upcoming: { id: string; scheduledStart: string; address: string; treatment: string | null }[];
};

function PortalContent({ data }: { data: PortalData }) {
  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">{data.customer.companyName}</p>
        <h1 className="text-2xl font-semibold text-navy">Welcome, {data.customer.name}</h1>
        <p className="mt-2 text-sm text-slate-600">Your service history and upcoming visits.</p>
      </header>
      {data.upcoming.length > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-navy">Upcoming visits</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {data.upcoming.map((a) => (
              <li key={a.id} className="rounded-lg bg-slate-50 p-3">
                {new Date(a.scheduledStart).toLocaleString('en-GB')} — {a.address}
                {a.treatment ? ` (${a.treatment})` : ''}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-navy">Completed treatments</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {data.jobs.map((j) => (
            <li key={j.id} className="rounded-lg border border-slate-100 p-3">
              <p className="font-medium">{j.treatment}</p>
              <p className="text-slate-600">{j.address}{j.postcode ? `, ${j.postcode}` : ''}</p>
              <p className="text-slate-500">{new Date(j.date).toLocaleDateString('en-GB')}</p>
            </li>
          ))}
        </ul>
        {data.jobs.length === 0 ? <p className="mt-2 text-sm text-slate-500">No completed jobs yet.</p> : null}
      </section>
    </div>
  );
}

export default function PortalAccessPage() {
  const router = useRouter();
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const { customerId, exp, sig } = router.query;
    if (typeof customerId !== 'string' || typeof exp !== 'string' || typeof sig !== 'string') return;
    fetch(`/api/portal?customerId=${encodeURIComponent(customerId)}&exp=${encodeURIComponent(exp)}&sig=${encodeURIComponent(sig)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Link expired or invalid');
        return res.json();
      })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Unable to open portal'));
  }, [router.query]);

  return (
    <>
      <Head><title>Client portal | Pest Trace</title></Head>
      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-3xl">
          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{error}</p>
          ) : !data ? (
            <p className="text-slate-600">Loading portal…</p>
          ) : (
            <PortalContent data={data} />
          )}
        </div>
      </div>
    </>
  );
}
