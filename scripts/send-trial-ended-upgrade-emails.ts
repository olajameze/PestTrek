/**
 * One-off CLI: email business owners whose trial has ended.
 *
 *   npx tsx scripts/send-trial-ended-upgrade-emails.ts --dry-run
 *   npx tsx scripts/send-trial-ended-upgrade-emails.ts
 *
 * Requires DATABASE_URL and RESEND_API_KEY (e.g. from .env.local).
 */
import { config } from 'dotenv';
import { resolve } from 'path';

const useProduction = process.argv.includes('--production');
config({ path: resolve(process.cwd(), useProduction ? '.env.production.local' : '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const force = process.argv.includes('--force');

  const { runExpiredTrialUpgradeCampaign, previewExpiredTrialUpgradeCampaign } = await import(
    '../lib/trial/sendExpiredTrialUpgradeCampaign'
  );

  const preview = await previewExpiredTrialUpgradeCampaign();
  console.log(`Pending: ${preview.pending.length}, already sent: ${preview.alreadySent}`);

  const result = await runExpiredTrialUpgradeCampaign({ dryRun, force });
  console.log(JSON.stringify(result, null, 2));

  if (result.failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
