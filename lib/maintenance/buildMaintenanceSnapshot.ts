import { prisma } from '../prisma';
import { getSupabaseAdmin } from '../supabase-admin';

export type MaintenanceSnapshot = {
  generatedAt: string;
  sections: {
    systemHealth: {
      ok: boolean;
      supabaseConnected: boolean;
      supabaseDetail?: string;
      lastBackgroundJob: { jobName: string | null; finishedAt: string | null; status: string | null };
      apiHealthMs: number | null;
      apiHealthOk: boolean;
      storageBucketOk: boolean;
      storageDetail?: string;
      error?: string;
    };
    database: {
      ok: boolean;
      tableCounts: Record<string, number | null>;
      missingTables: string[];
      error?: string;
    };
    webhooks: {
      ok: boolean;
      failed: Array<{
        id: string;
        eventType: string | null;
        errorMessage: string;
        createdAt: string;
        retriedAt: string | null;
      }>;
      error?: string;
    };
    errorLogs: {
      ok: boolean;
      items: Array<{ id: string; message: string; createdAt: string; stackPreview: string | null }>;
      error?: string;
    };
  };
  bootstrapNeeded: boolean;
};

async function safeCount(label: string, fn: () => Promise<number>): Promise<{ label: string; count: number | null }> {
  try {
    const count = await fn();
    return { label, count };
  } catch {
    return { label, count: null };
  }
}

async function measureHealthEndpoint(origin: string): Promise<{ ok: boolean; ms: number | null }> {
  const started = Date.now();
  try {
    const res = await fetch(`${origin.replace(/\/$/, '')}/api/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    return { ok: res.ok, ms: Date.now() - started };
  } catch {
    return { ok: false, ms: Date.now() - started };
  }
}

export async function buildMaintenanceSnapshot(serverOrigin: string): Promise<MaintenanceSnapshot> {
  const mockDbFail = process.env.PLAYWRIGHT_MAINTENANCE_MOCK_DB_FAILURE === '1';

  let lastJob = { jobName: null as string | null, finishedAt: null as string | null, status: null as string | null };
  try {
    const row = await prisma.backgroundJobRun.findFirst({
      orderBy: { lastFinishedAt: 'desc' },
    });
    if (row) {
      lastJob = {
        jobName: row.jobName,
        finishedAt: row.lastFinishedAt?.toISOString() ?? null,
        status: row.status ?? null,
      };
    }
  } catch {
    /* ignore */
  }

  const admin = getSupabaseAdmin();
  let supabaseConnected = false;
  let supabaseDetail: string | undefined;
  if (!admin) {
    supabaseDetail = 'Supabase admin client not configured';
  } else {
    const { error } = await admin.from('profiles').select('id').limit(1);
    supabaseConnected = !error;
    supabaseDetail = error?.message;
  }

  let storageBucketOk = false;
  let storageDetail: string | undefined;
  if (admin) {
    const { error } = await admin.storage.from('logbook-photos').list('', { limit: 1 });
    storageBucketOk = !error;
    storageDetail = error?.message;
  }

  const health = await measureHealthEndpoint(serverOrigin);

  const tableCounts: Record<string, number | null> = {};
  const missingTables: string[] = [];

  const countQueries: Array<{ key: string; run: () => Promise<number> }> = [
    {
      key: 'profiles',
      run: async () => {
        const rows = await prisma.$queryRaw<[{ c: bigint }]>`
          SELECT COUNT(*)::bigint AS c FROM public.profiles
        `;
        return Number(rows[0]?.c ?? 0);
      },
    },
    { key: 'logbook_entries', run: () => prisma.logbookEntry.count() },
    { key: 'chemical_logs', run: () => prisma.chemicalLogRow.count() },
    {
      key: 'suggestions',
      run: async () => {
        const admin = getSupabaseAdmin();
        if (!admin) throw new Error('Supabase admin unavailable');
        const { count, error } = await admin.from('suggestions').select('*', { count: 'exact', head: true });
        if (error) throw new Error(error.message);
        return count ?? 0;
      },
    },
    { key: 'deletion_feedback', run: () => prisma.deletionFeedback.count() },
    { key: 'company_activation', run: () => prisma.companyActivation.count() },
    { key: 'trial_upgrade_feedback', run: () => prisma.trialUpgradeFeedback.count() },
    {
      key: 'activation_first_customer',
      run: () =>
        prisma.companyActivation.count({ where: { firstCustomerCreatedAt: { not: null } } }),
    },
    {
      key: 'activation_first_report',
      run: () =>
        prisma.companyActivation.count({ where: { firstReportGeneratedAt: { not: null } } }),
    },
    {
      key: 'audit_logs',
      run: async () => {
        const rows = await prisma.$queryRaw<[{ c: bigint }]>`
          SELECT COUNT(*)::bigint AS c FROM public.audit_logs
        `;
        return Number(rows[0]?.c ?? 0);
      },
    },
    { key: 'offline_queue', run: () => prisma.offlineQueueRow.count() },
  ];

  let databaseOk = true;
  let databaseError: string | undefined;

  if (mockDbFail) {
    databaseOk = false;
    databaseError = 'Database unavailable (simulated for tests).';
    for (const q of countQueries) {
      tableCounts[q.key] = null;
      missingTables.push(q.key);
    }
  } else {
    const results = await Promise.all(
      countQueries.map(async ({ key, run }) => {
        const r = await safeCount(key, run);
        return r;
      }),
    );
    for (const { label, count } of results) {
      tableCounts[label] = count;
      if (count === null) {
        databaseOk = false;
        missingTables.push(label);
      }
    }
    if (!databaseOk) {
      databaseError = 'Failed to load database metrics — please try again.';
    }
  }

  let webhooksOk = true;
  let webhookError: string | undefined;
  let failedWebhookRows: MaintenanceSnapshot['sections']['webhooks']['failed'] = [];
  try {
    const rows = await prisma.webhookError.findMany({
      orderBy: { createdAt: 'desc' },
      take: 25,
      where: { retriedAt: null },
    });
    failedWebhookRows = rows.map((w) => ({
      id: w.id,
      eventType: w.eventType,
      errorMessage: w.errorMessage,
      createdAt: w.createdAt.toISOString(),
      retriedAt: w.retriedAt?.toISOString() ?? null,
    }));
  } catch (e) {
    webhooksOk = false;
    webhookError = e instanceof Error ? e.message : 'Failed to load webhook errors';
  }

  let errorLogsOk = true;
  let errorLogsDetail: string | undefined;
  let errorItems: MaintenanceSnapshot['sections']['errorLogs']['items'] = [];
  try {
    const logs = await prisma.errorLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    errorItems = logs.map((l) => ({
      id: l.id,
      message: l.message,
      createdAt: l.createdAt.toISOString(),
      stackPreview: l.stack ? `${l.stack.slice(0, 280)}${l.stack.length > 280 ? '…' : ''}` : null,
    }));
  } catch (e) {
    errorLogsOk = false;
    errorLogsDetail = e instanceof Error ? e.message : 'Failed to load error logs';
  }

  const bootstrapNeeded =
    missingTables.includes('error_logs') ||
    missingTables.includes('webhook_errors') ||
    missingTables.includes('suggestions');

  return {
    generatedAt: new Date().toISOString(),
    bootstrapNeeded,
    sections: {
      systemHealth: {
        ok: supabaseConnected && health.ok && storageBucketOk,
        supabaseConnected,
        supabaseDetail,
        lastBackgroundJob: lastJob,
        apiHealthMs: health.ms,
        apiHealthOk: health.ok,
        storageBucketOk,
        storageDetail,
      },
      database: {
        ok: databaseOk,
        tableCounts,
        missingTables,
        error: databaseError,
      },
      webhooks: {
        ok: webhooksOk,
        failed: failedWebhookRows,
        error: webhookError,
      },
      errorLogs: {
        ok: errorLogsOk,
        items: errorItems,
        error: errorLogsDetail,
      },
    },
  };
}
