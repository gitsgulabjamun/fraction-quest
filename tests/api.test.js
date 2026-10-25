// Server tests. Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const { startFakeUpstash, call, freshModules } = require('./helpers');

const CODE = 'mango-sunrise-42';
let up;
test.before(async () => { up = await startFakeUpstash(); });
test.after(() => up.close());
test.beforeEach(() => {
  freshModules();
  process.env.KV_REST_API_URL = up.url; process.env.KV_REST_API_TOKEN = up.token; process.env.FAMILY_CODE = CODE;
  delete process.env.UPSTASH_REDIS_REST_URL; delete process.env.CRON_SECRET; delete process.env.RESEND_API_KEY; delete process.env.TELEGRAM_BOT_TOKEN;
  up.kv.clear(); up.z.clear(); up.calls.length = 0;
});
const H = (extra = {}) => ({ 'x-family-code': CODE, 'x-forwarded-for': '1.2.3.4', ...extra });

test('health reports what is configured, without needing the code', async () => {
  const r = await call(require('../api/health'));
  assert.equal(r.status, 200); assert.equal(r.body.ok, true); assert.equal(r.body.storage, true); assert.equal(r.body.familyCode, true);
});

test('doc rejects a missing or wrong family code', async () => {
  const doc = require('../api/doc');
  assert.equal((await call(doc, { query: { path: 'progress/main' } })).status, 401);
  assert.equal((await call(doc, { query: { path: 'progress/main' }, headers: { 'x-family-code': 'nope' } })).status, 401);
});

test('doc only accepts known paths', async () => {
  const doc = require('../api/doc');
  for (const path of ['', 'progress/other', 'log/2026-13-99x', '../secret', 'log/2026-10-25/extra']) {
    const r = await call(doc, { query: { path }, headers: H() });
    assert.equal(r.status, 400, 'path ' + path);
  }
});

test('progress round trip: missing, then saved, then loaded', async () => {
  const doc = require('../api/doc');
  let r = await call(doc, { query: { path: 'progress/main' }, headers: H() });
  assert.equal(r.status, 200); assert.equal(r.body.exists, false);
  r = await call(doc, { method: 'PUT', query: { path: 'progress/main' }, headers: H(), body: { player: { name: 'Meera' }, xp: 40, updatedAt: 5 } });
  assert.equal(r.status, 200);
  r = await call(doc, { query: { path: 'progress/main' }, headers: H() });
  assert.equal(r.body.exists, true); assert.equal(r.body.data.player.name, 'Meera'); assert.equal(r.body.data.xp, 40);
});

test('PUT accepts a JSON string body too and rejects non-objects', async () => {
  const doc = require('../api/doc');
  let r = await call(doc, { method: 'PUT', query: { path: 'progress/main' }, headers: H(), body: JSON.stringify({ xp: 1 }) });
  assert.equal(r.status, 200);
  r = await call(doc, { method: 'PUT', query: { path: 'progress/main' }, headers: H(), body: '[1,2]' });
  assert.equal(r.status, 400);
});

test('logs come back newest first and respect the limit', async () => {
  const doc = require('../api/doc'); const logs = require('../api/logs');
  for (const d of ['2026-10-20', '2026-10-25', '2026-10-22']) await call(doc, { method: 'PUT', query: { path: 'log/' + d }, headers: H(), body: { date: d, att: 3 } });
  let r = await call(logs, { query: { limit: '2' }, headers: H() });
  assert.equal(r.status, 200); assert.deepEqual(r.body.logs.map(l => l.date), ['2026-10-25', '2026-10-22']);
  r = await call(logs, { headers: H() }); assert.equal(r.body.logs.length, 3);
  assert.equal((await call(logs, {})).status, 401);
});

test('too many wrong codes from one address are blocked for a while', async () => {
  const doc = require('../api/doc');
  for (let i = 0; i < 20; i++) await call(doc, { query: { path: 'progress/main' }, headers: H({ 'x-family-code': 'guess' + i }) });
  const blocked = await call(doc, { query: { path: 'progress/main' }, headers: H() });
  assert.equal(blocked.status, 429);
  const other = await call(doc, { query: { path: 'progress/main' }, headers: H({ 'x-forwarded-for': '9.9.9.9' }) });
  assert.equal(other.status, 200);
});

test('server says clearly when FAMILY_CODE is not set', async () => {
  delete process.env.FAMILY_CODE; const doc = require('../api/doc');
  const r = await call(doc, { query: { path: 'progress/main' }, headers: H() });
  assert.equal(r.status, 503); assert.match(r.body.error, /FAMILY_CODE/);
});

// ---------- report ----------
const sampleDay = {
  date: '2026-10-25', ms: 41 * 60000, att: 32, cor: 26, first: 19, hints: 7, rounds: 4,
  sessions: [{ s: Date.parse('2026-10-25T12:30:00Z'), e: Date.parse('2026-10-25T13:12:00Z'), att: 32, cor: 26 }],
  worlds: { 1: { att: 10, cor: 9 }, 8: { att: 22, cor: 17 } },
  skills: { addunlike: { att: 12, cor: 7 }, meaning: { att: 10, cor: 9 }, sub: { att: 10, cor: 10 } },
  attempts: [
    { t: Date.parse('2026-10-25T12:40:00Z'), w: 8, l: 2, sk: 'addunlike', ok: 0, h: 1, nu: 0, g: '2/7', x: '7/12', q: 'Find: 1/3 + 1/4', bk: 0 },
    { t: Date.parse('2026-10-25T12:45:00Z'), w: 8, l: 1, sk: 'addlike', ok: 0.5, h: 0, nu: 1, g: '12/4', x: '3', q: 'Find: 1/4 + 2/4 + 9/4', bk: 1 },
  ],
};

test('report summarises a practice day with numbers, weak skills and real mistakes', () => {
  const { buildReport } = require('../lib/report');
  const r = buildReport({ date: '2026-10-25', day: sampleDay, history: [sampleDay], progress: { player: { name: 'Meera' } } });
  assert.match(r.subject, /Meera/); assert.match(r.subject, /practised/);
  assert.match(r.text, /41 min/); assert.match(r.text, /32 questions/); assert.match(r.text, /81%/);
  assert.match(r.text, /18:00 to 18:42/); // IST
  assert.match(r.text, /Adding unlike fractions/);
  assert.match(r.text, /1\/3 \+ 1\/4/); assert.match(r.text, /2\/7/); assert.match(r.text, /7\/12/);
  assert.match(r.text, /simplify/i);
  assert.doesNotMatch(r.text, /—/);
  assert.match(r.html, /<table/);
});

test('report still makes sense on a day with no practice', () => {
  const { buildReport } = require('../lib/report');
  const r = buildReport({ date: '2026-10-26', day: null, history: [sampleDay], progress: { player: { name: 'Meera' } } });
  assert.match(r.subject, /no practice/); assert.match(r.text, /No practice was recorded/);
});

test('report endpoint: cron needs CRON_SECRET, sends email and telegram when configured', async () => {
  process.env.CRON_SECRET = 'cron-s3cret'; process.env.RESEND_API_KEY = 're_test'; process.env.REPORT_EMAIL = 'dad@example.com';
  process.env.TELEGRAM_BOT_TOKEN = '123:abc'; process.env.TELEGRAM_CHAT_ID = '999';
  const doc = require('../api/doc'); const report = require('../api/report');
  await call(doc, { method: 'PUT', query: { path: 'log/2026-10-25' }, headers: H(), body: sampleDay });
  await call(doc, { method: 'PUT', query: { path: 'progress/main' }, headers: H(), body: { player: { name: 'Meera' } } });
  const sent = []; const realFetch = global.fetch;
  global.fetch = async (url, opts) => { if (String(url).startsWith(up.url)) return realFetch(url, opts); sent.push({ url: String(url), body: JSON.parse(opts.body) }); return { ok: true, status: 200, json: async () => ({ ok: true }) }; };
  try {
    assert.equal((await call(report, { query: { date: '2026-10-25' } })).status, 401);
    const r = await call(report, { query: { date: '2026-10-25' }, headers: { authorization: 'Bearer cron-s3cret' } });
    assert.equal(r.status, 200); assert.equal(r.body.sent.email, true); assert.equal(r.body.sent.telegram, true);
    const email = sent.find(s => s.url.includes('resend.com')); const tg = sent.find(s => s.url.includes('api.telegram.org/bot123:abc/sendMessage'));
    assert.ok(email && tg); assert.deepEqual(email.body.to, ['dad@example.com']); assert.match(email.body.subject, /Meera/); assert.equal(tg.body.chat_id, '999');
    // parent test button: family code works too
    const t = await call(report, { method: 'POST', query: { test: '1', date: '2026-10-25' }, headers: H() });
    assert.equal(t.status, 200); assert.match(t.body.subject, /Meera/);
  } finally { global.fetch = realFetch; }
});

test('report endpoint explains when no delivery channel is configured', async () => {
  const report = require('../api/report');
  const r = await call(report, { method: 'POST', query: { test: '1' }, headers: H() });
  assert.equal(r.status, 200); assert.equal(r.body.sent.email, false); assert.equal(r.body.sent.telegram, false); assert.match(r.body.note, /RESEND_API_KEY|TELEGRAM/);
});

test('without storage env vars, production refuses instead of silently using memory', async () => {
  delete process.env.KV_REST_API_URL; process.env.VERCEL = '1';
  try { const doc = require('../api/doc'); const r = await call(doc, { query: { path: 'progress/main' }, headers: H() }); assert.equal(r.status, 503); assert.match(r.body.error, /storage/i); }
  finally { delete process.env.VERCEL; }
});
