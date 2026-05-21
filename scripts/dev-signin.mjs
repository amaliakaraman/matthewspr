// Dev-only: bypasses email by generating a one-shot magic link server-side
// using the Supabase service-role key. Paste the printed URL into your
// browser; you'll be signed in on the next page load. Safe because:
//   - it requires SUPABASE_SERVICE_ROLE_KEY (already in your .env.local), and
//   - the link itself is still single-use, so nothing leaks.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env.local');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.argv[2];

if (!email) {
  console.error('Usage: node scripts/dev-signin.mjs <email>');
  process.exit(1);
}
if (!url || !serviceKey) {
  console.error('Missing SUPABASE env vars in .env.local');
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const { data, error } = await admin.auth.admin.generateLink({
  type: 'magiclink',
  email,
  options: {
    redirectTo: 'http://localhost:3001/api/auth/callback'
  }
});

if (error) {
  console.error('Failed:', error.message);
  process.exit(1);
}

const link = data?.properties?.action_link;
if (!link) {
  console.error('No action_link in response:', data);
  process.exit(1);
}

console.log('');
console.log('Paste this in your browser and you are in:');
console.log('');
console.log(link);
console.log('');
