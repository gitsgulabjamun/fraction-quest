// Answers the current question correctly through the real UI. Runs inside the page.
module.exports.answerCorrectly = function () {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  const click = el => el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  const q = RUN.qs[RUN.i];
  if (q.t === 'frac' || q.t === 'read') {
    const A = q._ans;
    if (q.form === 'exact') { set('n', q._raw.rn); set('d', q._raw.rd); }
    else if (A.d === 1) { if (document.getElementById('w')) set('w', A.n); else { set('n', A.n); set('d', 1); } }
    else if (q.form === 'improper' || !document.getElementById('w')) { set('n', A.n); set('d', A.d); }
    else { const m = A.mixedParts(); if (m.w) set('w', m.w); set('n', m.n); set('d', m.d); }
  } else if (q.t === 'num') set('x', q._ans.n);
  else if (q.t === 'mcq') click(document.querySelector('.opt[data-i="' + q.a + '"]'));
  else if (q.t === 'yn') click(document.querySelector('.opt[data-i="' + (q.a ? 1 : 0) + '"]'));
  else if (q.t === 'cmp') click(document.querySelector('.cmpbtns .opt[data-s="' + q._ans + '"]'));
  else if (q.t === 'order') { for (const s of q._ans) click([...document.querySelectorAll('#pool .ochip')].find(x => x.dataset.p === s)); }
  else if (q.t === 'shade') { const tot = q.fig.k === 'pie' ? q.fig.n : q.fig.r * q.fig.c; const k = q._ans.mul(tot).n; for (let j = 0; j < k; j++) click(document.querySelector('#fig .cell[data-i="' + j + '"]')); }
  else if (q.t === 'line') { click(document.querySelector('#fig .tick[data-i="' + q._ans.mul(q.den).n + '"]')); }
  else if (q.t === 'open') {
    const fr = f => f.n + '/' + f.d;
    if (q.v === 'between') { const lo = F(q.p.lo), hi = F(q.p.hi); for (let j = 0; j < q.n; j++) { const f = lo.add(hi.sub(lo).mul(new Frac(j + 1, q.n + 1))); set('o' + j, q.p.den ? (q.p.den * lo.val() + j + 1) + '/' + q.p.den : fr(f)); } }
    if (q.v === 'equiv') { const t = F(q.p.f); for (let j = 0; j < q.n; j++) set('o' + j, (t.n * (j + 2)) + '/' + (t.d * (j + 2))); }
    if (q.v === 'equivWithDen') { const t = F(q.p.f); let k = 1; while (t.d * k < q.p.lo) k++; set('o0', (t.n * k) + '/' + (t.d * k)); }
    if (q.v === 'pairsum') { const s = F(q.p.s); [[1, 2], [1, 4]].forEach(([a, b], j) => { const x = new Frac(a, b); const y = s.sub(x); set('o' + j + 'a', fr(x)); set('o' + j + 'b', (y.n * 3) + '/' + (y.d * 3)); }); }
  }
};
