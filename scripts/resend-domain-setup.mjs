/**
 * Resend domain helper: list/create/verify pesttrace.com using RESEND_API_KEY from .env.local
 * Run: node scripts/resend-domain-setup.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const DOMAIN = 'pesttrace.com';

function loadEnvLocal() {
  const path = resolve(process.cwd(), '.env.local');
  if (!existsSync(path)) {
    console.error('Missing .env.local — add RESEND_API_KEY=re_...');
    process.exit(1);
  }
  const text = readFileSync(path, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

async function resendFetch(path, options = {}) {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    console.error('RESEND_API_KEY is not set in .env.local');
    process.exit(1);
  }
  const res = await fetch(`https://api.resend.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.message || body.error || `HTTP ${res.status}`);
  }
  return body;
}

loadEnvLocal();

try {
  const list = await resendFetch('/domains');
  const domains = list.data ?? [];
  let domain = domains.find((d) => d.name === DOMAIN);

  if (!domain) {
    console.log(`Creating domain ${DOMAIN}…`);
    const created = await resendFetch('/domains', {
      method: 'POST',
      body: JSON.stringify({ name: DOMAIN, region: 'eu-west-1' }),
    });
    domain = created;
    console.log('\nAdd these DNS records at your domain registrar, then re-run this script:\n');
    for (const record of created.records ?? []) {
      console.log(`  ${record.type}  ${record.name}  →  ${record.value}  (priority: ${record.priority ?? '—'})`);
    }
  } else {
    console.log(`Domain ${DOMAIN} exists — status: ${domain.status}`);
    const detail = await resendFetch(`/domains/${domain.id}`);
    if (detail.records?.length) {
      console.log('\nDNS records (from Resend):\n');
      for (const record of detail.records) {
        const status = record.status ? ` [${record.status}]` : '';
        console.log(`  ${record.type}  ${record.name}  →  ${record.value}${status}`);
      }
    }
    if (domain.status !== 'verified') {
      console.log('\nTriggering verification…');
      await resendFetch(`/domains/${domain.id}/verify`, { method: 'POST' });
      const after = await resendFetch(`/domains/${domain.id}`);
      console.log(`Status after verify request: ${after.status}`);
      if (after.status !== 'verified') {
        console.log('\nDNS may still be propagating. Wait a few minutes and run this script again.');
      }
    } else {
      console.log('\nDomain is verified. You can use alerts@pesttrace.com as RESEND_FROM_EMAIL.');
    }
  }
} catch (err) {
  console.error('Resend domain setup failed:', err.message);
  process.exit(1);
}
