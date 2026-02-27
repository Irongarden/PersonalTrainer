/**
 * run-migrations.mjs
 * Runs all SQL migration files against your Supabase project.
 * Requires: SUPABASE_SERVICE_ROLE_KEY environment variable
 *
 * Usage:
 *   node run-migrations.mjs
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(`
❌  Missing environment variables.

Set them before running:
  $env:EXPO_PUBLIC_SUPABASE_URL   = "https://mwlsvinqcbpgtgjjhsqq.supabase.co"
  $env:SUPABASE_SERVICE_ROLE_KEY  = "your-service-role-key"

Get your Service Role key from:
  https://supabase.com/dashboard/project/mwlsvinqcbpgtgjjhsqq/settings/api
  → "service_role" (secret) key
`);
  process.exit(1);
}

async function runSQL(sql, label) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ sql }),
  });

  if (!res.ok) {
    // Fall back: use Postgres-over-REST approach
    const body = await res.text();
    console.error(`  ⚠️  RPC failed for "${label}": ${body}`);
    return false;
  }
  return true;
}

async function runSQLDirect(sql, label) {
  // Use the Supabase management API SQL endpoint
  const res = await fetch(`${SUPABASE_URL}/pg/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ query: sql }),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`  ❌  "${label}" failed: ${text.slice(0, 200)}`);
    return false;
  }
  console.log(`  ✅  "${label}" OK`);
  return true;
}

const files = [
  join(__dir, 'supabase', 'migrations', '001_initial_schema.sql'),
  join(__dir, 'supabase', 'seed', 'exercises.sql'),
];

console.log('\n🚀  PersonalCoach – Running migrations\n');

for (const file of files) {
  const label = file.split(/[\\/]/).slice(-2).join('/');
  console.log(`▶  ${label}`);
  const sql = readFileSync(file, 'utf-8');
  const ok = await runSQLDirect(sql, label);
  if (!ok) {
    console.log(`\n💡  Paste this file manually in the SQL editor instead:\n    ${file}\n`);
  }
}

console.log('\nDone.\n');
