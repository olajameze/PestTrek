import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { supabase } from '../lib/supabase';
import Sidebar from '../components/sidebar';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { hasSubscriptionAccess } from '../lib/subscriptionAccess';
import { isCompanyOwnerSession } from '../lib/auth/resolveWorkspaceRoute';
import { canUseSmartScheduling } from '../lib/scheduling/planAccess';
import { usePermissions } from '../hooks/usePermissions';

const SchedulingCalendar = dynamic(() => import('../components/scheduling/SchedulingCalendar'), {
  ssr: false,
  loading: () => <Skeleton className="h-[720px] w-full" />,
});

type CompanySnapshot = {
  id: string;
  plan: string | null;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
  paymentGraceEndsAt: string | null;
};

export default function SchedulingPage() {
  const router = useRouter();
  const permissions = usePermissions();
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<CompanySnapshot | null>(null);
  const [role, setRole] = useState<'owner' | 'technician'>('owner');

  useEffect(() => {
    let mounted = true;

    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/auth/signin');
        return;
      }

      const ownerRes = await fetch('/api/company', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const companyData = ownerRes.ok ? await ownerRes.json() : null;
      const owner = isCompanyOwnerSession(session.user.email, companyData);

      if (owner && companyData) {
        if (mounted) {
          setCompany({
            id: companyData.id ?? '',
            plan: companyData.plan ?? null,
            subscriptionStatus: companyData.subscriptionStatus ?? null,
            trialEndsAt: companyData.trialEndsAt ?? null,
            paymentGraceEndsAt: companyData.paymentGraceEndsAt ?? null,
          });
          setRole('owner');
        }
      } else {
        const profileRes = await fetch('/api/technician-profile', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (profileRes.ok) {
          const profile = await profileRes.json();
          const subscriptionRes = await fetch('/api/subscription', {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          const subscriptionData = subscriptionRes.ok ? await subscriptionRes.json() : null;
          if (mounted) {
            setCompany({
              id: profile.companyId,
              plan: subscriptionData?.plan ?? null,
              subscriptionStatus: subscriptionData?.subscriptionStatus ?? null,
              trialEndsAt: subscriptionData?.trialEndsAt ?? null,
              paymentGraceEndsAt: subscriptionData?.paymentGraceEndsAt ?? null,
            });
            setRole('technician');
          }
        } else {
          router.replace('/auth/signin');
          return;
        }
      }

      if (mounted) setLoading(false);
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [router]);

  const canWrite = permissions.can('write', 'scheduling');
  const hasAccess = company ? hasSubscriptionAccess(company) : false;
  const hasScheduling = company ? canUseSmartScheduling(company.plan) : false;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex">
        <Sidebar activeTab="scheduling" role={role} />
        <main className="min-h-screen flex-1 p-4 pt-20 lg:ml-64 lg:p-8 lg:pt-8">
          {loading ? (
            <Skeleton className="h-[720px] w-full" />
          ) : !hasAccess ? (
            <Card className="max-w-xl space-y-4">
              <h1 className="text-2xl font-semibold text-navy">Scheduling unavailable</h1>
              <p className="text-sm text-slate-600">Your subscription is inactive. Upgrade to continue using Pest Trace.</p>
              <Link href="/upgrade">
                <Button>Upgrade</Button>
              </Link>
            </Card>
          ) : !hasScheduling ? (
            <Card className="max-w-xl space-y-4">
              <h1 className="text-2xl font-semibold text-navy">Smart Scheduling</h1>
              <p className="text-sm text-slate-600">
                Smart Scheduling is available on Business and Enterprise plans. Your operational Today&apos;s schedule widget on the dashboard remains available on your current plan.
              </p>
              <Link href="/upgrade">
                <Button>Upgrade to Business</Button>
              </Link>
            </Card>
          ) : (
            <SchedulingCalendar canWrite={canWrite} />
          )}
        </main>
      </div>
    </div>
  );
}
