// Typing answers the way phones do: characters arrive as text input with no keydown, so "1/4" can land in one box.
const { chromium } = require('playwright'); const path = require('path');
module.exports = async function typingE2E() {
  const b = await chromium.launch(); const p = await b.newPage(); const results = [];
  const ok = (name, cond, extra = '') => results.push((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : ''));
  await p.goto('file://' + path.join(__dirname, '../../public/index.html'));
  await p.fill('#nm', 'T'); await p.click('#start');
  const setQ = e => p.evaluate(e => { startRound(8, 2); const q = prepare({ id: 'type-' + e, t: 'frac', e, sk: 'addunlike' }); RUN.qs[0] = q; RUN.i = 0; newQ(); renderPlay(document.getElementById('app')); }, e);
  const phoneType = async (sel, text) => { await p.focus(sel); for (const ch of text) await p.keyboard.insertText(ch); };
  const boxes = () => p.evaluate(() => ({ w: document.getElementById('w').value, n: document.getElementById('n').value, d: document.getElementById('d').value }));
  const fb = () => p.evaluate(() => (document.querySelector('.fb') || {}).className || '');

  await setQ('1/8 + 1/8'); await phoneType('#n', '1/4');
  let v = await boxes(); ok('"1/4" typed in the top box splits into top and bottom', v.n === '1' && v.d === '4', JSON.stringify(v));
  await p.keyboard.press('Enter'); ok('and is marked correct', /good/.test(await fb()));

  await setQ('1_1/3 + 1'); await phoneType('#w', '2 1/3');
  v = await boxes(); ok('"2 1/3" typed in the whole box fills all three boxes', v.w === '2' && v.n === '1' && v.d === '3', JSON.stringify(v));
  await p.keyboard.press('Enter'); ok('and is marked correct', /good/.test(await fb()));

  await setQ('1/2 + 1/4'); await phoneType('#w', '3/4');
  v = await boxes(); ok('"3/4" typed in the whole box moves to top and bottom', v.w === '' && v.n === '3' && v.d === '4', JSON.stringify(v));

  await setQ('1/2 + 1/4'); await p.evaluate(() => { const n = document.getElementById('n'); n.focus(); n.value = '3/4'; n.dispatchEvent(new Event('input', { bubbles: true })); });
  v = await boxes(); ok('pasting "3/4" into the top box splits it', v.n === '3' && v.d === '4', JSON.stringify(v));

  await setQ('1/2 + 1/4'); await p.focus('#n'); await p.keyboard.type('3/4');
  v = await boxes(); ok('a real keyboard still jumps on the slash', v.n === '3' && v.d === '4', JSON.stringify(v));
  await b.close(); return results;
};
