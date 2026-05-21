// Probe the full response of /episodes/{id}/analytics — first probe truncated it.

const API = 'https://api.captivate.fm';
const [, , userId, apiKey] = process.argv;

const authRes = await fetch(`${API}/authenticate/token`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ username: userId, token: apiKey })
});
const session = (await authRes.json()).user?.token;

const epId = '77036b67-5e34-40c1-b933-11cd4ff5e7c4'; // "He Quit Wall Street..."
const res = await fetch(`${API}/episodes/${epId}/analytics`, {
  headers: { Authorization: `Bearer ${session}` }
});
const j = await res.json();
console.log('Status:', res.status);
console.log('Top-level keys:', Object.keys(j));
console.log('Episode keys:', Object.keys(j.episode || {}));
// Look for any field that looks like a count
const ep = j.episode || j;
for (const [k, v] of Object.entries(ep)) {
  if (
    /download|listen|stream|stat|analytic|count|total|play/i.test(k) &&
    v !== null &&
    typeof v !== 'object'
  ) {
    console.log(`  ${k}: ${v}`);
  }
}
console.log('\nFull keys with values that are objects/arrays:');
for (const [k, v] of Object.entries(ep)) {
  if (typeof v === 'object' && v !== null) {
    console.log(`  ${k}:`, Array.isArray(v) ? `Array(${v.length})` : Object.keys(v));
  }
}
console.log('\nAny extra top-level keys outside .episode:');
for (const [k, v] of Object.entries(j)) {
  if (k === 'episode') continue;
  console.log(`  ${k}:`, typeof v === 'object' ? JSON.stringify(v).slice(0, 400) : v);
}
