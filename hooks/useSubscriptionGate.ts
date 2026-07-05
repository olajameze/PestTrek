import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
import { hasSubscriptionAccess } from '../lib/subscriptionAccess';

export type SubscriptionState = {
  status: string;
  trialEndsAt?: string;
  paymentGraceEndsAt?: string;
  paymentFailedAt?: string;
  plan?: string;
};

export function useSubscriptionGate() {
  const router = useRouter();
  const [subscription, setSubscription] = useState<SubscriptionState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      const res = await fetch('/api/subscription', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        setLoading(false);
        return;
      }

      const data = await res.json();
      setSubscription(data);
      if (
        !hasSubscriptionAccess({
          plan: data.plan,
          subscriptionStatus: data.status,
          trialEndsAt: data.trialEndsAt,
          paymentGraceEndsAt: data.paymentGraceEndsAt,
          paymentFailedAt: data.paymentFailedAt,
        })
      ) {
        router.push('/upgrade');
        return;
      }
      setLoading(false);
    };
    run();
  }, [router]);

  return { subscription, loading };
}
