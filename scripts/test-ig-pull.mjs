// Sanity check: directly call the Instagram Graph API with the saved
// token to confirm the connection works end-to-end (token valid, account
// is Business/Creator, insights permissions granted).

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

const token = process.argv[2];
const igUserId = process.argv[3] || '17841451806246822';
if (!token) {
  console.error('Usage: node scripts/test-ig-pull.mjs <token> [ig_user_id]');
  process.exit(1);
}

const API = 'https://graph.instagram.com';

async function ig(path) {
  const url = `${API}${path}${path.includes('?') ? '&' : '?'}access_token=${token}`;
  const res = await fetch(url, { cache: 'no-store' });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { ok: res.ok, status: res.status, body };
}

console.log('1) Profile —');
const profile = await ig(`/${igUserId}?fields=username,followers_count,media_count`);
console.log(JSON.stringify(profile, null, 2));

console.log('\n2) Account insights (28-day) —');
const insights = await ig(
  `/${igUserId}/insights?metric=reach,profile_views&period=days_28&metric_type=total_value`
);
console.log(JSON.stringify(insights, null, 2));

console.log('\n3) Recent media —');
const media = await ig(
  `/${igUserId}/media?fields=id,caption,permalink,timestamp,media_type,like_count,comments_count&limit=3`
);
console.log(JSON.stringify(media, null, 2));
