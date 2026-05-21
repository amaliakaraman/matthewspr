// Probe Captivate's analytics endpoints to find where downloads live now.

const API = 'https://api.captivate.fm';
const [, , userId, apiKey] = process.argv;
const SHOW_ID = '1d1d32e6-2db5-4e47-9d0e-f87e2c36223a'; // TMMP

const authRes = await fetch(`${API}/authenticate/token`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ username: userId, token: apiKey })
});
const session = (await authRes.json()).user?.token;

async function probe(path) {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${session}` }
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text.slice(0, 400); }
  console.log(`\n${res.status} ${path}`);
  console.log(typeof body === 'string' ? body : JSON.stringify(body, null, 2).slice(0, 1200));
}

const epId = '77036b67-5e34-40c1-b933-11cd4ff5e7c4'; // "He Quit Wall Street..."

const paths = [
  `/shows/${SHOW_ID}/analytics`,
  `/shows/${SHOW_ID}/insights`,
  `/shows/${SHOW_ID}/downloads`,
  `/shows/${SHOW_ID}/stats`,
  `/shows/${SHOW_ID}/summary`,
  `/shows/${SHOW_ID}/episodes_analytics`,
  `/episodes/${epId}/analytics`,
  `/episodes/${epId}/insights`,
  `/episodes/${epId}/downloads`,
  `/episodes/${epId}/stats`,
  `/episodes/${epId}`,
  `/users/${userId}/analytics`,
  `/users/${userId}/dashboard`
];

for (const p of paths) {
  await probe(p);
}
