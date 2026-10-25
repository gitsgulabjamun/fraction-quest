// End to end through the local server and real API handlers: gate, play, sync across devices, demo isolation, report.
const { chromium, devices } = require('playwright');
const assert = require('assert/strict');
const { answerCorrectly } = require('./answer');
module.exports = async function webE2E() {
  process.env.FAMILY_CODE = 'e2e-family-code'; global.__fqMem = undefined;
  delete process.env.KV_REST_API_URL; delete process.env.VERCEL;
  const server = require('../../scripts/dev-server.js');
  await new Promise(r => server.listening ? r() : server.on('listening', r));
  const base = 'http://localhost:' + server.address().port;
  const api = async (p, opts = {}) => (await fetch(base + p, { ...opts, headers: { 'x-family-code': process.env.FAMILY_CODE, 'content-type': 'application/json', ...(opts.headers || {}) } })).json();
  const b = await chromium.launch(); const errs = [];
  const watch = p => { p.on('pageerror', e => errs.push(e.message)); return p; };
  const results = [];
  const ok = (name, cond, extra = '') => { results.push((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); };
  try {
    // 1. laptop: gate, wrong code, right code, onboarding
    const laptop = watch(await (await b.newContext({ viewport: { width: 1200, height: 900 } })).newPage());
    await laptop.goto(base + '/'); await laptop.waitForSelector('#fcode');
    ok('gate shows on first visit', true);
    await laptop.fill('#fcode', 'wrong'); await laptop.click('#genter'); await laptop.waitForFunction(() => /not right/.test(document.querySelector('#gerr').textContent));
    ok('wrong code is refused with a clear message', true);
    await laptop.fill('#fcode', process.env.FAMILY_CODE); await laptop.click('#genter'); await laptop.waitForSelector('#nm');
    ok('right code opens the game', true);
    await laptop.fill('#nm', 'Meera'); await laptop.click('#start'); await laptop.waitForSelector('.lv');
    // 2. play a warm-up round: 3 right, 1 wrong revealed, then quit
    await laptop.click('.lv[data-w="1"][data-l="1"]'); await laptop.waitForSelector('#check');
    for (let i = 0; i < 3; i++) { await laptop.evaluate(answerCorrectly); await laptop.click('#check'); await laptop.click('#next'); }
    await laptop.evaluate(() => reveal(RUN.qs[RUN.i], true)); await laptop.click('#next');
    await laptop.click('#quit'); await laptop.waitForSelector('#home');
    await laptop.waitForTimeout(4500); // debounced sync
    const logs = await api('/api/logs');
    const today = logs.logs[0];
    ok('practice log reached the server', today && today.att === 4 && today.cor === 3, today ? 'att ' + today.att + ' cor ' + today.cor : 'no log');
    ok('mistake recorded with her answer and the correct one', today && today.attempts.some(a => a.ok === 0 && a.x));
    const prog = await api('/api/doc?path=progress/main');
    ok('progress reached the server', prog.exists && prog.data.player.name === 'Meera' && prog.data.xp > 0, 'xp ' + (prog.data && prog.data.xp));
    ok('family code is not stored in progress', !JSON.stringify(prog.data).includes(process.env.FAMILY_CODE));
    // 3. phone: same family, sees the same progress without onboarding
    const phone = watch(await (await b.newContext({ ...devices['Pixel 5'] })).newPage());
    await phone.goto(base + '/'); await phone.fill('#fcode', process.env.FAMILY_CODE); await phone.click('#genter');
    await phone.waitForSelector('.lv');
    const phoneState = await phone.evaluate(() => ({ name: S.player.name, xp: S.xp, att: today().att }));
    ok('phone picks up name, XP and today\'s count', phoneState.name === 'Meera' && phoneState.xp === prog.data.xp && phoneState.att === 4, JSON.stringify(phoneState));
    // parent report on phone
    await phone.click('#parentBtn'); await phone.fill('#pin', '2468'); await phone.click('#po'); await phone.waitForSelector('.tiles');
    const tileText = await phone.innerText('.tiles');
    ok('parent report on phone shows 4 questions today', /QUESTIONS TODAY\s*4/i.test(tileText), tileText.replace(/\n/g, ' | ').slice(0, 120));
    const mistakesPanel = await phone.innerText('.dash');
    ok('parent report lists the mistake', /wrong/i.test(mistakesPanel));
    // phone continues playing, laptop sees it after reload
    await phone.click('#pback'); await phone.click('.lv[data-w="1"][data-l="1"]'); await phone.waitForSelector('#check');
    await phone.evaluate(answerCorrectly); await phone.click('#check'); await phone.click('#next'); await phone.click('#quit'); await phone.waitForSelector('#home');
    await phone.waitForTimeout(4500);
    await laptop.reload(); await laptop.waitForSelector('.lv');
    const lap2 = await laptop.evaluate(() => today().att);
    ok('laptop sees phone\'s extra question after reload', lap2 === 5, 'att ' + lap2);
    // 4. demo: isolated from the family data
    const demo = watch(await (await b.newContext()).newPage());
    await demo.goto(base + '/'); await demo.click('#gdemo'); await demo.waitForSelector('#nm');
    await demo.fill('#nm', 'Recruiter'); await demo.click('#start'); await demo.waitForSelector('#exitDemo');
    await demo.click('.lv[data-w="1"][data-l="1"]'); await demo.waitForSelector('#check');
    await demo.evaluate(answerCorrectly); await demo.click('#check'); await demo.click('#next'); await demo.click('#quit');
    await demo.waitForTimeout(4500);
    const after = await api('/api/logs'); const p2 = await api('/api/doc?path=progress/main');
    ok('demo play never touches family data', after.logs[0].att === 5 && p2.data.player.name === 'Meera', 'att ' + after.logs[0].att);
    // 5. report endpoint from the parent settings button
    await phone.click('#home'); await phone.waitForSelector('#parentBtn');
    await phone.click('#parentBtn'); await phone.fill('#pin', '2468'); await phone.click('#po'); await phone.waitForSelector('.tiles');
    await phone.click('#tabS'); await phone.click('#reptest'); await phone.waitForFunction(() => /Meera practised fractions/.test(document.querySelector('#repres').textContent));
    const repText = await phone.innerText('#repres');
    ok('test report button returns the report', /5 questions/.test(repText) && /No delivery channel/.test(repText), repText.split('\n')[0]);
    await phone.screenshot({ path: process.env.SHOTS + '/web-report-settings.png', fullPage: true });
    await demo.screenshot({ path: process.env.SHOTS + '/web-demo-home.png' });
    // 6. forgotten code: a device with a stale code is sent back to the gate
    const stale = watch(await (await b.newContext()).newPage());
    await stale.goto(base + '/'); await stale.evaluate(() => localStorage.setItem('fq.familyCode', 'old-code')); await stale.reload();
    await stale.waitForSelector('#fcode'); ok('stale code goes back to the gate', /no longer works/.test(await stale.innerText('#gerr')));
  } finally { await b.close(); server.close(); }
  ok('no page errors', errs.length === 0, errs.join(' | '));
  return results;
};
