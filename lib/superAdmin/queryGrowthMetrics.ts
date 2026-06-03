import { prisma } from '../prisma';
import { billingRowsByNormalizedEmail } from './billingForUserEmails';
import { normalizeAuthEmail } from '../auth/userSession';

const TRIAL_WINDOW_DAYS = 14;

export type GrowthMarketingRow = {
  email: string;
  fullName: string | null;
  businessName: string | null;
  createdAt: string;
  billingPlan: string | null;
  billingSubscriptionStatus: string | null;
  hasAuthUser: boolean;
  logbookCount: number;
};

export type GrowthMetrics = {
  generatedAt: string;
  funnel: {
    marketingSignups: number;
    companies: number;
    activePaid: number;
    trialing: number;
    pastDue: number;
    withLogbook: number;
    marketingWithoutLogbook: number;
  };
  trialsEndingSoon: Array<{
    email: string;
    name: string | null;
    trialEndsAt: string;
    plan: string | null;
    logbookCount: number;
  }>;
  pastDueCompanies: Array<{
    email: string;
    name: string | null;
    paymentFailedAt: string | null;
    plan: string | null;
  }>;
  zeroLogbookCompanies: Array<{
    email: string;
    name: string | null;
    createdAt: string;
    subscriptionStatus: string | null;
  }>;
  marketingLeads: GrowthMarketingRow[];
};

export async function queryGrowthMetrics(): Promise<GrowthMetrics> {
  const now = new Date();
  const trialCutoff = new Date(now);
  trialCutoff.setUTCDate(trialCutoff.getUTCDate() + TRIAL_WINDOW_DAYS);

  const [marketingCount, leads, companies, logbookByCompany] = await Promise.all([
    prisma.signupMarketingLead.count(),
    prisma.signupMarketingLead.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { email: true, fullName: true, businessName: true, createdAt: true },
    }),
    prisma.company.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        paymentFailedAt: true,
        createdAt: true,
        _count: { select: { logbookEntries: true } },
      },
    }),
    prisma.logbookEntry.groupBy({
      by: ['companyId'],
      _count: { companyId: true },
    }),
  ]);

  const logbookMap = new Map(logbookByCompany.map((r) => [r.companyId, r._count.companyId]));

  const activePaid = companies.filter((c) => {
    const st = (c.subscriptionStatus ?? '').toLowerCase();
    const plan = (c.plan ?? '').toLowerCase();
    return st === 'active' || plan === 'business' || plan === 'enterprise';
  }).length;

  const trialing = companies.filter((c) => {
    const st = (c.subscriptionStatus ?? '').toLowerCase();
    return st === 'trial' || st === 'trialing';
  }).length;

  const pastDue = companies.filter((c) => (c.subscriptionStatus ?? '').toLowerCase() === 'past_due');

  const withLogbook = companies.filter((c) => (logbookMap.get(c.id) ?? c._count.logbookEntries) > 0).length;

  const trialsEndingSoon = companies
    .filter((c) => {
      if (!c.trialEndsAt) return false;
      const st = (c.subscriptionStatus ?? '').toLowerCase();
      if (st !== 'trial' && st !== 'trialing') return false;
      const end = c.trialEndsAt.getTime();
      return end >= now.getTime() && end <= trialCutoff.getTime();
    })
    .sort((a, b) => (a.trialEndsAt?.getTime() ?? 0) - (b.trialEndsAt?.getTime() ?? 0))
    .slice(0, 25)
    .map((c) => ({
      email: c.email,
      name: c.name,
      trialEndsAt: c.trialEndsAt!.toISOString(),
      plan: c.plan,
      logbookCount: logbookMap.get(c.id) ?? c._count.logbookEntries,
    }));

  const pastDueCompanies = pastDue
    .slice(0, 25)
    .map((c) => ({
      email: c.email,
      name: c.name,
      paymentFailedAt: c.paymentFailedAt?.toISOString() ?? null,
      plan: c.plan,
    }));

  const zeroLogbookCompanies = companies
    .filter((c) => (logbookMap.get(c.id) ?? c._count.logbookEntries) === 0)
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
    .slice(0, 25)
    .map((c) => ({
      email: c.email,
      name: c.name,
      createdAt: c.createdAt?.toISOString() ?? '',
      subscriptionStatus: c.subscriptionStatus,
    }));

  const leadEmails = leads.map((l) => l.email);
  const billingMap = await billingRowsByNormalizedEmail(leadEmails);
  const companyByEmail = new Map(
    companies.map((c) => [normalizeAuthEmail(c.email), c]),
  );

  const marketingWithoutLogbook = leads.filter((l) => {
    const co = companyByEmail.get(normalizeAuthEmail(l.email));
    if (!co) return true;
    return (logbookMap.get(co.id) ?? co._count.logbookEntries) === 0;
  }).length;

  const marketingLeads: GrowthMarketingRow[] = leads.map((l) => {
    const key = normalizeAuthEmail(l.email);
    const billing = billingMap.get(key);
    const co = companyByEmail.get(key);
    return {
      email: l.email,
      fullName: l.fullName,
      businessName: l.businessName,
      createdAt: l.createdAt.toISOString(),
      billingPlan: billing?.billingPlan ?? co?.plan ?? null,
      billingSubscriptionStatus: billing?.billingSubscriptionStatus ?? co?.subscriptionStatus ?? null,
      hasAuthUser: Boolean(co),
      logbookCount: co ? (logbookMap.get(co.id) ?? co._count.logbookEntries) : 0,
    };
  });

  return {
    generatedAt: now.toISOString(),
    funnel: {
      marketingSignups: marketingCount,
      companies: companies.length,
      activePaid,
      trialing,
      pastDue: pastDue.length,
      withLogbook,
      marketingWithoutLogbook,
    },
    trialsEndingSoon,
    pastDueCompanies,
    zeroLogbookCompanies,
    marketingLeads,
  };
}
