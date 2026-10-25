const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + require('path').join(__dirname, '../../public/index.html'));
  await p.fill('#nm', 'T'); await p.click('#start');
  const res = await p.evaluate(() => {
    const out = { checked: 0, bad: [] };
    const qs = [];
    for (const w in BOOK) BOOK[w].forEach(q => qs.push(prepare(q)));
    for (let w = 1; w <= 12; w++) for (const L of [2, 3]) for (let i = 0; i < 60; i++) qs.push(makeQuestion(w, L));
    const countShaded = f => { if (f.k === 'row') return f.items.reduce((a, it) => a + countShaded(it), 0); if (['grid','pie','dots','strip'].includes(f.k)) return (f.s || []).length; if (f.k === 'tri3' || f.k === 'band') return 1; return 0; };
    startRound(1, 1);
    for (const q of qs) {
      if (!q.fig && !q.figOpts) continue;
      RUN.qs[0] = q; RUN.i = 0; newQ(); renderPlay(document.getElementById('app')); out.checked++;
      const card = document.querySelector('.card');
      const drawn = [...card.querySelectorAll('svg [fill="var(--coral)"]')].filter(el => el.tagName !== 'circle' || !el.closest('svg').querySelector('line[stroke-width="3"]')).length;
      if (q.fig && q.fig.k === 'nl') { const dot = card.querySelector('#fig circle[fill="var(--coral)"], .figwrap circle[fill="var(--coral)"]'); if (!dot) out.bad.push(q.id + ' number line dot missing'); continue; }
      const want = q.t === 'shade' ? 0 : (q.figOpts ? q.figOpts.reduce((a, f) => a + countShaded(f), 0) : countShaded(q.fig));
      if (drawn !== want) out.bad.push(q.id + ' ' + q.t + ' drawn ' + drawn + ' want ' + want);
    }
    return out;
  });
  console.log('figures checked', res.checked, 'bad', res.bad.length); res.bad.slice(0, 20).forEach(x => console.log(' ', x));
  await b.close();
})();
