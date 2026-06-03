/**
 * Prints Supabase Auth SMTP values for copy-paste (does not call Supabase API).
 * Run: node scripts/print-supabase-smtp-checklist.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve(process.cwd(), '.env.local');
if (!existsSync(path)) {
  console.error('Missing .env.local');
  process.exit(1);
}

let apiKey = '';
for (const line of readFileSync(path, 'utf8').split('\n')) {
  const m = line.match(/^RESEND_API_KEY=(.+)$/);
  if (m) apiKey = m[1].trim().replace(/^["']|["']$/g, '');
}

console.log(`
Supabase Dashboard → Authentication → Email → SMTP Settings
──────────────────────────────────────────────────────────
Enable custom SMTP:  ON
Host:                smtp.resend.com
Port:                465
Username:            resend
Password:            ${apiKey ? '(your RESEND_API_KEY from .env.local — re_...)' : '(set RESEND_API_KEY in .env.local first)'}
Sender email:        alerts@pesttrace.com
Sender name:         Pest Trace
──────────────────────────────────────────────────────────
Or use Resend → Integrations → Supabase to apply these automatically.
`);
