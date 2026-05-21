import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(join(__dirname, '..', '.env.local'), 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

for (const t of ['orgs', 'org_members', 'accounts', 'platform_connections', 'snapshots']) {
  const { data, error } = await admin.from(t).select('*').limit(20);
  console.log(`\n=== ${t} ===`);
  if (error) console.log('ERROR:', error.message);
  else console.log(`rows: ${data.length}`, data.length ? JSON.stringify(data[0], null, 2) : '(empty)');
}
