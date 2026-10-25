// ---------- Exact fraction arithmetic ----------
function gcd(a, b){ a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; }
function lcm(a, b){ return Math.abs(a * b) / gcd(a, b); }

class Frac {
  constructor(n, d = 1){
    if (d === 0) throw new Error('zero denominator');
    if (d < 0) { n = -n; d = -d; }
    this.rn = n; this.rd = d;               // raw (unreduced) parts, kept for "exact" checks
    const g = gcd(n, d); this.n = n / g; this.d = d / g;
  }
  static of(x){ return x instanceof Frac ? x : new Frac(x, 1); }
  add(o){ o = Frac.of(o); return new Frac(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o){ o = Frac.of(o); return new Frac(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o){ o = Frac.of(o); return new Frac(this.n * o.n, this.d * o.d); }
  div(o){ o = Frac.of(o); if (o.n === 0) throw new Error('divide by zero'); return new Frac(this.n * o.d, this.d * o.n); }
  cmp(o){ o = Frac.of(o); const x = this.n * o.d - o.n * this.d; return x < 0 ? -1 : x > 0 ? 1 : 0; }
  eq(o){ return this.cmp(o) === 0; }
  isInt(){ return this.d === 1; }
  val(){ return this.n / this.d; }
  recip(){ return new Frac(this.d, this.n); }
  // token strings understood by the prompt renderer
  tok(){ // simplest, mixed when > 1
    if (this.d === 1) return String(this.n);
    const neg = this.n < 0, a = Math.abs(this.n);
    if (a > this.d) { const w = Math.floor(a / this.d), r = a % this.d; return '{' + (neg ? '-' : '') + w + ' ' + r + '/' + this.d + '}'; }
    return '{' + (neg ? '-' : '') + a + '/' + this.d + '}';
  }
  tokImp(){ return this.d === 1 ? String(this.n) : '{' + this.n + '/' + this.d + '}'; }
  tokRaw(){ return this.rd === 1 ? String(this.rn) : '{' + this.rn + '/' + this.rd + '}'; }
  key(){ return this.n + '/' + this.d; }
  mixedParts(){ const a = Math.abs(this.n); return { w: Math.floor(a / this.d), n: a % this.d, d: this.d, neg: this.n < 0 }; }
}

// parse "3/4", "2_1/3", "2 1/3", "5"  (keeps raw parts)
function F(s){
  if (s instanceof Frac) return s;
  s = String(s).trim();
  let m = s.match(/^(-?)(\d+)[_ ](\d+)\/(\d+)$/);
  if (m) { const w = +m[2], n = +m[3], d = +m[4]; const f = new Frac((w * d + n) * (m[1] ? -1 : 1), d); f.mixed = { w, n, d }; return f; }
  m = s.match(/^(-?\d+)\/(\d+)$/);
  if (m) return new Frac(+m[1], +m[2]);
  m = s.match(/^-?\d+$/);
  if (m) return new Frac(+s, 1);
  throw new Error('bad fraction ' + s);
}

// ---------- Expression parser (BODMAS with "of" above x and ÷) ----------
function tokenize(expr){
  const out = []; let i = 0; const s = expr;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ') { i++; continue; }
    const lit = s.slice(i).match(/^(\d+_\d+\/\d+|\d+\/\d+|\d+)/);
    if (lit) { out.push({ t: 'num', v: F(lit[1]), src: lit[1] }); i += lit[1].length; continue; }
    if (s.startsWith('of', i)) { out.push({ t: 'op', v: 'of' }); i += 2; continue; }
    if ('+-x×÷*'.includes(c)) { out.push({ t: 'op', v: c === '*' || c === '×' ? 'x' : c }); i++; continue; }
    if ('([{'.includes(c)) { out.push({ t: 'lp', v: c }); i++; continue; }
    if (')]}'.includes(c)) { out.push({ t: 'rp', v: c }); i++; continue; }
    throw new Error('bad char ' + c + ' in ' + expr);
  }
  return out;
}
function parseExpr(expr){
  const toks = tokenize(expr); let p = 0;
  const peek = () => toks[p], next = () => toks[p++];
  function primary(){
    const t = next();
    if (!t) throw new Error('unexpected end');
    if (t.t === 'num') return { k: 'n', v: t.v, src: t.src };
    if (t.t === 'lp') { const e = sum(); const r = next(); if (!r || r.t !== 'rp') throw new Error('missing )'); return { k: 'g', e, br: t.v }; }
    throw new Error('unexpected ' + JSON.stringify(t));
  }
  function ofx(){ let l = primary(); while (peek() && peek().v === 'of') { next(); l = { k: 'b', op: 'of', l, r: primary() }; } return l; }
  function prod(){ let l = ofx(); while (peek() && (peek().v === 'x' || peek().v === '÷')) { const op = next().v; l = { k: 'b', op, l, r: ofx() }; } return l; }
  function sum(){ let l = prod(); while (peek() && (peek().v === '+' || peek().v === '-')) { const op = next().v; l = { k: 'b', op, l, r: prod() }; } return l; }
  const ast = sum(); if (p !== toks.length) throw new Error('trailing tokens in ' + expr);
  return ast;
}
function unwrap(a){ while (a.k === 'g') a = a.e; return a; }

// Evaluate with a step trace for worked solutions
function evaluate(expr){
  const ast = parseExpr(expr); const steps = [];
  function ev(a){
    if (a.k === 'n') return a.v;
    if (a.k === 'g') return ev(a.e);
    const L = ev(a.l), R = ev(a.r);
    let v;
    if (a.op === '+') v = L.add(R); else if (a.op === '-') v = L.sub(R);
    else if (a.op === 'x' || a.op === 'of') v = L.mul(R); else v = L.div(R);
    steps.push({ op: a.op, L, R, v });
    return v;
  }
  const v = ev(ast);
  return { v, steps, ast };
}
function exprValue(e){ return evaluate(e).v; }

// Convert an expression into prompt tokens: "1_1/3 x 2/5" -> "{1 1/3} × {2/5}"
function exprToPrompt(e){
  const sym = { x: '×', '-': '−', '÷': '÷', '+': '+', of: 'of' };
  let out = '';
  for (const t of tokenize(e)) {
    if (t.t === 'num') out += (t.src.includes('_') ? '{' + t.src.replace('_', ' ') + '}' : t.src.includes('/') ? '{' + t.src + '}' : t.src) + ' ';
    else if (t.t === 'op') out += sym[t.v] + ' ';
    else if (t.t === 'lp') out += t.v;
    else out = out.trimEnd() + t.v + ' ';
  }
  return out.trim();
}

// ---------- Worked solution lines (token strings) ----------
const OPWORD = { '+': '+', '-': '−', 'x': '×', '÷': '÷', 'of': 'of' };
function stepLines(st){
  const { op, L, R, v } = st; const lines = [];
  const show = f => (f.mixed ? '{' + f.mixed.w + ' ' + f.mixed.n + '/' + f.mixed.d + '}' : f.tokImp());
  // mixed numbers into improper first
  [L, R].forEach(f => { if (f.mixed) lines.push('Change ' + show(f) + ' into an improper fraction: (' + f.mixed.w + ' × ' + f.mixed.d + ' + ' + f.mixed.n + ') ÷ ' + f.mixed.d + ' = ' + f.tokImp() + '.'); });
  const a = L, b = R;
  if (op === '+' || op === '-') {
    if (a.d === b.d) {
      lines.push('Same denominator ' + a.d + ', so ' + (op === '+' ? 'add' : 'subtract') + ' the numerators: ' + a.tokImp() + ' ' + OPWORD[op] + ' ' + b.tokImp() + ' = {' + (op === '+' ? a.n + b.n : a.n - b.n) + '/' + a.d + '}.');
    } else {
      const m = lcm(a.d, b.d), x = a.n * (m / a.d), y = b.n * (m / b.d);
      lines.push('The pieces are different sizes, so find a common denominator. LCM of ' + a.d + ' and ' + b.d + ' is ' + m + '.');
      lines.push(a.tokImp() + ' = {' + x + '/' + m + '} and ' + b.tokImp() + ' = {' + y + '/' + m + '}.');
      lines.push('{' + x + '/' + m + '} ' + OPWORD[op] + ' {' + y + '/' + m + '} = {' + (op === '+' ? x + y : x - y) + '/' + m + '}.');
    }
  } else if (op === 'x' || op === 'of') {
    if (op === 'of') lines.push('"of" means multiply.');
    lines.push('Multiply numerators and denominators: ' + a.tokImp() + ' × ' + b.tokImp() + ' = {' + a.n * b.n + '/' + a.d * b.d + '}.');
  } else {
    lines.push('Dividing by ' + b.tokImp() + ' is the same as multiplying by its reciprocal ' + b.recip().tokImp() + '.');
    lines.push(a.tokImp() + ' × ' + b.recip().tokImp() + ' = {' + a.n * b.d + '/' + a.d * b.n + '}.');
  }
  lines.push('Simplest form: ' + v.tok() + '.');
  return lines;
}
function solutionFor(e){
  const { steps, v } = evaluate(e);
  const out = [];
  steps.forEach((st, i) => { if (steps.length > 1) out.push('<b>Step ' + (i + 1) + ':</b> ' + st.L.tok() + ' ' + OPWORD[st.op] + ' ' + st.R.tok()); stepLines(st).forEach(l => out.push(l)); });
  if (steps.length === 0) out.push('The answer is ' + v.tok() + '.');
  return out;
}

// ---------- Common mistake detection ----------
function mistakeCandidates(e){
  const out = [];
  let ast; try { ast = unwrap(parseExpr(e)); } catch (_) { return out; }
  if (ast.k !== 'b') return out;
  const L = evaluate(exprOf(ast.l)).v, R = evaluate(exprOf(ast.r)).v;
  const lm = leafMixed(ast.l), rm = leafMixed(ast.r);
  try {
    if (ast.op === '+' && L.d !== R.d) out.push({ v: new Frac(L.n + R.n, L.d + R.d), msg: 'You added the denominators too. Can you add ' + pieceName(L.d) + ' and ' + pieceName(R.d) + ' directly? The pieces must be the same size first, so find a common denominator.' });
    if (ast.op === '-' && L.d !== R.d && L.d - R.d !== 0) out.push({ v: new Frac(L.n - R.n, L.d - R.d), msg: 'You subtracted the denominators. The denominator tells the SIZE of each piece. Make the pieces the same size first.' });
    if (ast.op === '-') out.push({ v: R.sub(L), msg: 'Check the order. You subtracted the wrong way round.' });
    if ((ast.op === 'x' || ast.op === 'of') && (lm || rm)) {
      const a = lm || { w: 0, n: L.n, d: L.d }, b = rm || { w: 0, n: R.n, d: R.d };
      if (lm && rm) out.push({ v: new Frac(a.w * b.w * a.d * b.d + a.n * b.n, a.d * b.d), msg: 'You multiplied the whole numbers and the fractions separately. That misses the cross parts. Change mixed numbers to improper fractions first.' });
    }
    if (ast.op === '÷') {
      out.push({ v: L.mul(R), msg: 'You multiplied without flipping. Dividing by a fraction means multiplying by its reciprocal.' });
      if (L.n !== 0) out.push({ v: L.recip().mul(R), msg: 'You flipped the wrong fraction. Keep the first one, flip the one you are dividing BY.' });
    }
    if ((ast.op === '+' || ast.op === '-') && (lm || rm) && L.d === R.d) {
      // forgot to carry when adding mixed numbers: rarely detectable generically
    }
  } catch (_) {}
  return out;
}
function pieceName(d){
  const named = { 1:'wholes', 2:'halves', 3:'thirds', 4:'quarters', 5:'fifths', 6:'sixths', 7:'sevenths', 8:'eighths', 9:'ninths', 10:'tenths', 11:'elevenths', 12:'twelfths' };
  return named[d] || d + 'ths';
}
function exprOf(a){
  if (a.k === 'n') return a.src;
  if (a.k === 'g') return '(' + exprOf(a.e) + ')';
  return exprOf(a.l) + ' ' + (a.op === '÷' ? '÷' : a.op) + ' ' + exprOf(a.r);
}
function leafMixed(a){ a = unwrap(a); return a.k === 'n' && a.v.mixed ? a.v.mixed : null; }

// ---------- Answer checking ----------
// input: {w, n, d} strings (frac) or {x} string (num)
function readInput(inp){
  const w = (inp.w || '').trim(), n = (inp.n || '').trim(), d = (inp.d || '').trim();
  if (inp.x !== undefined) {
    const x = String(inp.x).trim().replace(/,/g, '');
    if (!x) return { err: 'Type an answer first.' };
    if (/^-?\d+(\.\d+)?$/.test(x)) { const [ip, fp = ''] = x.split('.'); const den = Math.pow(10, fp.length); return { f: new Frac(Math.round(parseFloat(x) * den), den), dec: fp.length > 0 }; }
    try { return { f: F(x.replace(/\s+/g, ' ')) }; } catch (_) { return { err: 'Write a whole number, like 24.' }; }
  }
  if (!n && !d && w) { if (!/^-?\d+$/.test(w)) return { err: 'Use digits only.' }; return { f: new Frac(+w, 1), whole: true, wOnly: true }; }
  if (!n || !d) return { err: 'Fill in both the top and the bottom of the fraction.' };
  if (![w || '0', n, d].every(s => /^-?\d+$/.test(s))) return { err: 'Use digits only.' };
  if (+d === 0) return { err: 'A denominator can never be 0. You cannot cut something into 0 pieces.' };
  const W = +(w || 0), N = +n, D = +d;
  const f = new Frac(W * D + N, D);
  return { f, W, N, D, hasW: !!w && W !== 0 };
}

function checkFrac(q, inp){
  const r = readInput(inp); if (r.err) return { status: 'invalid', msg: r.err };
  const exp = q._ans; const f = r.f; const form = q.form || 'any';
  if (form === 'exact') {
    const want = q._raw;
    if (!f.eq(exp)) return wrongWithTraps(q, f);
    const N = r.hasW ? r.W * r.D + r.N : (r.N !== undefined ? r.N : f.n), D = r.D !== undefined ? r.D : 1;
    if (N === want.rn && D === want.rd) return { status: 'correct' };
    return { status: 'wrongform', msg: 'Same value, but the question asks for ' + (q.q.includes('numerator') ? 'that numerator' : 'that denominator') + '. Multiply or divide the top and bottom by the same number to get it.' };
  }
  if (!f.eq(exp)) return wrongWithTraps(q, f);
  // value is right. Now the form.
  if (r.wOnly) return { status: 'correct' };
  if (r.hasW && r.N >= r.D) return { status: 'wrongform', msg: 'Right value, but in a mixed number the fraction part must be smaller than 1. Can you carry the extra whole?' };
  const fracPartReduced = gcd(r.N, r.D) === 1;
  if (form === 'improper') {
    if (r.hasW) return { status: 'wrongform', msg: 'Right value. The question wants an improper fraction, so write it with no whole number part.' };
    if (!fracPartReduced) return { status: 'unsimplified', msg: 'Right value! Can you simplify it?' };
    return { status: 'correct' };
  }
  if (exp.isInt()) return { status: 'unsimplified', msg: 'Right value! But ' + (r.hasW ? '' : '{' + r.N + '/' + r.D + '} ') + 'is a whole number in disguise. Write it as ' + exp.n + '.' };
  if (!fracPartReduced) return { status: 'unsimplified', msg: 'Right value! The numerator and denominator still share a factor of ' + gcd(r.N, r.D) + '. Simplify it.' };
  if (form === 'mixed' && !r.hasW && Math.abs(exp.n) > exp.d) return { status: 'wrongform', msg: 'Right value. Now write it as a mixed number (whole number plus a proper fraction).' };
  if (!r.hasW && Math.abs(exp.n) > exp.d && form !== 'improper') return { status: 'correct', tip: 'Tip: you can also write this as ' + exp.tok() + '.' };
  return { status: 'correct' };
}
function wrongWithTraps(q, f){
  for (const t of (q._traps || [])) { try { if (F(t.v).eq(f)) return { status: 'wrong', msg: t.msg, trap: true }; } catch (_) {} }
  return { status: 'wrong' };
}
function checkNum(q, inp){
  const r = readInput({ x: inp.x }); if (r.err) return { status: 'invalid', msg: r.err };
  if (r.f.eq(q._ans)) return { status: 'correct' };
  return wrongWithTraps(q, r.f);
}

// ---------- Open-ended validators ----------
const VALIDATORS = {
  between(p, list){ const lo = F(p.lo), hi = F(p.hi); return list.every(f => f.cmp(lo) > 0 && f.cmp(hi) < 0) ? null : 'Each fraction must be bigger than ' + lo.tok() + ' and smaller than ' + hi.tok() + '.'; },
  equiv(p, list){ const t = F(p.f); for (const f of list) { if (!f.eq(t)) return f.tokRaw() + ' is not equal to ' + t.tok() + '. Multiply top and bottom by the SAME number.'; if (f.rn === t.rn && f.rd === t.rd) return 'Write new fractions, not ' + t.tokRaw() + ' itself.'; } return null; },
  pairsum(p, pairs){ const s = F(p.s); for (const [a, b] of pairs) { if (!a.add(b).eq(s)) return a.tokRaw() + ' + ' + b.tokRaw() + ' = ' + a.add(b).tok() + ', not ' + s.tok() + '.'; } return null; },
  equivWithDen(p, list){ const t = F(p.f); for (const f of list) { if (!f.eq(t)) return f.tokRaw() + ' is not equal to ' + t.tok() + '.'; if (f.rd < p.lo || f.rd > p.hi) return 'The denominator must be between ' + p.lo + ' and ' + p.hi + '.'; } return null; },
};
function distinct(list){ const seen = new Set(); for (const f of list) { const k = f.rn + '/' + f.rd; if (seen.has(k)) return false; seen.add(k); } return true; }

// Prepare a question: compute answer, traps, solution
function prepare(q){
  if (q._ready) return q;
  try {
    if (q.e) {
      const ev = evaluate(q.e); q._ans = ev.v;
      try { q._raw = F(q.e); } catch (_) { q._raw = ev.v; }
      if (!q.q) q.q = 'Find: ' + exprToPrompt(q.e);
      else if (q.q === 'Simplify:' || q.q === 'Evaluate:') q.q = q.q + ' ' + exprToPrompt(q.e);
      q._traps = (q.traps || []).concat(mistakeCandidates(q.e).filter(c => !c.v.eq(ev.v)).map(c => ({ v: c.v.tokImp().replace(/[{}]/g, ''), msg: c.msg })));
      if (!q.sol && ev.steps.length) q.sol = solutionFor(q.e);
      if (q.t === 'num' && !ev.v.isInt()) q.t = 'frac';
    }
    if (q.t === 'cmp') { const c = F(q.L).cmp(F(q.R)); q._ans = c < 0 ? '<' : c > 0 ? '>' : '='; if (!q.q) q.q = 'Put the right sign: &lt;, &gt; or ='; }
    if (q.t === 'yn' && q.a === undefined) q.a = q.q.startsWith('Is {') ? (F(q.L).eq(F(q.R)) && gcd(F(q.L).rn, F(q.L).rd) === 1) : F(q.L).eq(F(q.R));
    if (q.t === 'order') { const fs = q.items.map(F); q._ans = q.items.map((s, i) => [s, fs[i]]).sort((x, y) => q.dir === 'asc' ? x[1].cmp(y[1]) : y[1].cmp(x[1])).map(x => x[0]); if (!q.q) q.q = 'Arrange in ' + (q.dir === 'asc' ? 'ascending order (smallest first)' : 'descending order (largest first)') + '. Tap them in order.'; }
    if (q.t === 'line') { q._ans = F(q.e); }
    if (q.t === 'shade') { q._ans = F(q.e); }
  } catch (err) { q._broken = String(err); }
  q._ready = true; return q;
}

if (typeof module !== 'undefined') module.exports = { Frac, F, gcd, lcm, evaluate, exprValue, exprToPrompt, solutionFor, mistakeCandidates, checkFrac, checkNum, VALIDATORS, prepare, distinct, parseExpr };
