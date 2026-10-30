// Calls one of the hub's refresh endpoints with the cron secret. Run by the Render cron jobs in render.yaml:
//   node scripts/cron.mjs /api/refresh
// HUB_HOST is the web service's hostname (Render fills it in) and CRON_SECRET matches the web service's.
const path = process.argv[2];
const host = process.env.HUB_HOST;
const secret = process.env.CRON_SECRET;
if (!path || !host || !secret) {
  console.error("Usage: HUB_HOST=… CRON_SECRET=… node scripts/cron.mjs /api/refresh");
  process.exit(2);
}

const url = `https://${host}${path}`;
const started = Date.now();
const res = await fetch(url, { headers: { Authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(20 * 60_000) });
const text = await res.text();
console.log(`${res.status} ${url} in ${Math.round((Date.now() - started) / 1000)}s`);
console.log(text.slice(0, 2000));
process.exit(res.ok ? 0 : 1);
