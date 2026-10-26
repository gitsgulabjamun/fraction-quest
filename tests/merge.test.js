// Unit tests for merging copies of progress and daily logs from several devices.
const test = require('node:test'); const assert = require('node:assert/strict'); const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../src/ui.js', 'utf8');
const pick = name => { const i = src.indexOf('function ' + name + '('); let depth = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') depth++; else if (src[k] === '}') { depth--; if (!depth) return src.slice(i, k + 1); } } };
const env = new Function('const clone = o => JSON.parse(JSON.stringify(o || {}));\n' + pick('mergeProgress') + '\n' + pick('mergeDay') + '\nreturn { mergeProgress, mergeDay };')();
const { mergeProgress, mergeDay } = env;

test('a stale device cannot wipe the PIN, XP, stars or badges', () => {
  const server = { updatedAt: 100, player: { name: 'Meera' }, settings: { pin: '2468', goalMin: 45 }, xp: 300, badges: { first: 5 }, worlds: { 1: { L1: { best: 9, rounds: 3, seen: { a: 1, b: 1 } }, L2: { best: 7, rounds: 1 }, L3: { best: 0, rounds: 0 } } }, skills: { meaning: { a: 20, c: 15 } } };
  const stale = { updatedAt: 200, player: { name: '' }, settings: { pin: '', goalMin: 50 }, xp: 10, badges: {}, worlds: { 1: { L1: { best: 3, rounds: 1, seen: { a: 0 } }, L2: { best: 0, rounds: 0 }, L3: { best: 0, rounds: 0 } } }, skills: { meaning: { a: 2, c: 1 } } };
  const m = mergeProgress(stale, server);
  assert.equal(m.settings.pin, '2468'); assert.equal(m.player.name, 'Meera'); assert.equal(m.xp, 300);
  assert.equal(m.settings.goalMin, 50, 'newer setting wins'); assert.equal(m.worlds[1].L1.best, 9); assert.equal(m.worlds[1].L2.best, 7);
  assert.deepEqual(m.worlds[1].L1.seen, { a: 1, b: 1 }); assert.ok(m.badges.first); assert.equal(m.skills.meaning.a, 20); assert.equal(m.updatedAt, 200);
});

test('two devices playing the same day keep every question and add up their time', () => {
  const laptop = { date: '2026-10-26', att: 2, cor: 1, ms: 60000, msBy: { L: 60000 }, attempts: [{ t: 1, id: 'q1', ok: 1, h: 0, w: 1, sk: 'meaning' }, { t: 3, id: 'q3', ok: 0, h: 1, w: 1, sk: 'meaning' }], sessions: [{ s: 1, e: 3, att: 2, cor: 1 }] };
  const phone = { date: '2026-10-26', att: 1, cor: 1, ms: 30000, msBy: { P: 30000 }, attempts: [{ t: 2, id: 'q2', ok: 0.5, h: 2, w: 8, sk: 'addunlike' }], sessions: [{ s: 2, e: 2, att: 1, cor: 1 }] };
  const m = mergeDay(laptop, phone);
  assert.equal(m.att, 3); assert.equal(m.cor, 2); assert.equal(m.first, 1); assert.equal(m.hints, 3); assert.equal(m.ms, 90000);
  assert.deepEqual(m.attempts.map(a => a.id), ['q1', 'q2', 'q3']); assert.equal(m.sessions.length, 2);
  assert.equal(m.worlds[8].att, 1); assert.equal(m.skills.meaning.att, 2);
  const again = mergeDay(m, m); assert.equal(again.att, 3, 'merging twice does not double count'); assert.equal(again.ms, 90000);
});

test('old logs saved before per device time still keep their minutes', () => {
  const old = { date: 'd', att: 1, ms: 120000, attempts: [{ t: 1, id: 'x', ok: 1 }] };
  const now = { date: 'd', att: 1, ms: 30000, msBy: { L: 30000 }, attempts: [{ t: 1, id: 'x', ok: 1 }] };
  const m = mergeDay(now, old); assert.equal(m.ms, 150000, 'old minutes kept as legacy plus new device time');
  assert.equal(mergeDay(m, old).ms, 150000, 'stable when merged again');
});
