// Usage: node scripts/grant-org-membership.mjs <email> [role]
//
// Looks up the user by email in auth.users and inserts (or upserts) a row
// into public.org_members for the seeded Matthews Mentality org.
//
// role defaults to 'owner'. Valid: owner | admin | editor | viewer.

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

const ORG_ID = '00000000-0000-0000-0000-000000000001';
const email = (process.argv[2] || '').toLowerCase();
const role = process.argv[3] || 'owner';

if (!email) {
  console.error('Usage: node scripts/grant-org-membership.mjs <email> [role]');
  process.exit(1);
}

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const { data: list, error: listErr } = await admin.auth.admin.listUsers({
  page: 1,
  perPage: 1000
});
if (listErr) {
  console.error('listUsers failed:', listErr.message);
  process.exit(1);
}
const user = list.users.find((u) => (u.email || '').toLowerCase() === email);
if (!user) {
  console.error(`No auth.users row found for ${email}.`);
  console.error('Make sure you signed up first (Supabase → Authentication → Users).');
  process.exit(1);
}

const { error: upErr } = await admin
  .from('org_members')
  .upsert(
    { org_id: ORG_ID, user_id: user.id, role, invited_email: email },
    { onConflict: 'org_id,user_id' }
  );
if (upErr) {
  console.error('upsert failed:', upErr.message);
  process.exit(1);
}

console.log(`✓ ${email} is now ${role} of the Matthews Mentality org (user_id=${user.id})`);
