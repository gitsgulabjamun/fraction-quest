// "Try again" behaviour: misses and half-credit answers come back as a fresh question of the same kind.
const { chromium } = require('playwright'); const path = require('path');
module.exports = async function retryE2E() {
  const b = await chromium.launch(); const p = await b.newPage(); const results = []; const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  const ok = (name, cond, extra = '') => results.push((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : ''));
  await p.goto('file://' + path.join(__dirname, '../../public/index.html'));
  await p.fill('#nm', 'T'); await p.click('#start');
  const r = await p.evaluate(() => {
    const out = {};
    const sig = q => plain(q.q) + ' = ' + (q._ans && q._ans.tok ? q._ans.tok() : JSON.stringify(q._ans !== undefined ? q._ans : q.a));
    const play = (q, ok) => { RUN.qs[RUN.i] = q; newQ(); renderPlay(document.getElementById('app')); endQ(q, ok); };
    // 1. a half-credit answer on a fresh question goes on the list
    startRound(8, 2); let q = RUN.qs[0]; while (!q.gen || q.again) { RUN.i++; q = RUN.qs[RUN.i]; }
    const original = sig(q), kind = q.gk ? q.gk.w + '/' + q.gk.L + '/' + q.gk.i : null, skill = q.sk;
    play(q, 0.5);
    out.halfQueued = (S.retry || []).length === 1;
    // 2. it comes back in the next round of that island, marked Try again, as the same kind with new numbers
    let fresh = null;
    for (let i = 0; i < 6 && !fresh; i++) { startRound(8, 2); fresh = RUN.qs.find(x => x.again) || null; }
    out.cameBack = !!fresh;
    out.sameKind = !!(fresh && fresh.gk && kind && fresh.gk.w + '/' + fresh.gk.L + '/' + fresh.gk.i === kind);
    out.newNumbers = !!(fresh && sig(fresh) !== original); out.sameSkill = !!(fresh && fresh.sk === skill);
    out.originalSig = original; out.freshSig = fresh ? sig(fresh) : '';
    // 3. half credit again keeps it on the list; a clean first try clears it
    RUN.i = RUN.qs.indexOf(fresh); play(fresh, 0.5); out.stillQueuedAfterHalf = (S.retry || []).length === 1;
    startRound(8, 2); const fresh2 = RUN.qs.find(x => x.again); RUN.i = RUN.qs.indexOf(fresh2); play(fresh2, 1);
    out.clearedAfterClean = (S.retry || []).length === 0;
    // 4. a full miss is queued too
    startRound(5, 3); let m = RUN.qs.find(x => x.gen && !x.again && !x.review) || RUN.qs.find(x => x.gen && !x.again); RUN.i = RUN.qs.indexOf(m); play(m, 0);
    out.missQueued = (S.retry || []).length === 1 && !!S.retry[0].gk;
    // 5. the Daily Mix also brings it back
    startRound(0, 0); out.mixHasRetry = RUN.qs.some(x => x.again);
    // 6. textbook half credit is not counted as solved, and comes first next time
    startRound(1, 1); const bq = RUN.qs.find(x => !x.gen); RUN.i = RUN.qs.indexOf(bq); play(bq, 0.5);
    out.bookHalfNotSolved = W(1).L1.seen[bq.id] !== 1;
    W(1).L1.seen = Object.fromEntries(bookFor(1).map(x => [x.id, 1])); W(1).L1.seen[bq.id] = 0.5;
    startRound(1, 1); out.bookHalfFirst = RUN.qs[0].id === bq.id;
    startRound(1, 1); const again = RUN.qs.find(x => x.id === bq.id); RUN.i = RUN.qs.indexOf(again); play(again, 1);
    out.bookCleanSolves = W(1).L1.seen[bq.id] === 1;
    // 7. a device with an old copy cannot bring back a cleared retry
    const cleared = { id: 'old1', w: 3, gk: { w: 3, L: 2, i: 0 }, sig: 'x' };
    const a = { updatedAt: 2, retry: [], retryDone: ['old1'] }, bOld = { updatedAt: 1, retry: [cleared], retryDone: [] };
    out.mergeKeepsCleared = (mergeProgress(a, bOld).retry || []).length === 0 && (mergeProgress(bOld, a).retry || []).length === 0;
    return out;
  });
  ok('half-credit answer goes on the Try again list', r.halfQueued);
  ok('it comes back in that island\'s next round', r.cameBack);
  ok('it comes back as the same kind of question', r.sameKind);
  ok('with fresh numbers, not the same question', r.newNumbers, r.originalSig + '  ->  ' + r.freshSig);
  ok('and practises the same skill', r.sameSkill);
  ok('half credit again keeps it on the list', r.stillQueuedAfterHalf);
  ok('a clean first try takes it off the list', r.clearedAfterClean);
  ok('a full miss is queued as a kind of question', r.missQueued);
  ok('the Daily Mix brings it back too', r.mixHasRetry);
  ok('textbook question with half credit does not count as solved', r.bookHalfNotSolved);
  ok('it is first in line in the next Warm-up', r.bookHalfFirst);
  ok('a clean answer then marks it solved', r.bookCleanSolves);
  ok('an old copy on another device cannot bring back a cleared retry', r.mergeKeepsCleared);
  ok('no page errors', errs.length === 0, errs.join(' | '));
  await b.close(); return results;
};
