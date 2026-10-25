const { chromium, devices } = require('playwright');
const SP = '' + (process.env.SHOTS || '/tmp') + '/';
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['Pixel 5'] }); const p = await ctx.newPage();
  await p.goto('file://' + require('path').join(__dirname, '../../public/index.html'));
  await p.fill('#nm', 'T'); await p.tap('#start');
  await p.evaluate(() => { S.settings.unlockAll = true; saveLocal(); go('home'); });
  const over = [];
  const chk = async (label) => { const r = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })); if (r.sw > r.cw + 1) over.push(label + ' ' + r.sw + '>' + r.cw); };
  await chk('home'); await p.screenshot({ path: SP + 'm-home.png' });
  const types = await p.evaluate(() => { const seen = {}; const out = []; for (let w = 1; w <= 12; w++) for (const L of [1,2,3]) { const qs = L === 1 ? BOOK[w].map(prepare) : [...Array(40)].map(() => makeQuestion(w, L)); for (const q of qs) { const k = q.t + (q.fig ? q.fig.k : '') + (q.max || ''); if (!seen[k]) { seen[k] = 1; out.push([w, L, q.id]); window.__Q = window.__Q || {}; window.__Q[q.id] = q; } } } return out; });
  // also the hardest line: max 3 den 4 and a big generated den
  for (const [w, L, id] of types) {
    await p.evaluate((id) => { startRound(1, 1); RUN.qs[0] = window.__Q[id]; RUN.i = 0; newQ(); renderPlay(document.getElementById('app')); }, id);
    await chk(id);
  }
  // tick spacing on number lines
  const ticks = await p.evaluate(() => { const qs = [...Object.values(window.__Q)].filter(q => q.t === 'line'); return qs.map(q => { RUN.qs[0] = q; RUN.i = 0; newQ(); renderPlay(document.getElementById('app')); const t = [...document.querySelectorAll('#fig .tick')].map(e => e.getBoundingClientRect().width); return q.id + ' max' + q.max + ' den' + q.den + ' tap ' + Math.min(...t).toFixed(0) + 'px'; }); });
  await p.evaluate(() => { const q = Object.values(window.__Q).find(q => q.t === 'line' && q.max === 3); RUN.qs[0] = q; newQ(); renderPlay(document.getElementById('app')); }); await p.screenshot({ path: SP + 'm-line.png' });
  await p.evaluate(() => { const q = prepare(BOOK[4][0]); RUN.qs[0] = q; newQ(); renderPlay(document.getElementById('app')); }); await p.screenshot({ path: SP + 'm-frac.png' });
  await p.evaluate(() => go('parent', { tab: 'report' })); await p.waitForTimeout(400); await chk('parent'); await p.screenshot({ path: SP + 'm-parent.png' });
  console.log('types tested', types.length, 'overflow', over); console.log(ticks.join('\n'));
  await b.close();
})();
