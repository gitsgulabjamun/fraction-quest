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
    await phone.click('#parentBtn'); await phone.fill('#pin', '2468'); await phone.click('#po');
    await phone.waitForSelector('.tiles');
    await phone.click('#tabS'); await phone.click('#reptest'); await phone.waitForFunction(() => /Meera practised fractions/.test(document.querySelector('#repres').textContent));
    const repText = await phone.innerText('#repres');
    ok('test report button returns the report', /5 questions/.test(repText) && /No delivery channel/.test(repText), repText.split('\n')[0]);
    await phone.screenshot({ path: process.env.SHOTS + '/web-report-settings.png', fullPage: true });
    await demo.screenshot({ path: process.env.SHOTS + '/web-demo-home.png' });
    // 6. parent goes straight from the code screen to the report, no player setup
    const parentDev = watch(await (await b.newContext({ ...devices['Pixel 5'] })).newPage());
    await parentDev.goto(base + '/'); await parentDev.waitForSelector('#gparent');
    await parentDev.click('#gparent'); ok('parent link without a code asks for the code', /Enter the family code first/.test(await parentDev.innerText('#gerr')));
    await parentDev.fill('#fcode', process.env.FAMILY_CODE); await parentDev.click('#gparent');
    await parentDev.waitForSelector('#pin'); await parentDev.fill('#pin', '2468'); await parentDev.click('#po'); await parentDev.waitForSelector('.tiles');
    ok('code screen parent link opens the report on a new phone', /QUESTIONS TODAY\s*5/i.test(await parentDev.innerText('.tiles')));
    // labelled parent button on the map, and a parent link on the name screen
    ok('map shows a labelled Parent button', (await laptop.innerText('#parentBtn')).trim() === 'Parent');
    const fresh = watch(await (await b.newContext()).newPage());
    await fresh.goto(base + '/#demo'); await fresh.waitForSelector('#obParent');
    await fresh.click('#obParent'); ok('name screen has a parent link that opens the PIN box', !!(await fresh.$('#pin')));
    // 7. report Refresh picks up play from another device without reopening
    await parentDev.click('#prefresh'); await parentDev.waitForSelector('.tiles');
    const before = await parentDev.innerText('.tiles');
    await laptop.click('.lv[data-w="1"][data-l="1"]'); await laptop.waitForSelector('#check');
    await laptop.evaluate(answerCorrectly); await laptop.click('#check'); await laptop.click('#next'); await laptop.click('#quit'); await laptop.waitForSelector('#home');
    await laptop.waitForTimeout(4500);
    await parentDev.click('#prefresh'); await parentDev.waitForSelector('.tiles');
    const afterTiles = await parentDev.innerText('.tiles');
    ok('Refresh shows her new question without reopening the report', /QUESTIONS TODAY\s*5/i.test(before) && /QUESTIONS TODAY\s*6/i.test(afterTiles), afterTiles.replace(/\n/g, ' ').slice(0, 60));
    ok('report says the data is live from the server', /Live from the server/.test(await parentDev.innerText('.dash')));
    // 8. a stale parent device saving settings does not overwrite her newer progress
    const xpServer = (await api('/api/doc?path=progress/main')).data.xp;
    await parentDev.evaluate(() => { S.xp = 1; S.updatedAt = 1; }); // simulate a copy loaded long ago
    await parentDev.click('#tabS'); await parentDev.waitForSelector('#ssave'); await parentDev.fill('#goal', '50'); await parentDev.click('#ssave'); await parentDev.waitForTimeout(5000);
    const progAfter = (await api('/api/doc?path=progress/main')).data;
    ok('stale parent device keeps her XP when saving a setting', progAfter.xp === xpServer && progAfter.settings.goalMin === 50, 'xp ' + progAfter.xp + ' vs ' + xpServer + ', goal ' + progAfter.settings.goalMin);
    // 9. when saving fails the map says so, then it retries and recovers
    let block = true;
    await laptop.route(u => decodeURIComponent(String(u)).includes('/api/doc?path=log/'), route => block && route.request().method() === 'PUT' ? route.fulfill({ status: 500, body: '{"error":"down"}' }) : route.continue());
    await laptop.click('#home').catch(() => {}); await laptop.evaluate(() => go('home'));
    await laptop.click('.lv[data-w="1"][data-l="1"]'); await laptop.waitForSelector('#check');
    await laptop.evaluate(answerCorrectly); await laptop.click('#check'); await laptop.click('#next'); await laptop.click('#quit');
    await laptop.waitForFunction(() => /Not saved online yet/.test(document.body.innerText), null, { timeout: 15000 });
    ok('results screen says when saving failed', true);
    block = false;
    ok('status stays "Not saved" while her questions are not on the server', /Not saved online yet/.test(await laptop.evaluate(() => document.body.innerText)));
    await laptop.waitForFunction(() => /Saved online/.test(document.body.innerText), null, { timeout: 40000 });
    const recovered = (await api('/api/logs')).logs[0].att;
    ok('failed save retries by itself and reaches the server', recovered === 7, 'att ' + recovered);
    // 10. answers that never reached the server are uploaded the next time the game opens
    const kid = watch(await (await b.newContext()).newPage());
    await kid.goto(base + '/'); await kid.fill('#fcode', process.env.FAMILY_CODE); await kid.click('#genter'); await kid.waitForSelector('.lv');
    await kid.route(u => decodeURIComponent(String(u)).includes('/api/doc?path=log/'), route => route.request().method() === 'PUT' ? route.fulfill({ status: 500, body: '{}' }) : route.continue());
    await kid.click('.lv[data-w="1"][data-l="1"]'); await kid.waitForSelector('#check');
    for (let i = 0; i < 2; i++) { await kid.evaluate(answerCorrectly); await kid.click('#check'); await kid.click('#next'); }
    await kid.waitForTimeout(4000);
    const beforeReopen = (await api('/api/logs')).logs[0].att;
    await kid.unroute(() => true); await kid.close({ runBeforeUnload: false });
    const kid2 = watch(await kid.context().newPage()); await kid2.goto(base + '/'); await kid2.waitForSelector('.lv'); await kid2.waitForTimeout(3000);
    const afterReopen = (await api('/api/logs')).logs[0].att;
    ok('unsaved answers upload when the game is opened again', beforeReopen === 7 && afterReopen === 9, 'before ' + beforeReopen + ', after ' + afterReopen);
    // 11. forgotten code: a device with a stale code is sent back to the gate
    const stale = watch(await (await b.newContext()).newPage());
    await stale.goto(base + '/'); await stale.evaluate(() => localStorage.setItem('fq.familyCode', 'old-code')); await stale.reload();
    await stale.waitForSelector('#fcode'); ok('stale code goes back to the gate', /no longer works/.test(await stale.innerText('#gerr')));
  } finally { await b.close(); server.close(); }
  ok('no page errors', errs.length === 0, errs.join(' | '));
  return results;
};
