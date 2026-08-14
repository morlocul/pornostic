// Full local snapshot of the Pornostic database.
// Dumps every table to a timestamped folder under ./backups as JSON — a complete,
// restorable backup (unlike the in-app Excel export, which is a human report).
// Run: npm run backup   (reads credentials from .env.local)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TABLES = ['players', 'matches', 'predictions', 'scrape_runs'];

function loadEnv() {
  const txt = readFileSync(join(ROOT, '.env.local'), 'utf8');
  const env = {};
  for (const line of txt.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^"(.*)"$/, '$1');
  }
  return env;
}

async function fetchAll(url, key, table) {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const res = await fetch(`${url}/rest/v1/${table}?select=*`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Range: `${from}-${from + pageSize - 1}`,
        Prefer: 'count=exact',
      },
    });
    if (!res.ok) throw new Error(`${table}: HTTP ${res.status} ${await res.text()}`);
    const batch = await res.json();
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

// Timestamp without Date.now() quirks — plain local ISO, filesystem-safe.
function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

async function main() {
  const env = loadEnv();
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local');

  const dir = join(ROOT, 'backups', `pornostic-${stamp()}`);
  mkdirSync(dir, { recursive: true });

  const summary = {};
  for (const table of TABLES) {
    const rows = await fetchAll(url, key, table);
    writeFileSync(join(dir, `${table}.json`), JSON.stringify(rows, null, 2));
    summary[table] = rows.length;
    console.log(`  ${table}: ${rows.length} rows`);
  }
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ createdAt: new Date().toISOString(), counts: summary }, null, 2));
  console.log(`Backup saved to ${dir}`);
}

main().catch((e) => {
  console.error('Backup FAILED:', e.message);
  process.exit(1);
});
