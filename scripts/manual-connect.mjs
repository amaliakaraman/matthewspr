// Usage: node scripts/manual-connect.mjs <account_tag> <platform> <external_id> <token> [handle]
//
// Encrypts a platform OAuth token with TOKEN_ENCRYPTION_KEY and writes it
// into platform_connections so the account shows as Connected. Use when
// you've obtained a token outside the normal OAuth flow (e.g. Instagram's
// "Generate token" button in the Meta dev console).
//
// account_tag: 'KM' or 'TMMP' (the public.accounts.tag column)
// handle: pass with @ prefix yourself if you want it (we don't auto-add).

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

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

const [, , accountTag, platform, externalId, token, handle] = process.argv;
if (!accountTag || !platform || !externalId || !token) {
  console.error('Usage: node scripts/manual-connect.mjs <KM|TMMP> <platform> <external_id> <token> [handle]');
  process.exit(1);
}

// AES-256-GCM encrypt — matches lib/crypto.ts exactly so the app can decrypt.
function encryptToken(plain) {
  const keyBuf = Buffer.from(env.TOKEN_ENCRYPTION_KEY, 'base64');
  if (keyBuf.length !== 32) throw new Error('TOKEN_ENCRYPTION_KEY must decode to 32 bytes');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuf, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString('base64');
}

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const { data: acct, error: acctErr } = await admin
  .from('accounts')
  .select('id, label, tag')
  .eq('tag', accountTag)
  .maybeSingle();
if (acctErr || !acct) {
  console.error('Account lookup failed:', acctErr?.message || `no account with tag=${accountTag}`);
  process.exit(1);
}

const enc = encryptToken(token);
const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

const profileUrlFor = (p, h) => {
  if (!h) return null;
  const bare = h.replace(/^@/, '');
  if (p === 'instagram') return `https://instagram.com/${bare}`;
  if (p === 'tiktok') return `https://tiktok.com/@${bare}`;
  if (p === 'x') return `https://x.com/${bare}`;
  if (p === 'youtube') return `https://youtube.com/@${bare}`;
  if (p === 'linkedin') return `https://linkedin.com/in/${bare}`;
  return null;
};

const scopeFor = (p) => {
  if (p === 'instagram') return 'instagram_business_basic,instagram_business_manage_insights';
  if (p === 'captivate') return 'captivate.api';
  return null;
};

const { data, error } = await admin
  .from('platform_connections')
  .update({
    status: 'connected',
    access_token_enc: enc,
    refresh_token_enc: enc,
    external_id: externalId,
    handle: handle || null,
    profile_url: profileUrlFor(platform, handle),
    token_expires_at: expiresAt,
    scope: scopeFor(platform),
    connected_at: new Date().toISOString(),
    last_pull_error: null
  })
  .eq('account_id', acct.id)
  .eq('platform', platform)
  .select();

if (error) {
  console.error('Update failed:', error.message);
  process.exit(1);
}
if (!data?.length) {
  console.error(`No platform_connections row matched (account=${acct.label}, platform=${platform})`);
  process.exit(1);
}

console.log(`✓ ${acct.label} → ${platform}: connected as ${handle || '(no handle)'}.`);
console.log(`  external_id=${externalId}`);
console.log(`  token_expires_at=${expiresAt}`);
