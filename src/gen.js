// Fresh question generators. Level 2 = core practice with new numbers. Level 3 = twists that force first principles thinking.
const R = {
  int(a, b){ return a + Math.floor(Math.random() * (b - a + 1)); },
  pick(a){ return a[Math.floor(Math.random() * a.length)]; },
  shuffle(a){ a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
  coprime(lo, hi, d){ let n; do { n = R.int(lo, hi); } while (gcd(n, d) !== 1); return n; },
  sample(n, k){ return R.shuffle([...Array(n).keys()]).slice(0, k); },
};
const NAMES = ['Aarav','Diya','Kabir','Ira','Vihaan','Anaya','Reyansh','Myra','Arjun','Saanvi','Ishaan','Kiara','Rohan','Tara','Neel','Zoya'];
const nm = () => (typeof PLAYER !== 'undefined' && PLAYER.name && Math.random() < 0.3) ? PLAYER.name : R.pick(NAMES);
const fs = (n, d) => n + '/' + d;                    // fraction source string
const tk = (n, d) => '{' + n + '/' + d + '}';        // prompt token
const mx = (w, n, d) => w + '_' + n + '/' + d;       // mixed source
const tkm = (w, n, d) => '{' + w + ' ' + n + '/' + d + '}';
const properFrac = (dLo = 2, dHi = 12) => { const d = R.int(dLo, dHi); return [R.coprime(1, d - 1, d), d]; };
const fig = { grid: (r, c, s = []) => ({ k: 'grid', r, c, s }), pie: (n, s = []) => ({ k: 'pie', n, s }) };

function randomShape(n){ // a figure with n equal parts
  const opts = [];
  for (let r = 1; r <= 4; r++) if (n % r === 0 && n / r <= 6) opts.push(fig.grid(r, n / r));
  if (n <= 10) opts.push(fig.pie(n));
  return R.pick(opts);
}

const GEN = {
  // ===================== World 1: meaning of a fraction =====================
  1: {
    L2: [
      () => { const d = R.pick([3,4,5,6,8,9,10,12]); const n = R.int(1, d - 1); const f = randomShape(d); f.s = R.sample(d, n);
        return { t:'read', q:'What fraction of the shape is shaded?', fig:f, e:fs(n, d), sk:'meaning', hint:['Count ALL the equal parts. That is the denominator.','Count the shaded parts. That is the numerator.'] }; },
      () => { const [n, d] = R.pick([[1,2],[1,3],[2,3],[1,4],[3,4],[2,5],[3,5],[5,6]]); const k = R.pick([2,3]); const total = d * k; const f = randomShape(total);
        return { t:'shade', q:'Shade ' + tk(n, d) + ' of this shape. Careful, it has ' + total + ' parts.', fig:f, e:fs(n, d), sk:'meaning', hint:['The shape has ' + total + ' parts, not ' + d + '.','Split the ' + total + ' parts into ' + d + ' equal groups. How many parts are in one group?','One group is ' + k + ' parts. You need ' + n + ' groups.'] }; },
      () => { const c = R.pick([['hours','a day',24],['minutes','an hour',60],['months','a year',12],['days','a week',7],['paise','a rupee',100],['centimetres','a metre',100],['grams','a kilogram',1000],['seconds','a minute',60]]);
        const ks = { 24:[2,3,4,6,8,12,16,18,20], 60:[5,10,12,15,20,30,40,45,50], 12:[2,3,4,5,6,7,8,9,10], 7:[1,2,3,4,5,6], 100:[5,10,20,25,40,50,75,80], 1000:[100,125,200,250,500,750] }[c[2]];
        const k = R.pick(ks); return { t:'frac', q:'What fraction of ' + c[1] + ' is ' + k + ' ' + c[0] + '?', e:fs(k, c[2]), sk:'collection', hint:['How many ' + c[0] + ' are there in ' + c[1] + '? That is the whole.','The part is ' + k + ' out of ' + c[2] + '. Now simplify.'] }; },
      () => { const d = R.pick([3,4,5,6,8]); const n = R.int(1, d - 1); const N = d * R.int(3, 12); const who = nm(); const thing = R.pick(['stickers','marbles','pencils','chocolates','stamps','cards']);
        return { t:'num', q: who + ' has ' + N + ' ' + thing + ' and gives away ' + tk(n, d) + ' of them. How many are left?', e: N + ' - ' + fs(n, d) + ' of ' + N, unit:thing, sk:'collection', hint:['First find ' + tk(1, d) + ' of ' + N + ': split ' + N + ' into ' + d + ' equal groups.','One group is ' + N / d + '. So ' + tk(n, d) + ' is ' + n + ' groups.','Do not stop there. The question asks how many are LEFT.'] }; },
    ],
    L3: [
      () => { const eq = Math.random() < 0.4; const parts = eq ? [1,1,1] : R.pick([[2,1,1],[1,2,1],[3,1,2],[1,1,2]]); const s = R.int(0, 2);
        return { t:'yn', q:'Is the shaded part {1/3} of the whole strip?', fig:{ k:'strip', w:parts, s:[s] }, a:eq, sk:'meaning', why: eq ? 'All three parts are the same size, so one part is {1/3}.' : 'The parts are NOT equal in size. A fraction only works when the whole is cut into equal parts.', hint:['Look at the SIZE of each part, not just how many parts there are.'] }; },
      () => { const d = R.pick([3,4,5,6,8]); const n = R.int(1, d - 1); const unit = R.int(2, 9); const part = n * unit; const what = R.pick([['students','a class'],['pages','a book'],['beads','a necklace'],['kids','a bus']]);
        return { t:'num', q:tk(n, d) + ' of ' + what[1] + ' is ' + part + ' ' + what[0] + '. How many ' + what[0] + ' are in the whole of ' + what[1] + '?', e: part + ' ÷ ' + fs(n, d), unit:what[0], sk:'collection', hint:[tk(n, d) + ' means ' + n + ' equal parts out of ' + d + '.','If ' + n + ' parts make ' + part + ', one part is ' + part + ' ÷ ' + n + ' = ' + unit + '.','The whole has ' + d + ' parts.'], why: 'One part is ' + part + ' ÷ ' + n + ' = ' + unit + '. The whole is ' + d + ' parts, so ' + d + ' × ' + unit + ' = ' + d * unit + '.' }; },
      () => { const d = R.pick([4,5,6,8,9,10,12]); const n = R.int(1, d - 1); const f = randomShape(d); f.s = R.sample(d, n);
        return { t:'read', q:'What fraction of the shape is NOT shaded?', fig:f, e:fs(d - n, d), sk:'meaning', hint:['Read the question again. NOT shaded.','Shaded plus not shaded makes the whole, which is 1.'] }; },
      () => { const [n, d] = R.pick([[3,4],[1,2],[2,3],[5,6],[3,5],[1,4]]); const k = R.pick([2,3,4]); const small = d * k;
        return { t:'num', q:'How many ' + tk(1, small) + ' pieces make ' + tk(n, d) + '?', e: fs(n, d) + ' ÷ ' + fs(1, small), sk:'meaning', hint:['How many ' + tk(1, small) + ' pieces make one whole?','Each ' + tk(1, d) + ' is the same as ' + k + ' pieces of ' + tk(1, small) + '.'] }; },
      () => { const d = R.pick([3,4,5,6]); const n = R.int(1, d - 1); const per = R.int(2, 5); const shown = n * per;
        return { t:'num', q:'A chocolate bar is broken. The piece you have is ' + tk(n, d) + ' of the bar and has ' + shown + ' squares. How many squares were in the whole bar?', e: shown + ' ÷ ' + fs(n, d), unit:'squares', sk:'meaning', hint:['Your piece is ' + n + ' out of ' + d + ' equal parts.','One part has ' + shown + ' ÷ ' + n + ' squares.'] }; },
    ],
  },
  // ===================== World 2: number line =====================
  2: {
    L2: [
      () => { const d = R.int(3, 10); const n = R.int(1, d - 1); return { t:'line', q:'Mark ' + tk(n, d) + ' on the number line.', max:1, den:d, e:fs(n, d), sk:'numline', hint:['The space from 0 to 1 is cut into ' + d + ' equal jumps.','Start at 0 and make ' + n + ' jumps.'] }; },
      () => { const d = R.int(3, 10); const n = R.int(1, d - 1); return { t:'read', q:'Which fraction is marked with the dot?', fig:{ k:'nl', max:1, den:d, at:n }, e:fs(n, d), sk:'numline', hint:['Count the jumps from 0 to 1. That is the denominator.','Count the jumps from 0 to the dot.'] }; },
    ],
    L3: [
      () => { const [n, d] = R.pick([[1,2],[1,3],[2,3],[3,4],[1,4],[2,5]]); const k = R.pick([2,3]); return { t:'line', q:'Mark ' + tk(n, d) + ' on this number line. Look at how many jumps it has!', max:1, den:d * k, e:fs(n, d), sk:'numline', hint:['This line has ' + d * k + ' jumps between 0 and 1, not ' + d + '.','Change ' + tk(n, d) + ' into ' + (d * k) + 'ths: ' + tk(n, d) + ' = ' + tk(n * k, d * k) + '.'] }; },
      () => { const d = R.pick([2,3,4,5]); const max = R.pick([2,3]); const n = R.coprime(d + 1, max * d - 1, d); return { t:'read', q:'Which fraction is marked with the dot? Write it as an improper fraction or a mixed number.', fig:{ k:'nl', max, den:d, at:n }, e:fs(n, d), sk:'numline', hint:['Each whole number is split into ' + d + ' jumps.','Count every jump from 0, past 1, to the dot.'] }; },
      () => { const [n, d] = R.pick([[1,2],[1,3],[2,5],[3,4],[2,3]]); return { t:'frac', q:'Which fraction is exactly halfway between 0 and ' + tk(n, d) + '?', e: fs(n, d) + ' ÷ 2', sk:'numline', hint:['Halfway means half of the distance.','Half of ' + tk(n, d) + ' is ' + tk(n, d) + ' × {1/2}.'] }; },
      () => { const [n1, n2, d] = R.pick([[1,2,3],[1,3,4],[2,3,5],[1,2,4],[3,4,5]]); return { t:'open', q:'Write two different fractions that lie between ' + tk(n1, d) + ' and ' + tk(n2, d) + '.', v:'between', p:{ lo:fs(n1, d), hi:fs(n2, d) }, n:2, sk:'numline', hint:['There seems to be no room. Cut the pieces smaller!','Write both as equivalent fractions with a bigger denominator, like ' + tk(n1 * 10, d * 10) + ' and ' + tk(n2 * 10, d * 10) + '.'] }; },
    ],
  },
  // ===================== World 3: proper and improper =====================
  3: {
    L2: [
      () => { const kind = R.int(0, 2); const d = R.int(2, 12); const n = kind === 0 ? R.int(1, d - 1) : kind === 1 ? R.int(d + 1, d * 3) : d;
        return { t:'mcq', q:'What kind of fraction is ' + tk(n, d) + '?', opts:['Proper (less than 1)','Improper (more than 1)','Equal to 1'], a:kind, sk:'proper', hint:['Compare the top with the bottom.','Do you have fewer pieces than one whole needs, or more?'] }; },
      () => { const d = R.int(2, 15); const n = R.pick([R.int(1, d - 1), R.int(d + 1, d * 2), d]); const other = R.pick(['1', '1', '2']); return { t:'cmp', L:fs(n, d), R:other, sk:'proper', hint:['How many ' + tk(1, d) + ' pieces make 1 whole?','1 = ' + tk(d, d) + (other === '2' ? ' and 2 = ' + tk(2 * d, d) : '') + '.'] }; },
    ],
    L3: [
      () => { const n = R.int(2, 9), gap = R.int(1, 5); const d = n + gap; return { t:'frac', q:'I am a proper fraction. My numerator and denominator add up to ' + (n + d) + ', and my denominator is ' + gap + ' more than my numerator. Who am I?', e:fs(n, d), form:'exact', sk:'proper', hint:['Try pairs of numbers that add to ' + (n + d) + '.','The bottom number is ' + gap + ' bigger than the top.'] }; },
      () => { const d = R.int(3, 15); return { t:'num', q:'What is the SMALLEST whole number that can go in the box so that ☐/' + d + ' is an improper fraction?', e:String(d), sk:'proper', why:'A fraction is improper when the numerator is equal to or greater than the denominator. So ' + d + '/' + d + ' (which equals 1) is the smallest improper one.', hint:['Improper means numerator is equal to OR greater than the denominator.'] }; },
      () => { const d = R.int(4, 15); return { t:'frac', q:'I am the largest proper fraction with denominator ' + d + '. Who am I?', e:fs(d - 1, d), form:'exact', sk:'proper', hint:['Proper means the top is smaller than ' + d + '.','What is the biggest whole number smaller than ' + d + '?'] }; },
      () => { const d = R.pick([3,4,5,6]); const w = R.int(1, 3); return { t:'open', q:'Write two different improper fractions with denominator ' + d + ' that lie between ' + w + ' and ' + (w + 1) + '.', v:'between', p:{ lo:String(w), hi:String(w + 1), den:d }, n:2, sk:'proper', hint:[w + ' = ' + tk(w * d, d) + ' and ' + (w + 1) + ' = ' + tk((w + 1) * d, d) + '.','Pick numerators in between.'] }; },
    ],
  },
  // ===================== World 4: mixed fractions =====================
  4: {
    L2: [
      () => { const d = R.int(2, 12); const w = R.int(1, 9); const n = R.int(1, d - 1); return { t:'frac', q:'Convert ' + tk(w * d + n, d) + ' into a mixed fraction.', e:fs(w * d + n, d), form:'mixed', sk:'mixed', hint:['Divide ' + (w * d + n) + ' by ' + d + '.','The quotient is the whole number. The remainder goes on top.'] }; },
      () => { const d = R.int(2, 12); const w = R.int(1, 9); const n = R.coprime(1, d - 1, d); return { t:'frac', q:'Convert ' + tkm(w, n, d) + ' into an improper fraction.', e:mx(w, n, d), form:'improper', sk:'mixed', hint:['How many ' + tk(1, d) + ' pieces are in ' + w + ' wholes?',w + ' wholes = ' + w * d + ' pieces. Add the ' + n + ' extra pieces.'] }; },
      () => { const d = R.pick([2,3,4,5]); const w = R.int(1, 2); const n = R.int(1, d - 1); return { t:'line', q:'Mark ' + tkm(w, n, d) + ' on the number line.', max:w + 1, den:d, e:mx(w, n, d), sk:'numline', hint:['First find ' + w + ' on the line.','Then make ' + n + ' more small jumps.'] }; },
    ],
    L3: [
      () => { const d = R.int(3, 9); const w = R.int(2, 9); const n = R.int(1, d - 1); const opts = [[w - 1, w], [w, w + 1], [w + 1, w + 2], [n, n + 1]].filter((x, i, a) => a.findIndex(y => y[0] === x[0]) === i);
        const sh = R.shuffle(opts); return { t:'mcq', q:tk(w * d + n, d) + ' lies between which two whole numbers?', opts:sh.map(o => o[0] + ' and ' + o[1]), a:sh.findIndex(o => o[0] === w), sk:'mixed', hint:['How many whole groups of ' + d + ' fit into ' + (w * d + n) + '?'] }; },
      () => { const k = R.pick([2,3,4,5,6]); const items = R.int(k + 1, 4 * k); const thing = R.pick(['rotis','pizzas','cakes','chikki bars']); if (items % k === 0) return GEN[4].L3[1]();
        return { t:'frac', q:items + ' ' + thing + ' are shared equally among ' + k + ' children. How much does each child get?', e:fs(items, k), form:'mixed', sk:'mixed', hint:['Sharing equally means dividing: ' + items + ' ÷ ' + k + '.','Each child first gets whole ' + thing + '. Then the leftovers are cut into ' + k + ' equal parts.'] }; },
      () => { const d = R.int(3, 9); const w = R.int(2, 7); const n = R.int(1, d - 1); const imp = w * d + n; const who = nm();
        const variants = [[w, n, true], [w + 1, n, false], [w - 1, n, false], [w, n === d - 1 ? n - 1 : n + 1, false]].filter(v => v[0] >= 1 && v[1] >= 1 && v[1] < d);
        const [sw, sn, ok] = Math.random() < 0.4 ? variants[0] : R.pick(variants.slice(1));
        return { t:'yn', q: who + ' says ' + tk(imp, d) + ' = ' + tkm(sw, sn, d) + '. Is ' + who + ' right?', a: ok, sk:'mixed', why: ok ? 'Yes. ' + w + ' × ' + d + ' + ' + n + ' = ' + imp + '.' : 'No. ' + imp + ' ÷ ' + d + ' = ' + w + ' remainder ' + n + ', so it is ' + tkm(w, n, d) + '.', hint:['Check by turning ' + tkm(sw, sn, d) + ' back into an improper fraction.'] }; },
      () => { const d = R.int(3, 9); const w = R.int(2, 8); const n = R.int(1, d - 1); return { t:'num', q:'In the mixed number ' + w + ' ☐/' + d + ', the improper form has numerator ' + (w * d + n) + '. What number goes in the box?', e:String(n), sk:'mixed', hint:[w + ' wholes make ' + w * d + ' pieces of ' + tk(1, d) + '.','How many more pieces get you to ' + (w * d + n) + '?'] }; },
      () => { const d = R.int(3, 9); const w = R.int(1, 5); const n = R.int(1, d - 1); const imp = w * d + n + R.pick([-1, 0, 1]); return { t:'cmp', L:mx(w, n, d), R:fs(imp, d), sk:'mixed', hint:['Change the mixed number into an improper fraction first.'] }; },
    ],
  },
  // ===================== World 5: equivalent fractions =====================
  5: {
    L2: [
      () => { const [n, d] = properFrac(2, 9); const k = R.int(2, 9); const hideTop = Math.random() < 0.5;
        return { t:'num', q:'Fill the box: ' + tk(n, d) + ' = ' + (hideTop ? '☐/' + d * k : n * k + '/☐'), e:String(hideTop ? n * k : d * k), sk:'equiv', hint:['What did ' + (hideTop ? d : n) + ' get multiplied by to become ' + (hideTop ? d * k : n * k) + '?','Do the SAME to the other number.'] }; },
      () => { const [n, d] = properFrac(2, 9); const k = R.int(2, 8); const byDen = Math.random() < 0.5;
        return { t:'frac', q:'Find the fraction equal to ' + tk(n, d) + ' with ' + (byDen ? 'denominator ' + d * k : 'numerator ' + n * k) + '.', e:fs(n * k, d * k), form:'exact', sk:'equiv', hint:['Multiply the top and the bottom by the same number.'] }; },
      () => { const [n, d] = properFrac(2, 9); const k = R.int(2, 6); const same = Math.random() < 0.5; const n2 = same ? n * k : n * k + R.pick([-1, 1]); const d2 = d * k;
        return { t:'yn', q:'Are ' + tk(n, d) + ' and ' + tk(n2, d2) + ' equivalent?', L:fs(n, d), R:fs(n2, d2), sk:'equiv', hint:['Cross multiply: ' + n + ' × ' + d2 + ' and ' + n2 + ' × ' + d + '.','If the two products are equal, the fractions are equal.'] }; },
    ],
    L3: [
      () => { const [n, d] = properFrac(2, 7); const good = [2,3,4].map(k => [n * k, d * k]); const bad = [n + 2, d + 2]; const opts = R.shuffle([...good.slice(0, 3), bad]);
        return { t:'mcq', q:'Which one is NOT equal to ' + tk(n, d) + '?', opts:opts.map(o => tk(o[0], o[1])), a:opts.indexOf(bad), sk:'equiv', why:'Adding the same number to top and bottom changes the value. Only multiplying or dividing both by the same number keeps it equal.', hint:['Check each one: was it made by MULTIPLYING top and bottom by the same number?'] }; },
      () => { const [n, d] = R.pick([[1,3],[1,4],[2,5],[1,2],[3,4]]); const a = R.int(1, 3); const who = nm();
        return { t:'yn', q: who + ' added ' + a + ' to the top and bottom of ' + tk(n, d) + ' and got ' + tk(n + a, d + a) + '. ' + who + ' says they are equivalent. Right?', a:false, sk:'equiv', why:tk(n, d) + ' and ' + tk(n + a, d + a) + ' are not equal. Picture it: adding the same number of pieces to the top and bottom changes the size of the share.', hint:['Cross multiply to check.','Or draw both. Do they cover the same amount?'] }; },
      () => { const [n, d] = properFrac(2, 6); const lo = R.int(15, 30); const hi = lo + R.int(8, 14); let ok = false; for (let x = lo; x <= hi; x++) if (x % d === 0) ok = true; if (!ok) return GEN[5].L3[2]();
        return { t:'open', q:'Write a fraction equal to ' + tk(n, d) + ' whose denominator is between ' + lo + ' and ' + hi + '.', v:'equivWithDen', p:{ f:fs(n, d), lo, hi }, n:1, sk:'equiv', hint:['Which multiples of ' + d + ' are between ' + lo + ' and ' + hi + '?'] }; },
      () => { const [n, d] = properFrac(2, 6); const k1 = R.int(2, 4), k2 = R.int(5, 9); return { t:'num', q:'Fill the box: ' + tk(n, d) + ' = ' + tk(n * k1, d * k1) + ' = ' + n * k2 + '/☐', e:String(d * k2), sk:'equiv', hint:['Use the first fraction, it is easiest.','' + n + ' was multiplied by ' + k2 + ' to get ' + n * k2 + '.'] }; },
    ],
  },
  // ===================== World 6: simplest form =====================
  6: {
    L2: [
      () => { const [n, d] = properFrac(2, 13); const k = R.pick([2,3,4,5,6,7,8,9,10,12]); return { t:'frac', q:'Reduce ' + tk(n * k, d * k) + ' to its lowest form.', e:fs(n * k, d * k), form:'lowest', sk:'simplest', hint:['Find a number that divides BOTH ' + n * k + ' and ' + d * k + '.','The biggest such number (the HCF) is ' + k + '.'] }; },
      () => { const simple = Math.random() < 0.5; const [n, d] = properFrac(3, 15); const k = simple ? 1 : R.pick([2,3,5]); return { t:'yn', q:'Is ' + tk(n * k, d * k) + ' in its simplest form?', a:simple, sk:'simplest', why: simple ? n + ' and ' + d + ' have no common factor except 1.' : 'Both can be divided by ' + k + '. It simplifies to ' + tk(n, d) + '.', hint:['Is there any number other than 1 that divides both?'] }; },
    ],
    L3: [
      () => { const [n, d] = properFrac(2, 9); const k = R.pick([6,8,9,12,14,15,18]); return { t:'num', q:'To simplify ' + tk(n * k, d * k) + ' in ONE step, what number should you divide the top and bottom by?', e:String(k), sk:'simplest', why:'The HCF of ' + n * k + ' and ' + d * k + ' is ' + k + '. Dividing by the HCF gives the simplest form in one step.', hint:['You need the HIGHEST common factor, not just any common factor.'] }; },
      () => { const [n, d] = properFrac(2, 7); const k = R.pick([4,6,8,9]); const p = R.pick([2,3].filter(x => k % x === 0)); const who = nm();
        return { t:'yn', q: who + ' says the simplest form of ' + tk(n * k, d * k) + ' is ' + tk(n * k / p, d * k / p) + '. Right?', a:false, sk:'simplest', why:tk(n * k / p, d * k / p) + ' can still be divided by ' + (k / p) + '. The simplest form is ' + tk(n, d) + '.', hint:['Can the new fraction be divided again?'] }; },
      () => { const [n, d] = properFrac(2, 7); const a = R.int(2, 5), b = R.int(6, 9); const c = R.int(2, 9), e = R.int(2, 9);
        const opts = R.shuffle([[n * b, d * b, 1], [n * c + 1, d * c, 0], [n * e, d * e + 1, 0]]);
        if (opts.some(o => !o[2] && F(fs(o[0], o[1])).eq(F(fs(n, d))))) return GEN[6].L3[2]();
        return { t:'mcq', q:'Which of these is equal to ' + tk(n * a, d * a) + '?', opts:opts.map(o => tk(o[0], o[1])), a:opts.findIndex(o => o[2] === 1), sk:'simplest', why:'Both simplify to ' + tk(n, d) + '.', hint:['Simplify ' + tk(n * a, d * a) + ' first.','Then simplify each option and compare.'] }; },
      () => { const [n, d] = properFrac(2, 6); const A = d * R.int(3, 6), B = d * R.int(7, 10); const same = Math.random() < 0.5; const bA = n * (A / d), bB = same ? n * (B / d) : n * (B / d) + 1; const who1 = R.pick(NAMES), who2 = R.pick(NAMES.filter(x => x !== who1));
        return { t:'yn', q: who1 + ' read ' + bA + ' pages of a ' + A + ' page book. ' + who2 + ' read ' + bB + ' pages of a ' + B + ' page book. Did they read the same fraction of their books?', a:same, sk:'simplest', why:tk(bA, A) + ' = ' + F(fs(bA, A)).tok() + ' and ' + tk(bB, B) + ' = ' + F(fs(bB, B)).tok() + '.', hint:['Write each as a fraction and simplify.'] }; },
    ],
  },
  // ===================== World 7: comparing and ordering =====================
  7: {
    L2: [
      () => { let a, b; do { a = properFrac(2, 12); b = properFrac(2, 12); } while (a[1] === b[1]); return { t:'cmp', L:fs(a[0], a[1]), R:fs(b[0], b[1]), sk:'compare', hint:['Different denominators. Make them the same, or cross multiply.','Cross multiply: ' + a[0] + ' × ' + b[1] + ' and ' + b[0] + ' × ' + a[1] + '.'] }; },
      () => { const set = new Map(); while (set.size < 4) { const [n, d] = properFrac(2, 10); set.set(F(fs(n, d)).key(), fs(n, d)); } return { t:'order', items:[...set.values()], dir:R.pick(['asc','desc']), sk:'order', hint:['Find the LCM of all the denominators and rewrite each fraction with it.','Then just compare the numerators.'] }; },
    ],
    L3: [
      () => { const n = R.int(2, 7); let d1 = R.int(n + 1, n + 9), d2; do { d2 = R.int(n + 1, n + 9); } while (d2 === d1); return { t:'cmp', L:fs(n, d1), R:fs(n, d2), sk:'compare', hint:['Same numerator! Which pieces are bigger: ' + d1 + 'ths or ' + d2 + 'ths?','Cutting a cake into MORE pieces makes each piece SMALLER.'] }; },
      () => { const d = R.pick([5,7,9,11,13,15]); const n = R.int(1, d - 1); return { t:'cmp', L:fs(n, d), R:'1/2', sk:'compare', hint:['Half of ' + d + ' is ' + d / 2 + '.','Is ' + n + ' more or less than half of ' + d + '?'] }; },
      () => { const d = R.int(5, 12); const pair = [[d - 1, d], [d, d + 1]]; return { t:'mcq', q:'Which is closer to 1: ' + tk(d - 1, d) + ' or ' + tk(d, d + 1) + '?', opts:[tk(d - 1, d), tk(d, d + 1), 'They are equally close'], a:1, sk:'compare', why:tk(d - 1, d) + ' is ' + tk(1, d) + ' away from 1. ' + tk(d, d + 1) + ' is ' + tk(1, d + 1) + ' away. ' + tk(1, d + 1) + ' is the smaller gap.', hint:['How far is each one from 1?','Compare the gaps: ' + tk(1, d) + ' and ' + tk(1, d + 1) + '.'] }; },
      () => { let a, b; do { a = properFrac(3, 9); b = properFrac(3, 9); } while (F(fs(a[0], a[1])).eq(F(fs(b[0], b[1])))); const n1 = nm(), n2 = R.pick(NAMES.filter(x => x !== n1)); const big = F(fs(a[0], a[1])).cmp(F(fs(b[0], b[1]))) > 0;
        return { t:'mcq', q: n1 + ' practised piano for ' + tk(a[0], a[1]) + ' of an hour and ' + n2 + ' for ' + tk(b[0], b[1]) + ' of an hour. Who practised longer?', opts:[n1, n2], a: big ? 0 : 1, sk:'compare', hint:['Compare ' + tk(a[0], a[1]) + ' and ' + tk(b[0], b[1]) + '.','Or turn both into minutes: ' + tk(1, a[1]) + ' hour is ' + (60 / a[1]) + ' minutes.'] }; },
      () => { const [n1, n2, d] = R.pick([[1,2,3],[2,3,4],[3,4,5],[1,2,5],[4,5,7]]); return { t:'open', q:'Write a fraction that lies between ' + tk(n1, d) + ' and ' + tk(n2, d) + '.', v:'between', p:{ lo:fs(n1, d), hi:fs(n2, d) }, n:1, sk:'compare', hint:['Make the pieces smaller: multiply top and bottom of both by 2 or 10.'] }; },
    ],
  },
  // ===================== World 8: addition and subtraction =====================
  8: {
    L2: [
      () => { const d = R.int(3, 15); const a = R.int(1, d - 1), b = R.int(1, d - 1); const op = R.pick(['+', '-']); const [x, y] = op === '-' && a < b ? [b, a] : [a, b]; if (op === '-' && x === y) return GEN[8].L2[0]();
        return { t:'frac', e: fs(x, d) + ' ' + op + ' ' + fs(y, d), sk:'addlike' }; },
      () => { const pairs = [[2,3],[3,4],[2,5],[4,6],[3,5],[6,8],[4,10],[5,6],[3,8],[6,9],[4,12],[5,15],[8,12]]; const [d1, d2] = R.pick(pairs); const a = R.coprime(1, d1 - 1, d1), b = R.coprime(1, d2 - 1, d2); const op = R.pick(['+', '+', '-']);
        let L = fs(a, d1), Rr = fs(b, d2); if (op === '-' && F(L).cmp(F(Rr)) < 0) [L, Rr] = [Rr, L]; if (op === '-' && F(L).eq(F(Rr))) return GEN[8].L2[1]();
        return { t:'frac', e: L + ' ' + op + ' ' + Rr, sk: op === '+' ? 'addunlike' : 'sub' }; },
      () => { const d1 = R.pick([2,3,4,5,6]), d2 = R.pick([2,3,4,6,8]); const w1 = R.int(2, 8), w2 = R.int(1, w1 - 1); const a = R.int(1, d1 - 1), b = R.int(1, d2 - 1); const op = R.pick(['+', '-']);
        return { t:'frac', e: mx(w1, a, d1) + ' ' + op + ' ' + mx(w2, b, d2), sk: op === '+' ? 'addunlike' : 'sub' }; },
    ],
    L3: [
      () => { const [a, d1] = properFrac(2, 8); const [b, d2] = properFrac(2, 8); const target = F(fs(a, d1)).add(F(fs(b, d2)));
        return { t:'frac', q:'What must be added to ' + tk(a, d1) + ' to get ' + target.tok() + '?', e: target.tokImp().replace(/[{}]/g, '') + ' - ' + fs(a, d1), sk:'sub', hint:['If ' + tk(a, d1) + ' + ☐ = ' + target.tok() + ', then ☐ = ' + target.tok() + ' − ' + tk(a, d1) + '.'] }; },
      () => { let [a, d1] = properFrac(2, 9), [b, d2] = properFrac(2, 9); if (F(fs(a, d1)).cmp(F(fs(b, d2))) > 0) [a, d1, b, d2] = [b, d2, a, d1]; if (F(fs(a, d1)).eq(F(fs(b, d2)))) return GEN[8].L3[1]();
        return { t:'frac', q:'Subtract ' + tk(a, d1) + ' from ' + tk(b, d2) + '.', e: fs(b, d2) + ' - ' + fs(a, d1), sk:'sub', traps:[{ v: F(fs(a, d1)).sub(F(fs(b, d2))).tokImp().replace(/[{}]/g, ''), msg:'"Subtract A from B" means B − A. You did it the other way round.' }], hint:['"Subtract 2 from 5" means 5 − 2. Which number comes first here?'] }; },
      () => { const [d1, d2] = R.pick([[3,4],[2,5],[3,5],[4,5],[2,3]]); const a = 1, b = 1; const who = nm();
        return { t:'yn', q: who + ' says ' + tk(a, d1) + ' + ' + tk(b, d2) + ' = ' + tk(a + b, d1 + d2) + '. Right?', a:false, sk:'addunlike', why:'No. ' + tk(a + b, d1 + d2) + ' is even smaller than ' + tk(a, d1) + ' alone, which cannot happen when you add. The right answer is ' + F(fs(a, d1)).add(F(fs(b, d2))).tok() + '.', hint:['Adding should make the answer BIGGER. Is ' + tk(a + b, d1 + d2) + ' bigger than ' + tk(a, d1) + '?'] }; },
      () => { const [a, d1] = properFrac(2, 9), [b, d2] = properFrac(2, 9); const s = F(fs(a, d1)).add(F(fs(b, d2))); const c = s.cmp(1);
        return { t:'mcq', q:'WITHOUT working it out fully: is ' + tk(a, d1) + ' + ' + tk(b, d2) + ' more than 1, less than 1 or exactly 1?', opts:['Less than 1','Exactly 1','More than 1'], a:c + 1, sk:'addunlike', why:'The sum is ' + s.tok() + '.', hint:['Is each fraction more or less than {1/2}?','Two numbers both above {1/2} add to more than 1.'] }; },
      () => { const d = R.pick([6,8,10,12]); const parts = R.sample(d - 1, 3).map(x => x + 1); const tot = parts.reduce((a, b) => a + b, 0); if (tot >= d) return GEN[8].L3[4](); const names = R.shuffle(NAMES).slice(0, 3);
        return { t:'frac', q:'A pizza is shared. ' + names[0] + ' eats ' + tk(parts[0], d) + ', ' + names[1] + ' eats ' + tk(parts[1], d) + ' and ' + names[2] + ' eats ' + tk(parts[2], d) + '. What fraction of the pizza is left?', e:'1 - (' + parts.map(p => fs(p, d)).join(' + ') + ')', sk:'word', hint:['The whole pizza is 1 = ' + tk(d, d) + '.','Add up what was eaten, then take it away from the whole.'] }; },
      () => { const T = R.pick(['1', '1', '2', '1_1/2']); return { t:'open', q:'Write two pairs of fractions with DIFFERENT denominators that add up to ' + F(T).tok() + '.', v:'pairsum', p:{ s:T, diffDen:true }, n:2, sk:'addunlike', hint:['Start with an easy one, like {1/2} + ... ','Pick one fraction, then work out what is missing.'] }; },
    ],
  },
  // ===================== World 9: multiplication =====================
  9: {
    L2: [
      () => { const [n, d] = properFrac(2, 9); const k = d * R.int(2, 9); return { t:'frac', e: Math.random() < 0.5 ? fs(n, d) + ' x ' + k : k + ' x ' + fs(n, d), sk:'mulwhole', hint:['Multiply the whole number by the numerator. The denominator stays.','Cancel common factors first to keep numbers small.'] }; },
      () => { const [a, b] = properFrac(2, 10), [c, d] = properFrac(2, 10); return { t:'frac', e: fs(a, b) + ' x ' + fs(c, d), sk:'mulfrac', hint:['Multiply top × top and bottom × bottom.','Cancel common factors across the fractions first.'] }; },
      () => { const w1 = R.int(1, 4), w2 = R.int(1, 3); const [a, b] = properFrac(2, 6), [c, d] = properFrac(2, 6); return { t:'frac', e: mx(w1, a, b) + ' x ' + mx(w2, c, d), sk:'mulfrac' }; },
      () => { const c = R.pick([['an hour','minutes',60],['a day','hours',24],['a year','months',12],['a kilogram','grams',1000],['a metre','centimetres',100],['a rupee','paise',100],['a minute','seconds',60]]); const ds = [2,3,4,5,6,8,10,12].filter(x => c[2] % x === 0); const d = R.pick(ds); const n = R.coprime(1, d - 1, d);
        return { t:'num', q:'How many ' + c[1] + ' is ' + tk(n, d) + ' of ' + c[0] + '?', e: fs(n, d) + ' of ' + c[2], unit:c[1], sk:'mulwhole', hint:[c[0].replace(/^an? /, 'One ') + ' has ' + c[2] + ' ' + c[1] + '.','Find ' + tk(1, d) + ' of ' + c[2] + ' first.'] }; },
    ],
    L3: [
      () => { const N = R.int(6, 40); const kind = R.int(0, 2); const f = kind === 0 ? fs(...properFrac(2, 9)) : kind === 1 ? fs(R.int(5, 15), R.int(2, 4)) : '1'; const v = F(f); const c = v.cmp(1);
        return { t:'mcq', q:'Without calculating: is ' + N + ' × ' + v.tokImp() + ' more than ' + N + ', less than ' + N + ' or equal to ' + N + '?', opts:['Less than ' + N, 'Equal to ' + N, 'More than ' + N], a:c + 1, sk:'mulfrac', why:'Multiplying by a number less than 1 takes only PART of ' + N + ', so it gets smaller. Multiplying by more than 1 makes it bigger.', hint:['Is ' + v.tokImp() + ' less than 1 or more than 1?','Taking ' + tk(1, 2) + ' of something gives LESS.'] }; },
      () => { const [n, d] = properFrac(2, 8); const unit = R.int(2, 12); return { t:'num', q:tk(n, d) + ' of a number is ' + n * unit + '. What is the number?', e: n * unit + ' ÷ ' + fs(n, d), sk:'mulfrac', hint:[tk(n, d) + ' means ' + n + ' parts out of ' + d + '. If ' + n + ' parts are ' + n * unit + ', what is 1 part?','The whole number is ' + d + ' parts.'] }; },
      () => { const a = R.pick([2,3,4]), b = R.pick([2,3,5]); const N = a * b * R.int(2, 6); return { t:'num', q:'What is ' + tk(1, a) + ' of ' + tk(1, b) + ' of ' + N + '?', e: fs(1, a) + ' of ' + fs(1, b) + ' of ' + N, sk:'mulfrac', hint:['Work from the right. First find ' + tk(1, b) + ' of ' + N + '.'] }; },
      () => { const w = R.int(2, 4); const [n, d] = [1, 2]; const who = nm(); const wrong = w * w + '_' + n * n + '/' + d * d; const right = F(mx(w, n, d)).mul(F(mx(w, n, d)));
        return { t:'yn', q: who + ' says ' + tkm(w, n, d) + ' × ' + tkm(w, n, d) + ' = ' + tkm(w * w, 1, 4) + ' because ' + w + ' × ' + w + ' = ' + w * w + ' and ' + tk(1, 2) + ' × ' + tk(1, 2) + ' = ' + tk(1, 4) + '. Right?', a:false, sk:'mulfrac', why:'No. Multiplying the parts separately misses the cross parts. Change to improper fractions: ' + tk(2 * w + 1, 2) + ' × ' + tk(2 * w + 1, 2) + ' = ' + right.tok() + '.', hint:['Try it with a picture: a square ' + tkm(w, 1, 2) + ' on each side. Is its area only ' + w * w + ' and a quarter?'] }; },
      () => { const L = R.int(2, 9), W = R.int(1, 6); const a = R.pick([1, 2]), b = R.pick([1, 3]); const da = 2, db = R.pick([3, 4]); return { t:'frac', q:'A garden bed is ' + tkm(L, a, da) + ' m long and ' + tkm(W, b % db || 1, db) + ' m wide. Find its area.', e: mx(L, a, da) + ' x ' + mx(W, b % db || 1, db), unit:'m²', sk:'word', hint:['Area of a rectangle = length × breadth.','Change both mixed numbers into improper fractions first.'] }; },
    ],
  },
  // ===================== World 10: division =====================
  10: {
    L2: [
      () => { const [n, d] = properFrac(2, 9); const k = n * R.int(2, 9); return { t:'frac', e: k + ' ÷ ' + fs(n, d), sk:'div', hint:['Dividing by ' + tk(n, d) + ' is the same as multiplying by ' + tk(d, n) + '.'] }; },
      () => { const [n, d] = properFrac(2, 9); const k = R.int(2, 9); return { t:'frac', e: fs(n, d) + ' ÷ ' + k, sk:'div', hint:[k + ' is the same as ' + tk(k, 1) + '. Its reciprocal is ' + tk(1, k) + '.'] }; },
      () => { const [a, b] = properFrac(2, 9), [c, d] = properFrac(2, 9); return { t:'frac', e: fs(a, b) + ' ÷ ' + fs(c, d), sk:'div', hint:['Keep the first fraction. Flip the second. Multiply.'] }; },
      () => { const w = R.int(1, 5); const [n, d] = properFrac(2, 7); return { t:'frac', q:'What is the reciprocal of ' + tkm(w, n, d) + '?', e: fs(1, 1) + ' ÷ ' + mx(w, n, d), sk:'div', hint:['Change it to an improper fraction first.','Then flip it upside down.'] }; },
    ],
    L3: [
      () => { const [n, d] = R.pick([[3,4],[1,2],[2,3],[1,4],[3,5],[5,6]]); const L = n * R.int(2, 8); return { t:'num', q:'A ' + L + ' m rope is cut into pieces ' + tk(n, d) + ' m long. How many pieces?', e: L + ' ÷ ' + fs(n, d), unit:'pieces', sk:'div', hint:['How many ' + tk(n, d) + ' m pieces fit into 1 m?','Then how many fit into ' + L + ' m?'] }; },
      () => { const N = R.int(4, 20); const kind = R.int(0, 1); const [n, d] = properFrac(2, 6); const f = kind === 0 ? fs(n, d) : fs(d + n, d);
        const c = F(f).cmp(1); return { t:'mcq', q:'Without calculating: is ' + N + ' ÷ ' + F(f).tokImp() + ' more than ' + N + ' or less than ' + N + '?', opts:['Less than ' + N, 'More than ' + N], a: c < 0 ? 1 : 0, sk:'div', why: c < 0 ? 'Dividing by a number less than 1 asks how many small pieces fit, so you get MORE pieces than ' + N + '.' : 'Dividing by a number more than 1 gives fewer than ' + N + ' groups.', hint:['How many halves are there in 1? More than 1 or less?'] }; },
      () => { const [a, b] = properFrac(2, 7), [c, d] = properFrac(2, 7); const who = nm(); const wrong = F(fs(b, a)).mul(F(fs(c, d)));
        return { t:'yn', q: who + ' worked out ' + tk(a, b) + ' ÷ ' + tk(c, d) + ' as ' + tk(b, a) + ' × ' + tk(c, d) + '. Right?', a:false, sk:'div', why:'No. Keep the FIRST fraction and flip the one you divide BY: ' + tk(a, b) + ' × ' + tk(d, c) + ' = ' + F(fs(a, b)).div(F(fs(c, d))).tok() + '.', hint:['Which fraction should be flipped: the one being divided, or the one you divide by?'] }; },
      () => { const [a, b] = properFrac(2, 8); const P = F(fs(a, b)).mul(F(fs(R.int(2, 9), R.pick([1, 2, 3])))); return { t:'frac', q:'The product of two numbers is ' + P.tok() + '. One of them is ' + tk(a, b) + '. Find the other.', e: P.tokImp().replace(/[{}]/g, '') + ' ÷ ' + fs(a, b), sk:'div', hint:['If A × B = P, then B = P ÷ A.'] }; },
      () => { const [a, b] = properFrac(2, 8), [c, d] = properFrac(2, 8); return { t:'frac', q:'By what number should ' + tk(a, b) + ' be multiplied to get ' + tk(c, d) + '?', e: fs(c, d) + ' ÷ ' + fs(a, b), sk:'div', hint:[tk(a, b) + ' × ☐ = ' + tk(c, d) + ', so ☐ = ' + tk(c, d) + ' ÷ ' + tk(a, b) + '.'] }; },
    ],
  },
  // ===================== World 11: BODMAS =====================
  11: {
    L2: [
      () => { const [a, b] = properFrac(2, 6), [c, d] = properFrac(2, 6), [e, f] = properFrac(2, 6); const forms = [
          fs(a, b) + ' of ' + fs(c, d) + ' + ' + fs(e, f),
          '(' + fs(a, b) + ' + ' + fs(c, d) + ') x ' + fs(e, f),
          fs(a, b) + ' + ' + fs(c, d) + ' ÷ ' + fs(e, f),
          R.int(2, 4) + ' - ' + fs(c, d) + ' x ' + fs(e, f),
          fs(a, b) + ' ÷ ' + fs(c, d) + ' of ' + fs(e, f) ];
        return { t:'frac', q:'Simplify:', e: R.pick(forms), sk:'bodmas', hint:['BODMAS: Brackets, then Of, then Division and Multiplication, then Addition and Subtraction.'] }; },
    ],
    L3: [
      () => { const opts = [['{1/2} + {1/3} × {3/4}','×'],['({1/2} + {1/3}) × {3/4}','+'],['{2/3} ÷ {1/2} of {4/5}','of'],['{3/4} − {1/4} ÷ {1/2}','÷']]; const [ex, ans] = R.pick(opts); const choices = ['+','−','×','÷','of'];
        return { t:'mcq', q:'In ' + ex + ', which operation do you do FIRST?', opts:choices, a:choices.indexOf(ans), sk:'bodmas', hint:['B, O, D/M, A/S. Look for brackets first, then "of".'] }; },
      () => { const [a, b] = R.pick([[1,3],[1,4],[2,5],[1,2]]); const [c, d] = R.pick([[1,4],[1,3],[1,2],[2,3]]); const M = b * d * R.int(2, 12) * 10; const who = nm();
        return { t:'num', q: who + ' had ₹' + M + '. ' + who + ' spent ' + tk(a, b) + ' of it on books, and then ' + tk(c, d) + ' of the REMAINING money on snacks. How much money is left?', e: '(' + M + ' - ' + fs(a, b) + ' of ' + M + ') - ' + fs(c, d) + ' of (' + M + ' - ' + fs(a, b) + ' of ' + M + ')', unit:'₹', sk:'word', hint:['Step 1: how much is left after books?','Step 2: the snacks fraction is of THAT remaining amount, not of ₹' + M + '.'] }; },
      () => { const who = nm(); const k = R.pick([2,4,6]); return { t:'yn', q: who + ' says {1/2} + {1/2} × ' + k + ' = ' + k + ', because {1/2} + {1/2} = 1 and 1 × ' + k + ' = ' + k + '. Right?', a:false, sk:'bodmas', why:'Multiplication comes before addition. {1/2} × ' + k + ' = ' + k / 2 + ', then {1/2} + ' + k / 2 + ' = ' + F('1/2').add(k / 2).tok() + '.', hint:['Which comes first in BODMAS: addition or multiplication?'] }; },
      () => { const [a, b] = properFrac(2, 5), [c, d] = properFrac(2, 5); const w = R.int(2, 4); return { t:'frac', q:'Simplify:', e: w + ' - {' + fs(a, b) + ' + (' + fs(c, d) + ' x ' + fs(1, 2) + ')}', sk:'bodmas', hint:['Start with the innermost bracket ( ).','Then the { } bracket. Then the subtraction.'] }; },
    ],
  },
};
// Boss island draws twists from every world
GEN[12] = { L2: [], L3: [] };
for (let w = 1; w <= 11; w++) { GEN[12].L2.push(...GEN[w].L2); GEN[12].L3.push(...GEN[w].L3); }

// open validator extension: 'between' with fixed denominator, 'pairsum' with different denominators
const _between = VALIDATORS.between;
VALIDATORS.between = (p, list) => { const m = _between(p, list); if (m) return m; if (p.den) for (const f of list) if (f.rd !== p.den) return 'Use denominator ' + p.den + '.'; return null; };
const _pairsum = VALIDATORS.pairsum;
VALIDATORS.pairsum = (p, pairs) => { const m = _pairsum(p, pairs); if (m) return m; if (p.diffDen) for (const [a, b] of pairs) if (a.rd === b.rd) return 'Each pair needs two DIFFERENT denominators. That is the challenge!'; return null; };

function makeQuestion(world, level, index){
  const pool = GEN[world]['L' + level];
  for (let tries = 0; tries < 20; tries++) {
    try {
      const i = index != null && pool[index] ? index : Math.floor(Math.random() * pool.length);
      const q = pool[i](); q.id = 'g' + world + '-' + level + '-' + Math.random().toString(36).slice(2, 8); q.gen = true; q.gk = { w:world, L:level, i };
      prepare(q); if (!q._broken) return q;
    } catch (e) { /* retry */ }
  }
  throw new Error('generator failed for world ' + world);
}
// A fresh question of the same kind (same generator), with different numbers from the one she missed.
function questionSignature(q){ return String(q.q || '') + ' = ' + (q._ans && q._ans.tok ? q._ans.tok() : JSON.stringify(q._ans !== undefined ? q._ans : q.a)); }
function makeSimilar(gk, avoidSig, sk){
  let fallback = null;
  for (let t = 0; t < 30; t++) {
    const q = makeQuestion(gk.w, gk.L, gk.i); const fresh = questionSignature(q) !== avoidSig;
    if (fresh && (!sk || q.sk === sk)) return q;
    if (fresh && !fallback) fallback = q; else if (!fallback && t === 29) fallback = q;
  }
  return fallback;
}
if (typeof module !== 'undefined') module.exports = { GEN, makeQuestion, makeSimilar, questionSignature };
