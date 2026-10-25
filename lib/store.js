// Storage: Upstash Redis over its REST API (what Vercel's "Upstash for Redis" integration provides).
// Falls back to an in-memory store only for local development and tests, never on Vercel.
const restUrl = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const restToken = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
const onVercel = () => !!process.env.VERCEL;

function storageConfigured() { return !!restUrl(); }

const mem = () => (global.__fqMem = global.__fqMem || { kv: new Map(), z: new Map() });
function memExec([c, ...a]) {
  const m = mem(); c = String(c).toUpperCase();
  if (c === 'GET') return m.kv.has(a[0]) ? m.kv.get(a[0]) : null;
  if (c === 'SET') { m.kv.set(a[0], String(a[1])); return 'OK'; }
  if (c === 'DEL') return m.kv.delete(a[0]) ? 1 : 0;
  if (c === 'MGET') return a.map(k => (m.kv.has(k) ? m.kv.get(k) : null));
  if (c === 'INCR') { const v = (+(m.kv.get(a[0]) || 0)) + 1; m.kv.set(a[0], String(v)); return v; }
  if (c === 'EXPIRE') return 1;
  if (c === 'ZADD') { const s = m.z.get(a[0]) || new Map(); s.set(String(a[2]), +a[1]); m.z.set(a[0], s); return 1; }
  if (c === 'ZREVRANGE') { const s = m.z.get(a[0]) || new Map(); return [...s.entries()].sort((x, y) => y[1] - x[1]).map(e => e[0]).slice(+a[1], +a[2] + 1); }
  throw new Error('unsupported command ' + c);
}

class StoreError extends Error { constructor(msg, status) { super(msg); this.status = status; } }

async function pipeline(cmds) {
  if (!restUrl()) {
    if (onVercel()) throw new StoreError('Storage is not connected. Add the Upstash for Redis integration to this Vercel project.', 503);
    return cmds.map(memExec);
  }
  const r = await fetch(restUrl().replace(/\/$/, '') + '/pipeline', {
    method: 'POST', headers: { Authorization: 'Bearer ' + restToken(), 'Content-Type': 'application/json' }, body: JSON.stringify(cmds),
  });
  if (!r.ok) throw new StoreError('Storage error ' + r.status, 502);
  const out = await r.json();
  return out.map(x => { if (x.error) throw new StoreError('Storage error: ' + x.error, 502); return x.result; });
}
const cmd = async (...args) => (await pipeline([args]))[0];

const K = { progress: 'fq:progress:main', log: d => 'fq:log:' + d, logDates: 'fq:logdates', fail: ip => 'fq:fail:' + ip };
const dayScore = d => Math.round(Date.parse(d + 'T00:00:00Z') / 86400000);

async function getDoc(path) {
  const raw = await cmd('GET', keyFor(path));
  return raw == null ? null : JSON.parse(raw);
}
async function setDoc(path, data) {
  const ops = [['SET', keyFor(path), JSON.stringify(data)]];
  const m = path.match(/^log\/(\d{4}-\d{2}-\d{2})$/); if (m) ops.push(['ZADD', K.logDates, dayScore(m[1]), m[1]]);
  await pipeline(ops);
}
async function recentLogs(limit = 30) {
  const dates = await cmd('ZREVRANGE', K.logDates, 0, limit - 1);
  if (!dates || !dates.length) return [];
  const raws = await cmd('MGET', ...dates.map(K.log));
  return raws.map(r => (r ? JSON.parse(r) : null)).filter(Boolean);
}
function keyFor(path) {
  if (path === 'progress/main') return K.progress;
  const m = path.match(/^log\/(\d{4}-\d{2}-\d{2})$/); if (m) return K.log(m[1]);
  throw new StoreError('Unknown path', 400);
}
const PATH_RE = /^(progress\/main|log\/\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]))$/;

module.exports = { pipeline, cmd, getDoc, setDoc, recentLogs, storageConfigured, StoreError, PATH_RE, K };
