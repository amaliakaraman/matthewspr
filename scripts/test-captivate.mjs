// Verifies Captivate auth + lists shows + sample episodes.
//
// Usage: node scripts/test-captivate.mjs <user_id> <api_key>

const API = 'https://api.captivate.fm';
const [, , userId, apiKey] = process.argv;
if (!userId || !apiKey) {
  console.error('Usage: node scripts/test-captivate.mjs <user_id> <api_key>');
  process.exit(1);
}

console.log('1) Authenticating…');
const authRes = await fetch(`${API}/authenticate/token`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ username: userId, token: apiKey })
});
const authJson = await authRes.json();
if (!authRes.ok) {
  console.error('   FAIL:', authRes.status, authJson);
  process.exit(1);
}
const session = authJson.user?.token || authJson.token;
console.log('   OK. session token length:', session?.length);

console.log('\n2) Listing shows for user…');
const showsRes = await fetch(`${API}/users/${userId}/shows`, {
  headers: { Authorization: `Bearer ${session}` }
});
const showsJson = await showsRes.json();
console.log('   status:', showsRes.status);
console.log('   shows:', JSON.stringify(showsJson, null, 2));

const show = showsJson.shows?.[0];
if (!show) {
  console.log('   (no shows on this account)');
  process.exit(0);
}

console.log(`\n3) First 3 episodes of "${show.title}" (id ${show.id})…`);
const epsRes = await fetch(`${API}/shows/${show.id}/episodes`, {
  headers: { Authorization: `Bearer ${session}` }
});
const epsJson = await epsRes.json();
const eps = (epsJson.episodes || []).slice(0, 3);
console.log(JSON.stringify(eps, null, 2));

const total = (epsJson.episodes || []).reduce(
  (s, e) => s + (e.downloads_total || 0),
  0
);
console.log(
  `\nTotal episodes: ${epsJson.episodes?.length || 0}, lifetime downloads: ${total.toLocaleString()}`
);
