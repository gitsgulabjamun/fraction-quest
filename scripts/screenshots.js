// Captures README screenshots in demo mode through the local server.
const { chromium, devices } = require('playwright'); const path = require('path');
const { answerCorrectly } = require('../tests/e2e/answer');
(async () => {
  process.env.FAMILY_CODE = 'shots'; const server = require('./dev-server.js'); await new Promise(r => server.on('listening', r));
  const base = 'http://localhost:' + server.address().port; const out = f => path.join(__dirname, '../docs', f);
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1100, height: 820 }, deviceScaleFactor: 1 })).newPage();
  const settle = () => p.waitForTimeout(600);
  await p.goto(base + '/'); await p.waitForSelector('#fcode'); await settle(); await p.screenshot({ path: out('gate.png') });
  await p.click('#gdemo'); await p.waitForSelector('#nm'); await p.fill('#nm', 'Meera'); await p.click('#start'); await p.waitForSelector('.lv');
  // a little progress so the map and report have something to show
  await p.evaluate(() => { S.settings.unlockAll = true; S.settings.sound = false; saveLocal(); });
  for (const [w, l] of [[1, 1], [1, 2], [8, 3]]) { await p.evaluate(([w, l]) => startRound(w, l), [w, l]); for (let i = 0; i < 10; i++) { if (i % 4 === 3) await p.evaluate(() => reveal(RUN.qs[RUN.i], true)); else { await p.evaluate(answerCorrectly); await p.click('#check'); } await p.click('#next'); } await p.click('#home'); }
  await p.evaluate(() => { S.settings.unlockAll = false; saveLocal(); go('home'); }); await settle(); await p.screenshot({ path: out('map.png') });
  await p.evaluate(() => { startRound(8, 3); const q = makeQuestion(8, 3); RUN.qs[0] = q; RUN.i = 0; newQ(); renderPlay(document.getElementById('app')); });
  await p.evaluate(() => { const q = prepare({ id: 'shot', t: 'frac', e: '1/3 + 1/4', sk: 'addunlike' }); RUN.qs[0] = q; newQ(); renderPlay(document.getElementById('app')); });
  await p.fill('#n', '2'); await p.fill('#d', '7'); await p.click('#check'); await settle(); await p.screenshot({ path: out('mistake-feedback.png') });
  await p.evaluate(() => { const q = BOOK[1].find(x => x.id === '1-1b'); RUN.qs[0] = prepare(q); newQ(); renderPlay(document.getElementById('app')); }); await settle(); await p.screenshot({ path: out('figure-question.png') });
  await p.evaluate(() => { S.settings.pin = '1234'; go('parent', { tab: 'report' }); }); await p.waitForSelector('.tiles'); await settle(); await p.screenshot({ path: out('parent-report.png'), fullPage: true });
  const m = await (await b.newContext({ ...devices['Pixel 5'] })).newPage(); await m.goto(base + '/#demo'); await m.waitForSelector('#nm'); await m.fill('#nm', 'Meera'); await m.click('#start');
  await m.evaluate(() => { const q = prepare(BOOK[4].find(x => x.id === '4-3b')); startRound(4, 1); RUN.qs[0] = q; newQ(); renderPlay(document.getElementById('app')); }); await m.waitForTimeout(600); await m.screenshot({ path: out('phone-number-line.png') });
  await b.close(); server.close(); console.log('screenshots saved to docs/');
})();
