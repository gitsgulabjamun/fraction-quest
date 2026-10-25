const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.goto('file://' + require('path').join(__dirname, '../../public/index.html'));
  await p.fill('#nm', 'Tester'); await p.click('#start');
  await p.evaluate(() => { S.settings.unlockAll = true; S.settings.sound = false; saveLocal(); go('home'); });
  const fails = []; let total = 0;
  for (let w = 1; w <= 12; w++) for (let L = 1; L <= 3; L++) {
    for (let round = 0; round < (L === 1 ? 6 : 3); round++) {
      await p.evaluate(([w, L]) => startRound(w, L), [w, L]);
      const nq = await p.evaluate(() => RUN.qs.length); for (let i = 0; i < nq; i++) {
        const info = await p.evaluate(() => { const q = RUN.qs[RUN.i]; return { t: q.t, id: q.id, form: q.form, q: q.q, ans: q._ans && q._ans.tok ? { n: q._ans.n, d: q._ans.d, rn: q._raw ? q._raw.rn : null, rd: q._raw ? q._raw.rd : null } : q._ans, a: q.a, v: q.v, p: q.p, n: q.n, den: q.den, fig: q.fig, items: q.items }; });
        total++;
        // answer through the UI
        const perr = await p.evaluate((info) => { try {
          const set = (id, v) => { const el = document.getElementById(id); if (el) { el.value = v; } };
          const q = RUN.qs[RUN.i];
          if (info.t === 'frac' || info.t === 'read') {
            const A = q._ans;
            if (q.form === 'exact') { set('n', q._raw.rn); set('d', q._raw.rd); }
            else if (A.d === 1) { if (document.getElementById('w')) set('w', A.n); else { set('n', A.n); set('d', 1); } }
            else if (q.form === 'improper' || !document.getElementById('w')) { set('n', A.n); set('d', A.d); }
            else { const m = A.mixedParts(); if (m.w) set('w', m.w); set('n', m.n); set('d', m.d); }
          } else if (info.t === 'num') set('x', q._ans.n);
          else if (info.t === 'mcq') document.querySelector('.opt[data-i="' + q.a + '"]').click();
          else if (info.t === 'yn') document.querySelector('.opt[data-i="' + (q.a ? 1 : 0) + '"]').click();
          else if (info.t === 'cmp') document.querySelector('.cmpbtns .opt[data-s="' + q._ans + '"]').click();
          else if (info.t === 'order') { for (const s of q._ans) { const c = [...document.querySelectorAll('#pool .ochip')].find(x => x.dataset.p === s); c.click(); } }
          else if (info.t === 'shade') { const tot = q.fig.k === 'pie' ? q.fig.n : q.fig.r * q.fig.c; const k = q._ans.mul(tot).n; for (let j = 0; j < k; j++) document.querySelector('#fig .cell[data-i="' + j + '"]').dispatchEvent(new MouseEvent('click',{bubbles:true})); }
          else if (info.t === 'line') { const idx = q._ans.mul(q.den).n; document.querySelector('#fig .tick[data-i="' + idx + '"]').dispatchEvent(new MouseEvent('click',{bubbles:true})); }
          else if (info.t === 'open') {
            const fr = f => f.n + '/' + f.d;
            if (q.v === 'between') { const lo = F(q.p.lo), hi = F(q.p.hi); for (let j = 0; j < q.n; j++) { let f = lo.add(hi.sub(lo).mul(new Frac(j + 1, q.n + 1))); let s = fr(f); if (q.p.den) { const num = f.mul(q.p.den); s = (q.p.den * lo.val() + j + 1) + '/' + q.p.den; } set('o' + j, s); } }
            if (q.v === 'equiv') { const t = F(q.p.f); for (let j = 0; j < q.n; j++) set('o' + j, (t.n * (j + 2)) + '/' + (t.d * (j + 2))); }
            if (q.v === 'equivWithDen') { const t = F(q.p.f); let k = 1; while (t.d * k < q.p.lo) k++; set('o0', (t.n * k) + '/' + (t.d * k)); }
            if (q.v === 'pairsum') { const s = F(q.p.s); [[1, 2], [1, 4]].forEach(([a, b], j) => { const x = new Frac(a, b); const y = s.sub(x); set('o' + j + 'a', fr(x)); set('o' + j + 'b', (y.n * 3) + '/' + (y.d * 3)); }); }
          }
        } catch (e) { return e.message + ' ' + JSON.stringify(info).slice(0, 300); } return null; }, info);
        if (perr) { console.log('ANSWER-ERR', perr); }
        await p.click('#check');
        const fb = await p.evaluate(() => { const f = document.querySelector('.fb'); return f ? f.className + ' | ' + f.innerText.slice(0, 160) : 'none'; });
        if (!fb.includes('good')) { fails.push(w + '/' + L + ' ' + info.id + ' ' + info.t + ' :: ' + fb.replace(/\n/g, ' ') + ' :: ' + (info.q || '').slice(0, 80)); await p.evaluate(() => reveal(RUN.qs[RUN.i], true)); }
        await p.click('#next');
      }
      // results screen
      const ok = await p.evaluate(() => VIEW.name);
      if (ok !== 'results') fails.push('no results screen ' + w + '/' + L);
    }
  }
  // parent dashboard
  await p.evaluate(() => { go('parent', { tab: 'report' }); });
  await p.waitForTimeout(500);
  await p.screenshot({ path: (process.env.SHOTS || '/tmp') + '/parent.png', fullPage: true });
  await p.evaluate(() => go('home')); await p.waitForTimeout(200);
  await p.screenshot({ path: (process.env.SHOTS || '/tmp') + '/home.png', fullPage: false });
  console.log('questions played', total); console.log('fails', fails.length); fails.slice(0, 40).forEach(f => console.log(' ', f));
  console.log('errors', errs.length); errs.slice(0, 20).forEach(e => console.log(' ', e));
  await b.close();
})();
