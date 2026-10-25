// ====================== Fraction Quest app ======================
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const FR_RE = /\{(-?\d+) (\d+)\/(\d+)\}|\{(-?\d+)\/(\d+)\}/g;
function rich(s){
  return String(s == null ? '' : s).replace(FR_RE, (m, w, n, d, n2, d2) => {
    if (w !== undefined) return '<span class="mx">' + w + '<span class="fr"><span class="num">' + n + '</span><span class="den">' + d + '</span></span></span>';
    return '<span class="fr"><span class="num">' + n2 + '</span><span class="den">' + d2 + '</span></span>';
  });
}
const plain = s => String(s || '').replace(FR_RE, (m, w, n, d, n2, d2) => w !== undefined ? w + ' ' + n + '/' + d : n2 + '/' + d2).replace(/<br>/g, ' ').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
const untok = s => String(s).replace(/[{}]/g, '');
const srcTok = s => s.includes('_') ? '{' + s.replace('_', ' ') + '}' : s.includes('/') ? '{' + s + '}' : s;
const pad = n => String(n).padStart(2, '0');
const dayKey = (t = Date.now()) => { const d = new Date(t); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const fmtTime = t => { const d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const mins = ms => Math.round(ms / 60000);

// ---------------- State ----------------
// Where the game runs: 'file' (opened locally), 'artifact' (inside Claude), 'web' (family server on Vercel), 'demo' (web, browser only)
const MODE = { kind:'file', health:null };
const lsGet = k => { try { return localStorage.getItem(k); } catch (_) { return null; } };
const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (_) {} };
const ssGet = k => { try { return sessionStorage.getItem(k); } catch (_) { return null; } };
const ssSet = (k, v) => { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch (_) {} };
let LS_KEY = 'fractionQuest.v1';
async function detectMode(){
  if (window.claude && window.claude.use) { MODE.kind = 'artifact'; return; }
  if (!/^https?:$/.test(location.protocol)) return;
  try { const r = await fetch('/api/health', { cache:'no-store' }); if (r.ok) { const j = await r.json(); if (j && j.ok) { MODE.health = j; MODE.kind = 'web'; } } } catch (_) {}
  if (MODE.kind === 'web' && (ssGet('fq.demo') === '1' || location.hash === '#demo')) MODE.kind = 'demo';
  if (MODE.kind === 'demo') LS_KEY = 'fractionQuest.demo';
}
const familyCode = () => lsGet('fq.familyCode') || '';
function remoteDb(){
  const call = async (method, url, body, keepalive) => {
    const opts = { method, headers:{ 'Content-Type':'application/json', 'X-Family-Code':familyCode() }, cache:'no-store' };
    if (body !== undefined) { opts.body = JSON.stringify(body); if (keepalive && opts.body.length < 60000) opts.keepalive = true; }
    const r = await fetch(url, opts);
    if (r.status === 401) throw { code:'unauthorized', message:'Wrong family code' };
    if (r.status === 429) throw { code:'resource_exhausted', message:'Too many wrong codes' };
    if (!r.ok) throw { code:'unavailable', message:'Server ' + r.status };
    return r.json();
  };
  const doc = path => ({
    get: async () => { const j = await call('GET', '/api/doc?path=' + encodeURIComponent(path)); return { exists:!!j.exists, data:() => j.data }; },
    set: async data => { await call('PUT', '/api/doc?path=' + encodeURIComponent(path), data, document.visibilityState === 'hidden'); },
  });
  const collection = () => { let lim = 30; const q = { orderBy(){ return q; }, limit(n){ lim = n; return q; }, get: async () => { const j = await call('GET', '/api/logs?limit=' + lim); return { docs:j.logs.map(d => ({ data:() => d })) }; } }; return q; };
  return { doc, collection, call };
}
const DEFAULT_STATE = () => ({ v:1, updatedAt:0, player:{ name:'', color:'coral' }, xp:0, badges:{}, worlds:{}, skills:{}, streakBest:0,
  settings:{ pin:'', goalMin:45, unlockAll:false, sound:true, tgToken:'', tgChat:'', tgLastDaily:'' }, days:{}, simpl:0 });
let S = DEFAULT_STATE();
let PLAYER = S.player;
function loadLocal(){ try { const raw = localStorage.getItem(LS_KEY); if (raw) S = Object.assign(DEFAULT_STATE(), JSON.parse(raw)); } catch (_) {} S.settings = Object.assign(DEFAULT_STATE().settings, S.settings); PLAYER = S.player; }
let DIRTY = false, LOG_DIRTY = false;
function saveLocal(push){ if (push) { DIRTY = true; S.updatedAt = Date.now(); } try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (_) {} if (DIRTY) scheduleProgressSync(); }
function W(w){ return S.worlds[w] = S.worlds[w] || { L1:{ best:0, rounds:0, seen:{} }, L2:{ best:0, rounds:0 }, L3:{ best:0, rounds:0 } }; }
function today(){ const k = dayKey(); return S.days[k] = S.days[k] || { date:k, ms:0, att:0, cor:0, first:0, hints:0, xp:0, rounds:0, worlds:{}, skills:{}, sessions:[], attempts:[] }; }

// ---------------- Cloud sync (artifact db) ----------------
let DB = null, dbWriting = Promise.resolve(), progressTimer = null, logTimer = null;
const SYNC = { mode:'local', last:0, err:'' };
async function initDb(){
  try {
    if (MODE.kind === 'web') DB = remoteDb();
    else if (MODE.kind === 'artifact') DB = await window.claude.use('db');
    if (!DB) return;
    SYNC.mode = 'cloud';
    const snap = await DB.doc('progress/main').get();
    if (snap.exists) {
      const remote = snap.data();
      if ((remote.updatedAt || 0) > (S.updatedAt || 0)) {
        const keepDays = S.days; S = Object.assign(DEFAULT_STATE(), JSON.parse(JSON.stringify(remote)));
        S.settings = Object.assign(DEFAULT_STATE().settings, remote.settings || {}, { tgToken: (JSON.parse(localStorage.getItem(LS_KEY) || '{}').settings || {}).tgToken || '' });
        S.days = keepDays || {}; PLAYER = S.player;
        try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (_) {}
        route();
      } else if (S.updatedAt) { DIRTY = true; scheduleProgressSync(true); }
    } else if (S.player.name) { DIRTY = true; scheduleProgressSync(true); }
    // pull today's remote log so counts continue across devices
    const ts = await DB.doc('log/' + dayKey()).get();
    if (ts.exists) { const r = ts.data(); const t = today(); if ((r.att || 0) > t.att) { S.days[dayKey()] = Object.assign(t, JSON.parse(JSON.stringify(r))); } }
    if (VIEW.name === 'home') route();
  } catch (e) { SYNC.err = (e && e.code) || String(e); if (MODE.kind !== 'web') { DB = null; SYNC.mode = 'local'; } }
}
function queueWrite(fn){ dbWriting = dbWriting.then(fn).then(() => { SYNC.last = Date.now(); SYNC.err = ''; }).catch(e => { SYNC.err = (e && e.code) || String(e); }); return dbWriting; }
function progressDoc(){ const c = JSON.parse(JSON.stringify(S)); delete c.days; if (c.settings) c.settings.tgToken = ''; return c; }
function scheduleProgressSync(now){ if (!DB || !DIRTY) return; clearTimeout(progressTimer); progressTimer = setTimeout(() => queueWrite(() => DB.doc('progress/main').set(progressDoc())), now ? 0 : 4000); }
function scheduleLogSync(now){ if (!DB || !LOG_DIRTY) return; clearTimeout(logTimer); const k = dayKey(); logTimer = setTimeout(() => { const d = S.days[k]; if (d) queueWrite(() => DB.doc('log/' + k).set(JSON.parse(JSON.stringify(d)))); }, now ? 0 : 3000); }

// ---------------- Active time tracking ----------------
let lastInput = Date.now(), lastTick = Date.now(), sessionIdx = -1;
['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(ev => addEventListener(ev, () => { lastInput = Date.now(); }, { passive:true }));
function tickTime(){
  const now = Date.now(); const dt = now - lastTick; lastTick = now;
  if (document.visibilityState === 'visible' && now - lastInput < 90000 && dt < 20000 && S.player.name && (VIEW.name === 'play' || VIEW.name === 'results')) {
    const t = today(); t.ms += dt; touchSession(t); LOG_DIRTY = true;
  }
}
function touchSession(t){
  const now = Date.now(); const s = t.sessions[t.sessions.length - 1];
  if (s && now - s.e < 10 * 60000) s.e = now; else t.sessions.push({ s:now, e:now, att:0, cor:0 });
  if (t.sessions.length > 40) t.sessions.splice(0, t.sessions.length - 40);
}
setInterval(() => { tickTime(); if (VIEW.name === 'home') updateRing(); }, 5000);
document.addEventListener('visibilitychange', () => { tickTime(); if (document.visibilityState === 'hidden') { saveLocal(LOG_DIRTY); scheduleLogSync(true); } });
addEventListener('pagehide', () => { tickTime(); saveLocal(LOG_DIRTY); scheduleLogSync(true); });

// ---------------- Sound + confetti ----------------
let AC = null;
function beep(kind){
  if (!S.settings.sound) return;
  try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); const seq = kind === 'good' ? [660, 880] : kind === 'win' ? [523, 659, 784, 1046] : [300, 220];
    seq.forEach((f, i) => { const o = AC.createOscillator(), g = AC.createGain(); o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, AC.currentTime + i * 0.09); g.gain.exponentialRampToValueAtTime(0.12, AC.currentTime + i * 0.09 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + i * 0.09 + 0.18); o.connect(g).connect(AC.destination); o.start(AC.currentTime + i * 0.09); o.stop(AC.currentTime + i * 0.09 + 0.2); });
  } catch (_) {}
}
function confetti(n = 90){
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = $('#confetti'); const x = c.getContext('2d'); c.width = innerWidth; c.height = innerHeight;
  const cs = getComputedStyle(document.documentElement); const cols = ['--coral', '--teal', '--butter', '--lilac'].map(v => cs.getPropertyValue(v).trim());
  const P = [...Array(n)].map(() => ({ x:innerWidth / 2 + (Math.random() - .5) * 200, y:innerHeight * .35, vx:(Math.random() - .5) * 12, vy:-Math.random() * 12 - 4, r:Math.random() * 6 + 4, c:cols[Math.floor(Math.random() * 4)], a:Math.random() * 6 }));
  let f = 0; (function loop(){ x.clearRect(0, 0, c.width, c.height); P.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += .45; p.a += .2; x.save(); x.translate(p.x, p.y); x.rotate(p.a); x.fillStyle = p.c; x.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); x.restore(); }); if (++f < 80) requestAnimationFrame(loop); else x.clearRect(0, 0, c.width, c.height); })();
}
function toast(msg){ const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); }

// ---------------- Mascot + icons ----------------
function mascot(mood = 'happy', size = 64){
  const col = { coral:'var(--filling)', teal:'var(--teal)', butter:'var(--butter)', lilac:'var(--lilac)' }[S.player.color || 'coral'];
  const mouth = mood === 'happy' ? '<path d="M25 40 Q32 47 39 40" stroke="var(--ink)" stroke-width="2.6" fill="none" stroke-linecap="round"/>'
    : mood === 'wow' ? '<ellipse cx="32" cy="42" rx="4" ry="5" fill="var(--ink)"/>'
    : mood === 'sad' ? '<path d="M26 44 Q32 39 38 44" stroke="var(--ink)" stroke-width="2.6" fill="none" stroke-linecap="round"/>'
    : '<path d="M27 42 H37" stroke="var(--ink)" stroke-width="2.6" stroke-linecap="round"/>';
  const eyes = mood === 'happy' ? '<path d="M21 30 Q24 26 27 30 M37 30 Q40 26 43 30" stroke="var(--ink)" stroke-width="2.6" fill="none" stroke-linecap="round"/>' : '<circle cx="24" cy="30" r="3" fill="var(--ink)"/><circle cx="40" cy="30" r="3" fill="var(--ink)"/>';
  return '<svg viewBox="0 0 64 64" width="' + size + '" height="' + size + '" aria-hidden="true"><circle cx="32" cy="33" r="28" fill="var(--crust)"/><path d="M32 33 L32 9 A24 24 0 1 1 11.2 21 Z" fill="' + col + '"/><path d="M32 33 L11.2 21 A24 24 0 0 1 32 9 Z" fill="var(--sky)" opacity=".9"/>' + eyes + '<circle cx="18" cy="38" r="3.5" fill="var(--coral)" opacity=".45"/><circle cx="46" cy="38" r="3.5" fill="var(--coral)" opacity=".45"/>' + mouth + (mood === 'wow' ? '<path d="M54 10 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill="var(--butter)"/>' : '') + '</svg>';
}
const ICON = {
  lock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  star:(on) => '<svg viewBox="0 0 24 24"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4L2.8 9.5l6.4-.8z" fill="' + (on ? 'var(--butter)' : 'var(--line)') + '" stroke="' + (on ? 'var(--warn)' : 'none') + '" stroke-width="1"/></svg>',
  bulb:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/></svg>',
  flame:'<svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 2s5 5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5 1-8.5z" fill="var(--coral)"/></svg>',
  gem:'<svg viewBox="0 0 24 24" width="16" height="16"><path d="M6 3h12l4 6-10 12L2 9z" fill="var(--lilac)"/></svg>',
  back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M15 5l-7 7 7 7"/></svg>',
  book:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--warn)" stroke-width="2.2"><path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/></svg>',
  compass:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--teal)" stroke-width="2.2"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z" fill="var(--teal)"/></svg>',
  twist:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--lilac)" stroke-width="2.4" stroke-linecap="round"><path d="M4 8c4-4 8 4 12 0M8 16c4-4 8 4 12 0"/></svg>',
  padlock:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--ink2)" stroke-width="2.2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
};
const starsHtml = (n, max = 3) => '<span class="stars">' + [...Array(max)].map((_, i) => ICON.star(i < n)).join('') + '</span>';

// ---------------- Figures (SVG) ----------------
function svgFig(f, o = {}){
  const sel = o.sel || new Set(f.s || []); const inter = !!o.interactive; const fill = i => sel.has(i) ? 'var(--coral)' : 'var(--paper)';
  const st = 'stroke="var(--ink)" stroke-width="2"';
  const cls = i => inter ? ' class="cell" data-i="' + i + '" style="cursor:pointer"' : '';
  if (f.k === 'grid') {
    const cs = Math.min(56, Math.floor(300 / Math.max(f.c, 1)), Math.floor(220 / Math.max(f.r, 1))); const Wd = f.c * cs + 4, Ht = f.r * cs + 4; let s = '';
    for (let r = 0; r < f.r; r++) for (let c = 0; c < f.c; c++) { const i = r * f.c + c; s += '<rect' + cls(i) + ' x="' + (2 + c * cs) + '" y="' + (2 + r * cs) + '" width="' + cs + '" height="' + cs + '" fill="' + fill(i) + '" ' + st + '/>'; }
    return '<svg viewBox="0 0 ' + Wd + ' ' + Ht + '" width="' + Wd + '" height="' + Ht + '" role="img">' + s + '</svg>';
  }
  if (f.k === 'pie') {
    const R0 = o.small ? 34 : 70, C = R0 + 4, n = f.n; let s = '';
    if (n === 1) s = '<circle' + cls(0) + ' cx="' + C + '" cy="' + C + '" r="' + R0 + '" fill="' + fill(0) + '" ' + st + '/>';
    else for (let i = 0; i < n; i++) { const a0 = -Math.PI / 2 + i * 2 * Math.PI / n, a1 = a0 + 2 * Math.PI / n; const x0 = C + R0 * Math.cos(a0), y0 = C + R0 * Math.sin(a0), x1 = C + R0 * Math.cos(a1), y1 = C + R0 * Math.sin(a1);
      s += '<path' + cls(i) + ' d="M' + C + ' ' + C + ' L' + x0.toFixed(2) + ' ' + y0.toFixed(2) + ' A' + R0 + ' ' + R0 + ' 0 ' + (n === 2 ? 0 : 0) + ' 1 ' + x1.toFixed(2) + ' ' + y1.toFixed(2) + ' Z" fill="' + fill(i) + '" ' + st + ' stroke-linejoin="round"/>'; }
    return '<svg viewBox="0 0 ' + 2 * C + ' ' + 2 * C + '" width="' + 2 * C + '" height="' + 2 * C + '" role="img">' + s + '</svg>';
  }
  if (f.k === 'dots') {
    const cs = 48, Wd = f.c * cs + 12, Ht = f.r * cs + 12; let s = '<rect x="2" y="2" width="' + (Wd - 4) + '" height="' + (Ht - 4) + '" rx="10" fill="none" ' + st + '/>';
    for (let r = 0; r < f.r; r++) for (let c = 0; c < f.c; c++) { const i = r * f.c + c; s += '<circle' + cls(i) + ' cx="' + (6 + cs / 2 + c * cs) + '" cy="' + (6 + cs / 2 + r * cs) + '" r="' + (cs / 2 - 7) + '" fill="' + fill(i) + '" ' + st + '/>'; }
    return '<svg viewBox="0 0 ' + Wd + ' ' + Ht + '" width="' + Wd + '" height="' + Ht + '" role="img">' + s + '</svg>';
  }
  if (f.k === 'strip') {
    const tot = f.w.reduce((a, b) => a + b, 0); let x = 2, s = ''; const Wd = 300;
    f.w.forEach((w, i) => { const ww = w / tot * Wd; s += '<rect x="' + x.toFixed(1) + '" y="2" width="' + ww.toFixed(1) + '" height="60" fill="' + fill(i) + '" ' + st + '/>'; x += ww; });
    return '<svg viewBox="0 0 304 64" width="304" height="64" role="img">' + s + '</svg>';
  }
  if (f.k === 'tri3') {
    const A = [60, 6], B = [6, 100], C = [114, 100], G = [60, (6 + 100 + 100) / 3];
    const p = (a, b, c) => 'M' + a + ' L' + b + ' L' + c + ' Z';
    return '<svg viewBox="0 0 120 106" width="120" height="106"><path d="' + p(A, G, B) + '" fill="var(--coral)" ' + st + '/><path d="' + p(B, G, C) + '" fill="var(--paper)" ' + st + '/><path d="' + p(C, G, A) + '" fill="var(--paper)" ' + st + '/></svg>';
  }
  if (f.k === 'band') {
    return '<svg viewBox="0 0 110 110" width="110" height="110"><defs><clipPath id="bc"><circle cx="55" cy="55" r="48"/></clipPath></defs><circle cx="55" cy="55" r="48" fill="var(--paper)"/><rect x="0" y="44" width="110" height="22" fill="var(--coral)" clip-path="url(#bc)"/><line x1="7" y1="44" x2="103" y2="44" ' + st + ' clip-path="url(#bc)"/><line x1="7" y1="66" x2="103" y2="66" ' + st + ' clip-path="url(#bc)"/><circle cx="55" cy="55" r="48" fill="none" ' + st + '/></svg>';
  }
  if (f.k === 'row') return f.items.map(it => svgFig(Object.assign({}, it), { small:true })).join('');
  if (f.k === 'nl') return numberLine(f.max, f.den, o.pick != null ? o.pick : f.at, !!o.interactive);
  return '';
}
function numberLine(max, den, at, inter){
  const Wd = 620, L = 30, Rr = Wd - 30, y = 50, n = max * den; const step = (Rr - L) / n; let s = '<line x1="' + (L - 14) + '" y1="' + y + '" x2="' + (Rr + 14) + '" y2="' + y + '" stroke="var(--ink)" stroke-width="3" stroke-linecap="round"/>';
  for (let i = 0; i <= n; i++) { const x = L + i * step; const whole = i % den === 0; s += '<line x1="' + x + '" y1="' + (y - (whole ? 14 : 9)) + '" x2="' + x + '" y2="' + (y + (whole ? 14 : 9)) + '" stroke="var(--ink)" stroke-width="' + (whole ? 3 : 2) + '"/>';
    if (whole) s += '<text x="' + x + '" y="' + (y + 36) + '" text-anchor="middle" font-family="Fredoka, sans-serif" font-size="20" font-weight="600" fill="var(--ink)">' + (i / den) + '</text>';
    if (inter) s += '<rect class="tick" data-i="' + i + '" x="' + (x - step / 2) + '" y="' + (y - 30) + '" width="' + step + '" height="60" fill="transparent" style="cursor:pointer"/>'; }
  if (at != null && at !== '') s += '<circle cx="' + (L + at * step) + '" cy="' + y + '" r="10" fill="var(--coral)" stroke="var(--ink)" stroke-width="2"/>';
  return '<svg viewBox="0 0 ' + Wd + ' 100" width="' + Wd + '" height="100" role="img" style="max-width:100%">' + s + '</svg>';
}

// ---------------- Scoring, ranks, badges ----------------
const RANKS = [['Crumb', 0], ['Slice', 150], ['Quarter', 400], ['Half', 800], ['Whole', 1400], ['Double', 2200], ['Fraction Master', 3200], ['Fraction Legend', 4500]];
function rankOf(xp){ let r = RANKS[0], next = null; for (let i = 0; i < RANKS.length; i++) { if (xp >= RANKS[i][1]) { r = RANKS[i]; next = RANKS[i + 1] || null; } } return { name:r[0], next }; }
const BADGES = {
  first:['First Slice','Your first correct answer'], simpl:['Simplifier','20 answers simplified without a reminder'], nohint:['No Hints Hero','A full round with no hints'],
  twist:['Twist Tamer','Passed a Twist level'], hopper:['Island Hopper','Passed Explorer on 3 islands'], streak10:['On Fire','10 correct in a row'],
  perfect:['Perfect Ten','10 out of 10 first try'], book:['Bookworm','Every textbook question on an island solved'], goal3:['Steady Climber','Met the daily goal on 3 days'], crown:['Crown Wearer','Passed Crown Island Twist'],
};
function award(id){ if (S.badges[id]) return false; S.badges[id] = Date.now(); RUN && RUN.newBadges.push(id); return true; }
function levelUnlocked(w, L){
  if (S.settings.unlockAll) return true;
  if (w > 1 && w < 12 && !(W(w - 1).L2.best >= 7)) return false;
  if (w === 12 && [...Array(11)].filter((_, i) => W(i + 1).L2.best >= 7).length < 6) return false;
  if (L === 1) return true; if (L === 2) return W(w).L1.best >= 7 || W(w).L2.rounds > 0; return W(w).L2.best >= 7 || W(w).L3.rounds > 0;
}
const starsFor = best => best >= 10 ? 3 : best >= 8.5 ? 2 : best >= 7 ? 1 : 0;

// ---------------- Generic hints ----------------
const GH = {
  meaning:['Count all the EQUAL parts. That number goes on the bottom.','Count the parts you want. That number goes on top.'],
  collection:['What is the whole here? How many in total?','The part goes on top, the whole on the bottom. Then simplify.'],
  numline:['How many equal jumps are there between 0 and 1?','Each jump is one piece of that size. Count jumps from 0.'],
  proper:['Compare the numerator with the denominator.','Top smaller than bottom means less than 1.'],
  mixed:['Mixed to improper: wholes × denominator, then add the numerator.','Improper to mixed: divide. The remainder goes on top.'],
  equiv:['Multiply or divide top AND bottom by the same number.','What was the denominator multiplied by?'],
  simplest:['Find a number that divides both the top and bottom.','Keep dividing until only 1 divides both. The HCF does it in one go.'],
  compare:['Same denominator? Compare tops. Same numerator? The smaller bottom wins.','Otherwise cross multiply, or use a common denominator.'],
  order:['Use one common denominator for all of them.','Then put the numerators in order.'],
  addlike:['The pieces are the same size, so just add (or subtract) the tops.','The denominator stays the same. Then simplify.'],
  addunlike:['Can you add pieces of different sizes? Make the denominators the same first.','Find the LCM of the denominators and rewrite both fractions.'],
  sub:['Make the denominators the same first.','For mixed numbers, change them to improper fractions first. That avoids borrowing trouble.'],
  mulwhole:['Multiply the whole number by the numerator. Keep the denominator.','Cancel common factors first to keep the numbers small.'],
  mulfrac:['Top × top and bottom × bottom.','Change mixed numbers into improper fractions FIRST. Cancel before multiplying.'],
  div:['Dividing by a fraction is multiplying by its reciprocal.','Keep the first, flip the second, then multiply.'],
  bodmas:['BODMAS: Brackets, Of, Division and Multiplication, Addition and Subtraction.','Do one step, rewrite the line, then the next step.'],
  word:['What do you know? What do you need to find?','Which operation joins them: add, subtract, multiply or divide?'],
};
function hintsFor(q){
  const hs = (q.hint && q.hint.length ? q.hint : GH[q.sk] || []).slice();
  if (q.e && q.sol && q.sol.length > 1) { const first = q.sol.find(l => !l.startsWith('<b>')); if (first) hs.push('First step: ' + first); }
  return hs.slice(0, 3);
}

// ---------------- Round building ----------------
function bookFor(w){ return (BOOK[w] || []).map(q => prepare(q)).filter(q => !q._broken); }
function buildRound(w, L){
  if (L === 1) {
    const all = bookFor(w); const seen = W(w).L1.seen;
    const unsolved = R.shuffle(all.filter(q => seen[q.id] !== 1)); const solved = R.shuffle(all.filter(q => seen[q.id] === 1));
    const out = unsolved.concat(solved).slice(0, 10);
    while (out.length < 10) out.push(makeQuestion(w, 2));
    return out;
  }
  const qs = []; const n = 10;
  if (L === 3 && w > 1 && w < 12) { for (let i = 0; i < 2; i++) { const pw = R.int(1, w - 1); qs.push(Object.assign(makeQuestion(pw, R.pick([2, 3])), { review:pw })); } }
  pullRetries(qs, r => r.w === w, 2);
  while (qs.length < n) qs.push(makeQuestion(w, L));
  return R.shuffle(qs);
}
function pullRetries(qs, pred, max){
  const list = (S.retry || []).filter(pred).slice(0, max);
  list.forEach(r => { try { const q = prepare(JSON.parse(JSON.stringify(r.spec))); q.id = 'r-' + Math.random().toString(36).slice(2, 8); q.gen = true; q.retried = r; q.again = true; if (!q._broken) qs.push(q); } catch (_) {} });
}
function buildDailyMix(){
  const open = []; for (let w = 1; w <= 11; w++) if (levelUnlocked(w, 2)) open.push(w);
  if (!open.length) open.push(1);
  const skillAcc = sk => { const s = S.skills[sk]; return s && s.a >= 3 ? s.c / s.a : 0.6; };
  const weightOf = w => { const sks = new Set(bookFor(w).map(q => q.sk)); let worst = 1; sks.forEach(k => { worst = Math.min(worst, skillAcc(k)); }); return 1.4 - worst; };
  const weights = open.map(weightOf); const tot = weights.reduce((a, b) => a + b, 0);
  const qs = []; pullRetries(qs, () => true, 4); while (qs.length < 10) { let r = Math.random() * tot, i = 0; while (r > weights[i] && i < weights.length - 1) { r -= weights[i]; i++; } qs.push(Object.assign(makeQuestion(open[i], levelUnlocked(open[i], 3) && Math.random() < .5 ? 3 : 2), { review:open[i] })); }
  return qs;
}

// ---------------- Router + views ----------------
let VIEW = { name:'home' }; let RUN = null;
function route(){
  const app = $('#app');
  if (!S.player.name) return renderOnboard(app);
  if (VIEW.name === 'play') return renderPlay(app);
  if (VIEW.name === 'results') return renderResults(app);
  if (VIEW.name === 'parent') return renderParent(app);
  return renderHome(app);
}
function go(name, extra = {}){ VIEW = Object.assign({ name }, extra); route(); scrollTo(0, 0); }

function renderOnboard(app){
  app.innerHTML = '<div class="play" style="max-width:520px;margin-top:6vh"><div class="card" style="text-align:center"><div class="mascot">' + mascot('wow', 96) + '</div><h1 style="font-size:32px;margin:8px 0">Fraction Quest</h1><p class="muted">Hop across 12 islands, one for each part of your fractions chapter. Warm up with your textbook, then take on fresh puzzles and twists.</p>'
    + '<div class="field" style="text-align:left"><label for="nm">What should I call you?</label><input id="nm" maxlength="20" autocomplete="off" placeholder="Your name"></div>'
    + '<div class="field" style="text-align:left"><label>Pick your pie buddy\'s colour</label><div class="actions" id="cols">' + ['coral', 'teal', 'butter', 'lilac'].map(c => '<button class="btn ghost small" data-c="' + c + '" style="border-color:var(--' + c + ')">' + c[0].toUpperCase() + c.slice(1) + '</button>').join('') + '</div></div>'
    + '<button class="btn coral" id="start" style="width:100%;margin-top:8px">Start the quest</button></div></div>';
  let col = 'coral';
  $$('#cols button').forEach(b => b.onclick = () => { col = b.dataset.c; $$('#cols button').forEach(x => x.style.background = ''); b.style.background = 'var(--' + col + '-s)'; });
  $('#start').onclick = () => { const n = $('#nm').value.replace(/[<>&"']/g, '').trim(); if (!n) { $('#nm').focus(); return; } S.player.name = n; S.player.color = col; PLAYER = S.player; saveLocal(true); go('home'); };
  $('#nm').addEventListener('keydown', e => { if (e.key === 'Enter') $('#start').click(); });
}

function ringSvg(frac, size = 86){ const r = size / 2 - 7, c = 2 * Math.PI * r; return '<svg width="' + size + '" height="' + size + '"><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" stroke="var(--line)" stroke-width="9" fill="none"/><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" stroke="var(--teal)" stroke-width="9" fill="none" stroke-linecap="' + (frac > 0.01 ? 'round' : 'butt') + '" stroke-dasharray="' + (c * Math.min(1, frac)).toFixed(1) + ' ' + c.toFixed(1) + '"/></svg>'; }
function updateRing(){ const el = $('#ring'); if (!el) return; const t = today(); el.innerHTML = ringSvg(t.ms / (S.settings.goalMin * 60000)) + '<b>' + mins(t.ms) + '<small>of ' + S.settings.goalMin + ' min</small></b>'; }
function dayStreak(){ let n = 0; const d = new Date(); for (let i = 0; i < 365; i++) { const k = dayKey(d.getTime() - i * 86400000); const x = S.days[k]; if (x && x.att > 0) n++; else if (i > 0) break; } return n; }

function renderHome(app){
  const rk = rankOf(S.xp); const t = today(); const streak = dayStreak();
  const greet = t.att === 0 ? 'Ready for today\'s quest, ' + esc(S.player.name) + '?' : t.ms >= S.settings.goalMin * 60000 ? 'Daily goal smashed, ' + esc(S.player.name) + '!' : 'Nice going, ' + esc(S.player.name) + '. Keep hopping!';
  let html = '<div class="top"><div class="brand">' + mascot('happy', 46) + '<div><h1>Fraction Quest</h1><small>Chapter 5 · Fractions</small></div></div>'
    + '<span class="chip tnum" title="Rank">' + ICON.gem + rk.name + ' · ' + S.xp + ' XP</span><span class="chip tnum" title="Days in a row">' + ICON.flame + streak + ' day' + (streak === 1 ? '' : 's') + '</span>'
    + '<button class="iconbtn" id="parentBtn" title="Parent area" aria-label="Parent area">' + ICON.lock + '</button></div>';
  if (MODE.kind === 'demo') html += '<div class="panel" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:16px"><b>Demo mode.</b><span class="muted" style="flex:1;min-width:200px">Everything works, including the parent report behind the lock. Progress stays in this browser only.</span><button class="btn ghost small" id="exitDemo">Exit demo</button></div>';
  html += '<div class="hero"><div class="mascot">' + mascot(t.att ? 'wow' : 'happy', 72) + '</div><div><div class="say">' + greet + '</div><div class="sub tnum">Today: ' + t.att + ' questions · ' + (t.att ? Math.round(100 * t.cor / t.att) : 0) + '% correct' + (rk.next ? ' · ' + (rk.next[1] - S.xp) + ' XP to ' + rk.next[0] : '') + '</div><div class="actions"><button class="btn coral" id="mixBtn">Daily Mix</button><button class="btn ghost" id="contBtn">Continue where I left off</button></div></div><div class="ring" id="ring"></div></div>';
  html += '<div class="map">';
  for (let w = 1; w <= 12; w++) {
    const info = WORLDS[w]; const ws = W(w); const lockedW = !levelUnlocked(w, 1);
    const bookN = bookFor(w).length; const solved = Object.values(ws.L1.seen).filter(v => v === 1).length;
    const lv = (L, icon, name, sub) => { const un = levelUnlocked(w, L); const best = ws['L' + L].best; return '<button class="lv" data-w="' + w + '" data-l="' + L + '" ' + (un ? '' : 'disabled') + '>' + (un ? icon : ICON.padlock) + '<span class="nm">' + name + '<small>' + sub + '</small></span>' + starsHtml(starsFor(best)) + '</button>'; };
    html += '<div class="isle c-' + info.color + (lockedW ? ' locked' : '') + '"><svg class="blob" viewBox="0 0 44 44"><path d="M22 3c11 0 19 7 19 18s-9 20-20 20S3 33 3 22 11 3 22 3z" fill="var(--' + info.color + '-s)"/><text x="22" y="28" text-anchor="middle" font-family="Fredoka,sans-serif" font-weight="700" font-size="15" fill="var(--' + (info.color === 'butter' ? 'warn' : info.color) + ')">' + (w === 12 ? '★' : w) + '</text></svg>'
      + '<span class="ex">' + (w === 12 ? 'Revision' : 'Ex ' + info.ex) + '</span><h3>' + info.name + '</h3><div class="topic">' + info.topic + '</div>'
      + lv(1, ICON.book, 'Warm-up', 'Textbook · ' + solved + '/' + bookN + ' solved') + lv(2, ICON.compass, 'Explorer', 'Fresh questions') + lv(3, ICON.twist, 'Twist', 'Think harder')
      + '<button class="learnlink" data-learn="' + w + '">Learn the idea</button></div>';
  }
  html += '</div><p class="note" style="margin-top:18px">Pass a level by scoring 7 out of 10. First try with no hints scores a full point; a fix after a hint or a retry scores half.' + (SYNC.mode === 'cloud' ? ' Progress is saved online.' : '') + '</p>';
  app.innerHTML = html; updateRing();
  $$('.lv').forEach(b => b.onclick = () => startRound(+b.dataset.w, +b.dataset.l));
  $$('[data-learn]').forEach(b => b.onclick = () => showLearn(+b.dataset.learn));
  $('#mixBtn').onclick = () => startRound(0, 0);
  $('#contBtn').onclick = () => { for (let w = 1; w <= 12; w++) for (let L = 1; L <= 3; L++) if (levelUnlocked(w, L) && W(w)['L' + L].best < 7) return startRound(w, L); startRound(0, 0); };
  $('#parentBtn').onclick = () => parentGate();
  const xd = $('#exitDemo'); if (xd) xd.onclick = () => { ssSet('fq.demo', null); location.hash = ''; location.reload(); };
}

function showLearn(w){
  const c = LEARN[w]; const info = WORLDS[w];
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = '<div class="sheet" role="dialog" aria-label="Learn"><div class="qhead"><span class="tag">' + (w === 12 ? 'Revision' : 'Ex ' + info.ex) + '</span>' + info.name + '</div><div class="learnbig">' + rich(c.big) + '</div>' + (c.fig ? '<div class="figwrap">' + svgFig(c.fig) + '</div>' : '') + '<ul>' + c.pts.map(p => '<li>' + rich(p) + '</li>').join('') + '</ul><div class="think"><b>Think about it:</b> ' + rich(c.ask) + '</div><div class="ctrl"><span></span><button class="btn" id="lclose">Got it</button></div></div>';
  document.body.appendChild(m); $('#lclose', m).onclick = () => m.remove(); m.onclick = e => { if (e.target === m) m.remove(); };
}

// ---------------- Play ----------------
function startRound(w, L){
  const qs = w === 0 ? buildDailyMix() : buildRound(w, L);
  RUN = { w, L, qs, i:0, results:[], streak:0, hintsTotal:0, newBadges:[], startedAt:Date.now(), xpStart:S.xp };
  newQ(); go('play');
}
function newQ(){ RUN.cur = { tries:0, hints:0, shown:[], nudged:false, done:false, t0:Date.now(), sel:new Set(), pick:null, order:[], given:'' }; }
function levelLabel(){ return RUN.w === 0 ? 'Daily Mix' : (RUN.w === 12 ? 'Crown Island' : 'Ex ' + WORLDS[RUN.w].ex + ' · ' + WORLDS[RUN.w].name) + ' · ' + ['', 'Warm-up', 'Explorer', 'Twist'][RUN.L]; }

function renderPlay(app){
  const q = RUN.qs[RUN.i]; const C = RUN.cur;
  const dots = RUN.qs.map((_, i) => { const r = RUN.results[i]; return '<i class="' + (i === RUN.i && !C.done ? 'cur' : r == null ? '' : r.ok === 1 ? 'ok' : r.ok > 0 ? 'half' : 'no') + '"></i>'; }).join('');
  const tag = RUN.L === 1 && !q.gen ? '<span class="tag book">Textbook</span>' : q.again ? '<span class="tag twist">Try again</span>' : q.review ? '<span class="tag">Review · Ex ' + WORLDS[q.review].ex + '</span>' : RUN.L === 3 ? '<span class="tag twist">Twist</span>' : '<span class="tag">Fresh</span>';
  let html = '<div class="play"><div class="pbar"><button class="iconbtn" id="quit" aria-label="Back to map">' + ICON.back + '</button><div class="dots">' + dots + '</div><span class="chip tnum">' + ICON.flame + RUN.streak + '</span></div>'
    + '<div class="card"><div class="qhead">' + tag + '<span>' + esc(levelLabel()) + '</span><span style="margin-left:auto" class="tnum">' + (RUN.i + 1) + ' / ' + RUN.qs.length + '</span></div>'
    + '<div class="q">' + rich(q.q) + '</div>' + bodyFor(q) + '<div id="fb"></div>'
    + '<div class="ctrl"><button class="btn ghost small hintbtn" id="hint">' + ICON.bulb + 'Hint</button><span style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn ghost small" id="show" hidden>Show me how</button><button class="btn coral" id="check">Check</button><button class="btn teal" id="next" hidden>Next</button></span></div></div></div>';
  app.innerHTML = html;
  wireBody(q);
  $('#quit').onclick = () => { if (RUN.results.length) finishRound(true); else go('home'); };
  $('#check').onclick = () => doCheck(q);
  $('#next').onclick = () => nextQ();
  $('#hint').onclick = () => doHint(q);
  $('#show').onclick = () => reveal(q, true);
  updateHintBtn(q);
  const first = $('.box, .opt, input', $('.card')); if (first && first.focus && first.tagName === 'INPUT') setTimeout(() => first.focus(), 50);
}
function fracInput(prefix = '', opts = {}){
  const showW = opts.whole !== false;
  return '<span class="fin">' + (showW ? '<input class="box w" id="' + prefix + 'w" inputmode="numeric" autocomplete="off" aria-label="Whole number (leave empty if none)" placeholder=" ">' : '') + '<span class="stack"><input class="box" id="' + prefix + 'n" inputmode="numeric" autocomplete="off" aria-label="Numerator"><hr><input class="box" id="' + prefix + 'd" inputmode="numeric" autocomplete="off" aria-label="Denominator"></span></span>';
}
function bodyFor(q){
  const fig = q.fig ? '<div class="figwrap" id="fig">' + svgFig(q.fig, { interactive: q.t === 'shade', sel: q.t === 'shade' ? RUN.cur.sel : undefined }) + '</div>' : '';
  switch (q.t) {
    case 'frac': case 'read': {
      const whole = !(q.form === 'improper' || q.form === 'exact');
      return fig + '<div class="answer">' + fracInput('', { whole }) + (q.unit ? '<span class="unit">' + esc(q.unit) + '</span>' : '') + '</div><p class="note" style="text-align:center">' + (whole ? 'Whole number box is optional. For a whole number answer, type it in the big box only.' : 'Type the numerator on top and the denominator below.') + '</p>';
    }
    case 'num': return fig + '<div class="answer">' + (q.unit === '₹' ? '<span class="unit">₹</span>' : '') + '<input class="box wide" id="x" inputmode="numeric" autocomplete="off" aria-label="Answer">' + (q.unit && q.unit !== '₹' ? '<span class="unit">' + esc(q.unit) + '</span>' : '') + '</div>';
    case 'mcq': return (q.figOpts ? '<div class="figs4">' + q.figOpts.map((f, i) => '<div>' + svgFig(f) + '<div>' + 'ABCD'[i] + '</div></div>').join('') + '</div>' : fig) + '<div class="opts">' + q.opts.map((o, i) => '<button class="opt" data-i="' + i + '">' + rich(o) + '</button>').join('') + '</div>';
    case 'yn': return fig + '<div class="opts" style="max-width:420px;margin:0 auto"><button class="opt" data-i="1" style="text-align:center">Yes</button><button class="opt" data-i="0" style="text-align:center">No</button></div>';
    case 'cmp': return '<div class="cmpwrap">' + rich(srcTok(q.L)) + '<span class="slot" id="slot">?</span>' + rich(srcTok(q.R)) + '</div><div class="cmpbtns" style="margin-top:14px">' + ['<', '=', '>'].map(s => '<button class="opt" data-s="' + s + '">' + esc(s) + '</button>').join('') + '</div>';
    case 'order': return '<div class="order"><div class="olabel">Your order (' + (q.dir === 'asc' ? 'smallest first' : 'largest first') + ')</div><div class="orow" id="ans"></div><div class="olabel">Tap to place</div><div class="orow pool" id="pool"></div></div>';
    case 'open': return fig + '<div class="answer" style="flex-direction:column">' + [...Array(q.n)].map((_, i) => q.v === 'pairsum' ? '<span class="fin"><input class="box wide" id="o' + i + 'a" placeholder="e.g. 1/3" autocomplete="off"><b>+</b><input class="box wide" id="o' + i + 'b" placeholder="e.g. 2/3" autocomplete="off"></span>' : '<input class="box wide" id="o' + i + '" placeholder="e.g. 3/4" autocomplete="off">').join('') + '</div><p class="note" style="text-align:center">Type fractions like 3/4, or mixed numbers like 1 1/2.</p>';
    case 'shade': return fig + '<p class="note tnum" id="shcount" style="text-align:center">Tap parts to shade them. 0 shaded.</p>';
    case 'line': return '<div class="figwrap" id="fig">' + numberLine(q.max, q.den, null, true) + '</div><div class="cmpbtns"><button class="btn ghost small" id="jl" aria-label="Move one jump left">◀ One jump</button><button class="btn ghost small" id="jr" aria-label="Move one jump right">One jump ▶</button></div><p class="note" style="text-align:center">Tap a mark on the line, or use the jump buttons to move the dot.</p>';
  }
  return '';
}
function wireBody(q){
  const C = RUN.cur;
  const boxes = $$('.card input.box');
  boxes.forEach((b, i) => b.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); if (!C.done) $('#check').click(); else $('#next').click(); }
    if (e.key === '/' && b.id.endsWith('n')) { e.preventDefault(); const d = $('#' + b.id.slice(0, -1) + 'd'); d && d.focus(); }
    if (e.key === ' ' && b.id.endsWith('w')) { e.preventDefault(); const n = $('#' + b.id.slice(0, -1) + 'n'); n && n.focus(); }
  }));
  if (q.t === 'mcq' || q.t === 'yn') $$('.opt').forEach(b => b.onclick = () => { if (C.done) return; $$('.opt').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); C.pick = +b.dataset.i; });
  if (q.t === 'cmp') $$('.cmpbtns .opt').forEach(b => b.onclick = () => { if (C.done) return; $$('.cmpbtns .opt').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); C.pick = b.dataset.s; $('#slot').textContent = b.dataset.s; });
  if (q.t === 'shade') { const wire = () => $$('#fig .cell').forEach(c => c.onclick = () => { if (C.done) return; const i = +c.dataset.i; C.sel.has(i) ? C.sel.delete(i) : C.sel.add(i); $('#fig').innerHTML = svgFig(q.fig, { interactive:true, sel:C.sel }); const tot = q.fig.k === 'pie' ? q.fig.n : q.fig.r * q.fig.c; $('#shcount').textContent = C.sel.size + ' of ' + tot + ' parts shaded.'; wire(); }); wire(); }
  if (q.t === 'line') { const n = q.max * q.den; const put = i => { if (C.done) return; C.pick = Math.max(0, Math.min(n, i)); $('#fig').innerHTML = numberLine(q.max, q.den, C.pick, true); wire(); };
    const wire = () => $$('#fig .tick').forEach(c => c.onclick = () => put(+c.dataset.i)); wire();
    $('#jl').onclick = () => put((C.pick == null ? 0 : C.pick) - 1); $('#jr').onclick = () => put(C.pick == null ? 1 : C.pick + 1); }
  if (q.t === 'order') {
    if (!C.pool) C.pool = R.shuffle(q.items.slice());
    const draw = () => {
      const chip = s => rich(s.includes('/') ? '{' + s + '}' : s);
      $('#ans').innerHTML = C.order.map((s, i) => '<button class="ochip" data-a="' + i + '">' + chip(s) + '</button>').join('') || '<span class="note">Tap fractions below to place them here.</span>';
      $('#pool').innerHTML = C.pool.filter(s => !C.order.includes(s)).map(s => '<button class="ochip" data-p="' + esc(s) + '">' + chip(s) + '</button>').join('') || '<span class="note">All placed. Tap one above to take it back.</span>';
      $$('#pool .ochip').forEach(b => b.onclick = () => { if (C.done) return; C.order.push(b.dataset.p); draw(); });
      $$('#ans .ochip').forEach(b => b.onclick = () => { if (C.done) return; C.order.splice(+b.dataset.a, 1); draw(); });
    }; draw();
  }
}
function readFrac(s){ s = String(s || '').trim().replace(/\s+/g, ' '); if (!s) return null; try { return F(s); } catch (_) { return undefined; } }

function evaluateAnswer(q){
  const C = RUN.cur;
  if (q.t === 'frac' || q.t === 'read') { const inp = { w:($('#w') || {}).value, n:$('#n').value, d:$('#d').value }; C.given = [inp.w, inp.n && inp.d ? inp.n + '/' + inp.d : inp.n].filter(Boolean).join(' '); return checkFrac(q, inp); }
  if (q.t === 'num') { const x = $('#x').value; C.given = x; return checkNum(q, { x }); }
  if (q.t === 'mcq') { if (C.pick == null) return { status:'invalid', msg:'Pick an answer first.' }; C.given = plain(q.opts[C.pick]); return { status: C.pick === q.a ? 'correct' : 'wrong' }; }
  if (q.t === 'yn') { if (C.pick == null) return { status:'invalid', msg:'Pick Yes or No.' }; C.given = C.pick ? 'Yes' : 'No'; return { status: (C.pick === 1) === q.a ? 'correct' : 'wrong' }; }
  if (q.t === 'cmp') { if (C.pick == null) return { status:'invalid', msg:'Pick a sign.' }; C.given = C.pick; return { status: C.pick === q._ans ? 'correct' : 'wrong' }; }
  if (q.t === 'order') { if (C.order.length !== q.items.length) return { status:'invalid', msg:'Place all ' + q.items.length + ' fractions first.' }; C.given = C.order.join(', '); const ok = C.order.every((s, i) => F(s).eq(F(q._ans[i]))); if (!ok && C.order.every((s, i) => F(s).eq(F(q._ans[q._ans.length - 1 - i])))) return { status:'wrong', msg:'You have them in the opposite order. Read the question again: ' + (q.dir === 'asc' ? 'smallest first.' : 'largest first.') }; return { status: ok ? 'correct' : 'wrong' }; }
  if (q.t === 'shade') { const tot = q.fig.k === 'pie' ? q.fig.n : q.fig.r * q.fig.c; if (!C.sel.size) return { status:'invalid', msg:'Tap some parts to shade them.' }; C.given = C.sel.size + '/' + tot; return { status: new Frac(C.sel.size, tot).eq(q._ans) ? 'correct' : 'wrong', msg: !new Frac(C.sel.size, tot).eq(q._ans) ? 'You shaded ' + C.sel.size + ' of ' + tot + ' parts. That is ' + new Frac(C.sel.size, tot).tok() + ', not ' + q._ans.tok() + '.' : '' }; }
  if (q.t === 'line') { if (C.pick == null) return { status:'invalid', msg:'Tap a mark on the line.' }; const v = new Frac(C.pick, q.den); C.given = v.tok().replace(/[{}]/g, ''); return { status: v.eq(q._ans) ? 'correct' : 'wrong', msg: v.eq(q._ans) ? '' : 'You marked ' + v.tok() + '. Count the jumps again.' }; }
  if (q.t === 'open') {
    const list = [];
    for (let i = 0; i < q.n; i++) {
      if (q.v === 'pairsum') { const a = readFrac($('#o' + i + 'a').value), b = readFrac($('#o' + i + 'b').value); if (!a || !b) return { status:'invalid', msg: a === undefined || b === undefined ? 'Write fractions like 3/4.' : 'Fill in every box.' }; list.push([a, b]); }
      else { const a = readFrac($('#o' + i).value); if (!a) return { status:'invalid', msg: a === undefined ? 'Write fractions like 3/4.' : 'Fill in every box.' }; list.push(a); }
    }
    C.given = list.map(x => Array.isArray(x) ? x[0].rn + '/' + x[0].rd + ' + ' + x[1].rn + '/' + x[1].rd : x.rn + '/' + x.rd).join('; ');
    const flat = q.v === 'pairsum' ? list.map(([a, b]) => new Frac(Math.min(a.rn * b.rd, b.rn * a.rd), a.rd * b.rd)) : list;
    const keys = list.map(x => q.v === 'pairsum' ? [x[0].key(), x[1].key()].sort().join('|') : q.v === 'between' ? x.key() : x.rn + '/' + x.rd);
    if (q.n > 1 && new Set(keys).size !== keys.length) return { status:'wrong', msg:'Your answers must all be different.' + (q.v === 'between' ? ' Fractions that simplify to the same thing count as the same.' : '') };
    const m = VALIDATORS[q.v](q.p, list); return m ? { status:'wrong', msg:m } : { status:'correct' };
  }
  return { status:'invalid', msg:'Unknown question type.' };
}
function expectedText(q){
  if (q._ans && q._ans.tok) return untok(q._ans.tok());
  if (q.t === 'mcq') return plain(q.opts[q.a]); if (q.t === 'yn') return q.a ? 'Yes' : 'No'; if (q.t === 'cmp') return q._ans; if (q.t === 'order') return q._ans.join(', ');
  return '(open answer)';
}
function solutionHtml(q){
  const lines = [];
  if (q.why) lines.push('<p>' + rich(q.why) + '</p>');
  if (q.sol && q.sol.length) lines.push('<ol>' + q.sol.filter(l => !l.startsWith('<b>') || q.sol.length > 3).map(l => '<li>' + rich(l) + '</li>').join('') + '</ol>');
  if (!lines.length && q._ans && q._ans.tok) lines.push('<p>The answer is ' + rich(q._ans.tok()) + '.</p>');
  if (!lines.length && q.t === 'mcq') lines.push('<p>The answer is ' + rich(q.opts[q.a]) + '.</p>');
  if (!lines.length && q.t === 'yn') lines.push('<p>The answer is ' + (q.a ? 'Yes' : 'No') + '.</p>');
  if (!lines.length && q.t === 'order') lines.push('<p>' + rich(q._ans.map(s => '{' + s + '}').join(q.dir === 'asc' ? ' &lt; ' : ' &gt; ')) + '</p>');
  if (!lines.length && q.t === 'cmp') lines.push('<p>Cross multiply or use a common denominator. The sign is ' + esc(q._ans) + '.</p>');
  if (q.t === 'line' || q.t === 'shade') lines.push('<p>The answer is ' + rich(q._ans.tok()) + '.</p>');
  return lines.join('');
}
function fbBox(kind, title, body, mood){ $('#fb').innerHTML = '<div class="fb ' + kind + '"><div class="mascot">' + mascot(mood, 52) + '</div><div><h4>' + title + '</h4>' + body + '</div></div>'; }
function updateHintBtn(q){ const hs = hintsFor(q); const left = hs.length - RUN.cur.hints; const b = $('#hint'); if (!b) return; b.disabled = left <= 0 || RUN.cur.done; b.innerHTML = ICON.bulb + (left > 0 ? 'Hint (' + left + ')' : 'No more hints'); }
function doHint(q){
  const C = RUN.cur; const hs = hintsFor(q); if (C.hints >= hs.length || C.done) return; C.hints++; RUN.hintsTotal++;
  fbBox('hint', 'Hint ' + C.hints, '<ol>' + hs.slice(0, C.hints).map(h => '<li>' + rich(h) + '</li>').join('') + '</ol>', 'think');
  updateHintBtn(q); if (C.hints >= hs.length) $('#show').hidden = false;
}
const MAX_TRIES = q => (q.t === 'yn' || q.t === 'cmp') ? 1 : q.t === 'mcq' ? 2 : 3;
function doCheck(q){
  const C = RUN.cur; if (C.done) return;
  const r = evaluateAnswer(q);
  if (r.status === 'invalid') { fbBox('mid', 'Almost ready', '<p>' + rich(r.msg) + '</p>', 'think'); return; }
  if (r.status === 'unsimplified' || r.status === 'wrongform') { C.nudged = true; fbBox('mid', r.status === 'unsimplified' ? 'Right value! One more step' : 'Right value, wrong form', '<p>' + rich(r.msg) + '</p>', 'wow'); beep('good'); return; }
  if (r.status === 'correct') {
    const perfect = C.tries === 0 && C.hints === 0 && !C.nudged; C.done = true; RUN.streak++;
    const xp = perfect ? 10 : 5; const bonus = RUN.streak >= 3 ? 2 : 0; S.xp += xp + bonus;
    if (perfect && q.t === 'frac' && q._ans && !q._ans.isInt() && q.form !== 'exact') { S.simpl = (S.simpl || 0) + 1; if (S.simpl >= 20) award('simpl'); }
    award('first'); if (RUN.streak >= 10) award('streak10');
    const praise = perfect ? R.pick(['Brilliant!', 'Spot on!', 'Nailed it!', 'Super!', 'Yes! First try!']) : R.pick(['You got there!', 'Correct!', 'Well fixed!']);
    fbBox('good', praise + ' <span class="muted" style="font-size:14px">+' + (xp + bonus) + ' XP</span>', (r.tip ? '<p>' + rich(r.tip) + '</p>' : '') + (q.why || (q.sol && RUN.L > 1) ? '<details><summary style="cursor:pointer;font-weight:800">See why</summary>' + solutionHtml(q) + '</details>' : ''), 'happy');
    beep('good'); if (perfect && RUN.streak % 5 === 0) confetti(60);
    if (q.t === 'mcq' || q.t === 'yn') markOpts(q);
    return endQ(q, perfect ? 1 : 0.5);
  }
  // wrong
  C.tries++; RUN.streak = 0; beep('bad');
  if (C.tries >= MAX_TRIES(q)) return reveal(q, false, r.msg);
  const left = MAX_TRIES(q) - C.tries;
  fbBox('bad', 'Not quite', '<p>' + rich(r.msg || R.pick(['Check your working and try again.', 'Have another go. What does the question really ask?', 'Close? Check each step.'])) + '</p><p class="note">' + left + ' more ' + (left === 1 ? 'try' : 'tries') + '. A hint might help.</p>', 'think');
  if (q.t === 'mcq') { const b = $('.opt.sel'); if (b) { b.classList.add('wrong'); b.disabled = true; } C.pick = null; }
}
function markOpts(q){ $$('.opt').forEach(b => { const i = +b.dataset.i; const right = q.t === 'yn' ? (i === 1) === q.a : i === q.a; if (right) b.classList.add('right'); else if (b.classList.contains('sel')) b.classList.add('wrong'); }); }
function reveal(q, gaveUp, msg){
  const C = RUN.cur; if (C.done) return; C.done = true; RUN.streak = 0;
  if (q.t === 'mcq' || q.t === 'yn') markOpts(q);
  if (q.t === 'cmp') $('#slot').textContent = q._ans;
  if (q.t === 'line') { $('#fig').innerHTML = numberLine(q.max, q.den, q._ans.mul(q.den).n, false); }
  if (q.t === 'shade') { const tot = q.fig.k === 'pie' ? q.fig.n : q.fig.r * q.fig.c; const k = q._ans.mul(tot).n; $('#fig').innerHTML = svgFig(q.fig, { sel:new Set([...Array(k).keys()]) }); }
  fbBox('bad', gaveUp ? 'Here is how it works' : 'Let\'s see how it works', (msg ? '<p>' + rich(msg) + '</p>' : '') + '<p><b>Answer:</b> ' + rich(q._ans && q._ans.tok ? q._ans.tok() : q.t === 'mcq' ? q.opts[q.a] : q.t === 'yn' ? (q.a ? 'Yes' : 'No') : q.t === 'cmp' ? esc(q._ans) : q.t === 'order' ? q._ans.map(s => '{' + s + '}').join(', ') : 'see below') + '</p>' + solutionHtml(q) + '<p class="note">This one will come back later so you can try it again.</p>', 'sad');
  endQ(q, 0);
}
function endQ(q, ok){
  const C = RUN.cur; const ms = Date.now() - C.t0;
  RUN.results[RUN.i] = { ok, hints:C.hints, tries:C.tries };
  // stats
  const t = today(); t.att++; if (ok > 0) t.cor++; if (ok === 1) t.first++; t.hints += C.hints; touchSession(t); const ss = t.sessions[t.sessions.length - 1]; ss.att++; if (ok > 0) ss.cor++;
  const wk = q.review || RUN.w || 0; t.worlds[wk] = t.worlds[wk] || { att:0, cor:0 }; t.worlds[wk].att++; if (ok > 0) t.worlds[wk].cor++;
  const sk = q.sk || 'other'; t.skills[sk] = t.skills[sk] || { att:0, cor:0 }; t.skills[sk].att++; if (ok > 0) t.skills[sk].cor++;
  S.skills[sk] = S.skills[sk] || { a:0, c:0 }; S.skills[sk].a++; if (ok === 1) S.skills[sk].c++; else if (ok > 0) S.skills[sk].c += 0.5;
  t.attempts.push({ t:Date.now(), w:wk, l:RUN.L, id:q.id, sk, ok, h:C.hints, n:C.tries, nu:C.nudged ? 1 : 0, ms, g:String(C.given).slice(0, 60), x:String(expectedText(q)).slice(0, 60), q:plain(q.q).slice(0, 140), bk:q.gen ? 0 : 1 });
  if (t.attempts.length > 600) t.attempts.splice(0, t.attempts.length - 600);
  if (ok === 0 && q.gen) { S.retry = S.retry || []; const spec = {}; Object.keys(q).forEach(k => { if (k[0] !== '_' && !['sol','id','retried','again','review'].includes(k)) spec[k] = q[k]; }); spec.t = q.t; if (q.retried) S.retry = S.retry.filter(r => r !== q.retried); S.retry.push({ w: q.review || RUN.w || 1, spec }); if (S.retry.length > 30) S.retry.shift(); }
  if (ok > 0 && q.retried) { S.retry = (S.retry || []).filter(r => r !== q.retried); }
  if (!q.gen && RUN.w) { const seen = W(RUN.w).L1.seen; if (ok > 0 || seen[q.id] !== 1) seen[q.id] = ok > 0 ? 1 : 0; }
  LOG_DIRTY = true; saveLocal(true); scheduleLogSync();
  $('#check').hidden = true; $('#hint').disabled = true; $('#show').hidden = true; $('#next').hidden = false; $('#next').textContent = RUN.i === RUN.qs.length - 1 ? 'See results' : 'Next'; $('#next').focus();
  $$('.card input').forEach(i => i.disabled = true);
  $$('.dots i')[RUN.i].className = ok === 1 ? 'ok' : ok > 0 ? 'half' : 'no';
}
function nextQ(){ if (RUN.i >= RUN.qs.length - 1) return finishRound(false); RUN.i++; newQ(); renderPlay($('#app')); }
function finishRound(early){
  const score = RUN.results.reduce((a, r) => a + (r ? r.ok : 0), 0); const n = RUN.results.filter(Boolean).length;
  const t = today(); t.rounds++; t.xp = (t.xp || 0) + (S.xp - RUN.xpStart);
  if (!early && RUN.w) { const lv = W(RUN.w)['L' + RUN.L]; lv.rounds++; if (score > lv.best) lv.best = score;
    if (score >= 7 && RUN.L === 3) { award('twist'); if (RUN.w === 12) award('crown'); }
    if (RUN.L === 1 && bookFor(RUN.w).every(q => W(RUN.w).L1.seen[q.id] === 1)) award('book');
    if ([...Array(11)].filter((_, i) => W(i + 1).L2.best >= 7).length >= 3) award('hopper'); }
  if (!early && RUN.hintsTotal === 0 && n === 10) award('nohint');
  if (!early && RUN.results.every(r => r && r.ok === 1)) award('perfect');
  const goalDays = Object.values(S.days).filter(d => d.ms >= S.settings.goalMin * 60000).length; if (goalDays >= 3) award('goal3');
  RUN.score = score; RUN.answered = n; RUN.early = early; LOG_DIRTY = true; saveLocal(true); scheduleLogSync(true); scheduleProgressSync(true);
  maybeTelegramRound();
  go('results');
}
function renderResults(app){
  const s = RUN.score, n = RUN.answered; const st = RUN.w ? starsFor(s) : 0; const pass = s >= 7;
  const firstTry = RUN.results.filter(r => r && r.ok === 1).length;
  let html = '<div class="res"><div class="mascot">' + mascot(pass || !RUN.w ? 'wow' : 'think', 96) + '</div><h2 style="font-size:30px;margin:6px 0">' + (RUN.early ? 'Saved your progress' : pass ? R.pick(['Level passed!', 'Island conquered!', 'Fantastic round!']) : 'Good practice!') + '</h2>'
    + (RUN.w && !RUN.early ? '<div class="bigstars">' + starsHtml(st) + '</div>' : '')
    + '<div class="statrow"><div class="stat"><b class="tnum">' + (Math.round(s * 10) / 10) + '/' + n + '</b><span>Score</span></div><div class="stat"><b class="tnum">' + firstTry + '</b><span>First try</span></div><div class="stat"><b class="tnum">+' + (S.xp - RUN.xpStart) + '</b><span>XP</span></div></div>';
  if (RUN.newBadges.length) html += '<div><p style="font-weight:800">New badge' + (RUN.newBadges.length > 1 ? 's' : '') + '!</p>' + RUN.newBadges.map(b => '<span class="badge">' + ICON.star(true) + BADGES[b][0] + '</span>').join('') + '</div>';
  if (RUN.w && !pass && !RUN.early) html += '<p class="muted">You need 7 points to pass. Questions you got wrong come back, so each round gets easier.</p>';
  html += '<div class="actions" style="justify-content:center;margin-top:16px"><button class="btn ghost" id="home">Back to map</button>' + (RUN.w || RUN.w === 0 ? '<button class="btn coral" id="again">' + (pass && RUN.w && RUN.L < 3 && levelUnlocked(RUN.w, RUN.L + 1) ? 'Next level' : 'Play again') + '</button>' : '') + '</div></div>';
  app.innerHTML = html;
  if (pass && !RUN.early) { confetti(120); beep('win'); }
  $('#home').onclick = () => go('home');
  const ag = $('#again'); if (ag) ag.onclick = () => { if (pass && RUN.w && RUN.L < 3 && levelUnlocked(RUN.w, RUN.L + 1)) startRound(RUN.w, RUN.L + 1); else startRound(RUN.w, RUN.L); };
}

// ---------------- Telegram (works when the file is opened locally) ----------------
async function tgSend(text){
  const { tgToken, tgChat } = S.settings; if (!tgToken || !tgChat) return false;
  try { const r = await fetch('https://api.telegram.org/bot' + encodeURIComponent(tgToken).replace(/%3A/g, ':') + '/sendMessage', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ chat_id:tgChat, text, parse_mode:'HTML' }) }); return r.ok; } catch (_) { return false; }
}
function maybeTelegramRound(){
  if (!S.settings.tgToken) return; const t = today(); const s = RUN.score, n = RUN.answered;
  tgSend('<b>' + esc(S.player.name) + ' finished a round</b>\n' + esc(levelLabel()) + '\nScore ' + (Math.round(s * 10) / 10) + '/' + n + ' · first try ' + RUN.results.filter(r => r && r.ok === 1).length + ' · hints ' + RUN.hintsTotal + '\nToday so far: ' + t.att + ' questions, ' + (t.att ? Math.round(100 * t.cor / t.att) : 0) + '% correct, ' + mins(t.ms) + ' active min.');
}
async function maybeTelegramDaily(){
  if (!S.settings.tgToken) return; const y = dayKey(Date.now() - 86400000); if (S.settings.tgLastDaily === y) return; const d = S.days[y];
  const msg = d && d.att ? dailyText(d) : '<b>' + esc(S.player.name) + '</b> did not practise fractions on ' + y + '.';
  if (await tgSend(msg)) { S.settings.tgLastDaily = y; saveLocal(true); }
}
function dailyText(d){
  const weak = Object.entries(d.skills || {}).filter(([, v]) => v.att >= 3).sort((a, b) => a[1].cor / a[1].att - b[1].cor / b[1].att).slice(0, 2).map(([k, v]) => SKILLNAME[k] + ' ' + Math.round(100 * v.cor / v.att) + '%');
  return '<b>Fraction Quest daily report for ' + esc(S.player.name) + ' (' + d.date + ')</b>\nActive time: ' + mins(d.ms) + ' min\nQuestions: ' + d.att + ' (' + Math.round(100 * d.cor / d.att) + '% correct, ' + d.first + ' first try)\nHints used: ' + d.hints + (weak.length ? '\nNeeds work: ' + weak.join(', ') : '');
}

// ---------------- Parent area ----------------
const SKILLNAME = { meaning:'Meaning of a fraction', collection:'Fraction of a collection', numline:'Number line', proper:'Proper and improper', mixed:'Mixed fractions', equiv:'Equivalent fractions', simplest:'Simplest form', compare:'Comparing', order:'Ordering', addlike:'Adding like fractions', addunlike:'Adding unlike fractions', sub:'Subtraction', mulwhole:'Fraction × whole number', mulfrac:'Fraction × fraction', div:'Division', bodmas:'BODMAS', word:'Word problems', other:'Other' };
function parentGate(){
  const m = document.createElement('div'); m.className = 'modal'; const hasPin = !!S.settings.pin;
  m.innerHTML = '<div class="sheet" style="max-width:380px"><h2>Parent area</h2><p class="muted">' + (hasPin ? 'Enter your 4 digit PIN.' : 'Create a 4 digit PIN so only you can open the reports.') + '</p><div class="field"><label for="pin">PIN</label><input id="pin" inputmode="numeric" maxlength="4" type="password" autocomplete="off"></div><p id="pinerr" class="note"></p><div class="ctrl"><button class="btn ghost" id="pc">Cancel</button><button class="btn" id="po">' + (hasPin ? 'Open' : 'Save PIN') + '</button></div></div>';
  document.body.appendChild(m); const inp = $('#pin', m); setTimeout(() => inp.focus(), 50);
  const ok = () => { const v = inp.value.trim(); if (!/^\d{4}$/.test(v)) { $('#pinerr', m).textContent = 'Use exactly 4 digits.'; return; } if (!hasPin) { S.settings.pin = v; saveLocal(true); } else if (v !== S.settings.pin) { $('#pinerr', m).textContent = 'That PIN is not right.'; inp.value = ''; return; } m.remove(); go('parent', { tab:'report' }); };
  $('#po', m).onclick = ok; $('#pc', m).onclick = () => m.remove(); inp.addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
}
async function loadLogs(){
  const local = Object.values(S.days);
  if (!DB) return local;
  try { const qs = await DB.collection('log').orderBy('date', 'desc').limit(30).get(); const remote = qs.docs.map(d => d.data()); const map = {}; local.forEach(d => map[d.date] = d); remote.forEach(d => { if (!map[d.date] || (d.att || 0) > (map[d.date].att || 0)) map[d.date] = d; }); return Object.values(map); } catch (_) { return local; }
}
async function renderParent(app){
  app.innerHTML = '<p class="muted">Loading report…</p>';
  const logs = (await loadLogs()).sort((a, b) => a.date < b.date ? 1 : -1);
  const tk = dayKey(); const t = logs.find(d => d.date === tk) || { att:0, cor:0, first:0, hints:0, ms:0, sessions:[], attempts:[], skills:{}, worlds:{} };
  const pct = (a, b) => b ? Math.round(100 * a / b) + '%' : '–';
  let html = '<div class="dash"><div class="top"><button class="iconbtn" id="pback" aria-label="Back">' + ICON.back + '</button><div class="brand"><div><h1>Parent report</h1><small>' + esc(S.player.name) + ' · ' + (SYNC.mode === 'cloud' ? 'synced online' : MODE.kind === 'demo' ? 'demo, this browser only' : 'saved on this device only') + '</small></div></div><button class="btn ghost small" id="tabR">Report</button><button class="btn ghost small" id="tabS">Settings</button></div>';
  if (VIEW.tab === 'settings') { app.innerHTML = html + settingsHtml() + '</div>'; wireParent(); wireSettings(); return; }
  const last = logs.find(d => d.att > 0); const lastAt = last && last.attempts && last.attempts.length ? last.attempts[last.attempts.length - 1].t : null;
  html += '<div class="tiles"><div class="tile"><span>Active today</span><b>' + mins(t.ms) + ' min</b><small>Goal ' + S.settings.goalMin + ' min</small></div><div class="tile"><span>Questions today</span><b>' + t.att + '</b><small>' + t.first + ' right on first try</small></div><div class="tile"><span>Accuracy today</span><b>' + pct(t.cor, t.att) + '</b><small>' + t.hints + ' hints used</small></div><div class="tile"><span>Last practice</span><b style="font-size:20px">' + (lastAt ? (dayKey(lastAt) === tk ? 'Today ' : last.date.slice(5) + ' ') + fmtTime(lastAt) : 'Never') + '</b><small>Day streak ' + dayStreak() + '</small></div></div>';
  // 14 day bars
  const days = [...Array(14)].map((_, i) => dayKey(Date.now() - (13 - i) * 86400000)); const by = {}; logs.forEach(d => by[d.date] = d); const maxMin = Math.max(S.settings.goalMin, ...days.map(k => by[k] ? mins(by[k].ms) : 0));
  html += '<div class="panel"><h3>Last 14 days</h3><div class="bars">' + days.map(k => { const d = by[k]; const m = d ? mins(d.ms) : 0; return '<div class="col" title="' + k + ': ' + m + ' min, ' + (d ? d.att : 0) + ' questions, ' + (d ? pct(d.cor, d.att) : '–') + ' correct"><span class="lbl tnum">' + (m || '') + '</span><div class="bar' + (m ? '' : ' zero') + '" style="height:' + (m ? Math.max(4, 100 * m / maxMin) : 0) + '%"></div></div>'; }).join('') + '</div><div style="display:flex;gap:6px">' + days.map(k => '<div class="bars lbl" style="flex:1;text-align:center;height:auto;border:none;font-size:10px;color:var(--ink2)">' + k.slice(8) + '</div>').join('') + '</div><p class="note">Bars show active minutes. Hover a bar for questions and accuracy.</p></div>';
  // daily table
  html += '<div class="panel"><h3>Day by day</h3><div class="scroll"><table class="tbl tnum"><thead><tr><th>Date</th><th>Minutes</th><th>Questions</th><th>Correct</th><th>First try</th><th>Hints</th><th>Sessions</th></tr></thead><tbody>' + logs.filter(d => d.att || d.ms).slice(0, 14).map(d => '<tr><td>' + d.date + '</td><td>' + mins(d.ms) + '</td><td>' + d.att + '</td><td>' + pct(d.cor, d.att) + '</td><td>' + pct(d.first, d.att) + '</td><td>' + d.hints + '</td><td>' + (d.sessions || []).map(s => fmtTime(s.s) + '–' + fmtTime(s.e)).join(', ') + '</td></tr>').join('') + '</tbody></table></div></div>';
  // islands
  html += '<div class="panel"><h3>Islands</h3><div class="scroll"><table class="tbl"><thead><tr><th>Island</th><th>Textbook solved</th><th>Warm-up</th><th>Explorer</th><th>Twist</th></tr></thead><tbody>';
  for (let w = 1; w <= 12; w++) { const ws = W(w); const bn = bookFor(w).length; const sv = Object.values(ws.L1.seen).filter(v => v === 1).length; const cell = L => ws['L' + L].rounds ? starsHtml(starsFor(ws['L' + L].best)) + ' <span class="note tnum">best ' + ws['L' + L].best + '</span>' : '<span class="note">not tried</span>'; html += '<tr><td><b>' + (w === 12 ? 'Revision' : WORLDS[w].ex) + '</b> ' + WORLDS[w].topic + '</td><td class="tnum">' + sv + ' / ' + bn + '</td><td>' + cell(1) + '</td><td>' + cell(2) + '</td><td>' + cell(3) + '</td></tr>'; }
  html += '</tbody></table></div></div>';
  // skills
  const sks = Object.entries(S.skills).filter(([, v]) => v.a > 0).sort((a, b) => a[1].c / a[1].a - b[1].c / b[1].a);
  html += '<div class="panel"><h3>Skills, weakest first</h3>' + (sks.length ? '<div class="scroll"><table class="tbl tnum"><thead><tr><th>Skill</th><th>Attempts</th><th>Score</th><th></th></tr></thead><tbody>' + sks.map(([k, v]) => { const p = Math.round(100 * v.c / v.a); return '<tr><td>' + (SKILLNAME[k] || k) + '</td><td>' + v.a + '</td><td><span class="pill ' + (p >= 80 ? 'g' : p >= 55 ? 'm' : 'b') + '">' + p + '%</span></td><td style="width:40%"><div class="meter"><i style="width:' + p + '%"></i></div></td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="note">No questions answered yet.</p>') + '<p class="note">Score counts a first-try answer as 1 and an answer fixed after a hint or retry as half.</p></div>';
  // mistakes
  const mistakes = logs.flatMap(d => d.attempts || []).filter(a => a.ok < 1).sort((a, b) => b.t - a.t).slice(0, 30);
  html += '<div class="panel"><h3>Recent mistakes and near misses</h3>' + (mistakes.length ? '<div class="scroll"><table class="tbl"><thead><tr><th>When</th><th>Question</th><th>Her answer</th><th>Correct</th><th>Result</th></tr></thead><tbody>' + mistakes.map(a => '<tr><td class="tnum">' + dayKey(a.t).slice(5) + ' ' + fmtTime(a.t) + '</td><td>' + esc(a.q) + (a.bk ? ' <span class="pill m">book</span>' : '') + '</td><td>' + esc(a.g || '–') + '</td><td>' + esc(a.x) + '</td><td>' + (a.ok > 0 ? '<span class="pill m">fixed' + (a.h ? ' with hint' : '') + (a.nu ? ', needed simplifying' : '') + '</span>' : '<span class="pill b">wrong</span>') + '</td></tr>').join('') + '</tbody></table></div>' : '<p class="note">No mistakes yet. Nice.</p>') + '</div>';
  // badges
  html += '<div class="panel"><h3>Badges</h3>' + (Object.keys(S.badges).length ? Object.keys(S.badges).map(b => '<span class="badge">' + ICON.star(true) + BADGES[b][0] + '</span>').join('') : '<p class="note">None yet.</p>') + '</div></div>';
  app.innerHTML = html; wireParent();
}
function wireParent(){ $('#pback').onclick = () => go('home'); $('#tabR').onclick = () => go('parent', { tab:'report' }); $('#tabS').onclick = () => go('parent', { tab:'settings' }); }
function settingsHtml(){
  const st = S.settings;
  return '<div class="panel"><h3>Daily goal</h3><div class="field"><label for="goal">Active minutes per day</label><input id="goal" type="number" min="10" max="180" value="' + st.goalMin + '"></div></div>'
    + '<div class="panel"><h3>PIN</h3><div class="field"><label for="npin">New 4 digit PIN</label><input id="npin" inputmode="numeric" maxlength="4" type="password" autocomplete="off"></div></div>'
    + '<div class="panel"><h3>Levels</h3><label style="display:flex;gap:8px;align-items:center;font-weight:700"><input type="checkbox" id="unl" ' + (st.unlockAll ? 'checked' : '') + '> Unlock every island and level</label><p class="note">Normally an island opens after Explorer on the island before it is passed.</p><label style="display:flex;gap:8px;align-items:center;font-weight:700;margin-top:8px"><input type="checkbox" id="snd" ' + (st.sound ? 'checked' : '') + '> Sound effects</label></div>'
    + (MODE.kind === 'web' ? '<div class="panel"><h3>Evening report</h3><p class="note">The server sends a report every evening between 8:30 and 9:30 PM.' + (MODE.health ? ' Email: ' + (MODE.health.email ? 'on' : 'not set up') + '. Telegram: ' + (MODE.health.telegram ? 'on' : 'not set up') + '.' : '') + '</p><button class="btn ghost small" id="reptest">Send today\'s report now</button><pre id="repres" class="note" style="white-space:pre-wrap;margin-top:10px"></pre><p class="note">On a shared device, you can make it forget the family code: <button class="btn ghost small" id="forget">Forget family code</button></p></div>' : '')
    + (MODE.kind !== 'file' ? '' : '<div class="panel"><h3>Telegram alerts</h3><p class="note">Works when the game is opened as a file on this computer. Inside Claude, use the daily email instead. Create a bot with @BotFather, paste its token, then send your bot any message and paste your chat id (from @userinfobot).</p><div class="field"><label for="tgt">Bot token</label><input id="tgt" value="' + esc(st.tgToken) + '" autocomplete="off"></div><div class="field"><label for="tgc">Chat id</label><input id="tgc" value="' + esc(st.tgChat) + '" autocomplete="off"></div><button class="btn ghost small" id="tgtest">Send a test message</button> <span id="tgres" class="note"></span></div>')
    + '<div class="panel"><h3>Reset</h3><p class="note">Type RESET and press the button to wipe all progress on this device' + (DB ? ' and in the cloud' : '') + '.</p><div class="field"><input id="rst" placeholder="RESET" autocomplete="off"></div><button class="btn ghost small" id="rstb">Wipe progress</button></div>'
    + '<div class="ctrl"><span class="note">Sync: ' + SYNC.mode + (SYNC.last ? ', last saved ' + fmtTime(SYNC.last) : '') + (SYNC.err ? ', last error ' + esc(SYNC.err) : '') + '</span><button class="btn" id="ssave">Save settings</button></div>';
}
function wireSettings(){
  $('#ssave').onclick = () => { const st = S.settings; const g = +$('#goal').value; if (g >= 10 && g <= 180) st.goalMin = g; const np = $('#npin').value.trim(); if (np) { if (!/^\d{4}$/.test(np)) return toast('PIN must be 4 digits'); st.pin = np; } st.unlockAll = $('#unl').checked; st.sound = $('#snd').checked; if ($('#tgt')) { st.tgToken = $('#tgt').value.trim(); st.tgChat = $('#tgc').value.trim(); } saveLocal(true); toast('Settings saved'); };
  const rt = $('#reptest'); if (rt) rt.onclick = async () => { $('#repres').textContent = 'Sending…'; try { const j = await DB.call('POST', '/api/report?test=1&date=' + dayKey(), {}); $('#repres').textContent = (j.sent.email || j.sent.telegram ? 'Sent by ' + [j.sent.email && 'email', j.sent.telegram && 'Telegram'].filter(Boolean).join(' and ') + '.' : (j.note || 'Not sent: ' + (j.errors || []).join(', '))) + '\n\n' + j.text; } catch (e) { $('#repres').textContent = 'Could not send: ' + (e.message || e.code); } };
  const fg = $('#forget'); if (fg) fg.onclick = () => { lsSet('fq.familyCode', null); location.reload(); };
  const tt = $('#tgtest'); if (tt) tt.onclick = async () => { S.settings.tgToken = $('#tgt').value.trim(); S.settings.tgChat = $('#tgc').value.trim(); saveLocal(); const ok = await tgSend('Fraction Quest is connected. You will get round updates for ' + S.player.name + '.'); $('#tgres').textContent = ok ? 'Sent. Check Telegram.' : 'Could not send. Check the token and chat id, and open the game as a local file.'; };
  $('#rstb').onclick = async () => { if ($('#rst').value !== 'RESET') return toast('Type RESET first'); const keep = S.settings; S = DEFAULT_STATE(); S.settings = keep; PLAYER = S.player; saveLocal(true); if (DB) { try { await DB.doc('progress/main').set(progressDoc()); } catch (_) {} } toast('Progress wiped'); go('home'); };
}

// ---------------- Boot ----------------
(async () => {
  await detectMode();
  loadLocal();
  if (MODE.kind === 'web' && !familyCode()) return renderGate($('#app'));
  if (MODE.kind === 'web' || (!S.player.name && MODE.kind === 'artifact')) { await Promise.race([initDb(), new Promise(r => setTimeout(r, 5000))]); if (SYNC.err === 'unauthorized') { lsSet('fq.familyCode', null); return renderGate($('#app'), 'That family code no longer works. Enter it again.'); } route(); }
  else { route(); initDb(); }
})();

function renderGate(app, msg){
  app.innerHTML = '<div class="play" style="max-width:520px;margin-top:6vh"><div class="card" style="text-align:center"><div class="mascot">' + mascot('wow', 96) + '</div><h1 style="font-size:32px;margin:8px 0">Fraction Quest</h1>'
    + '<p class="muted">A fractions practice game for Class 6. Twelve islands, one for each part of the chapter: textbook warm-ups, fresh questions, and twists that make you think.</p>'
    + '<div class="field" style="text-align:left"><label for="fcode">Family code</label><input id="fcode" type="password" autocomplete="current-password" placeholder="Enter your family code"></div><p class="note" id="gerr" style="min-height:1.2em">' + esc(msg || '') + '</p>'
    + '<button class="btn coral" id="genter" style="width:100%">Enter</button>'
    + '<div style="margin:18px 0 6px;color:var(--ink2);font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.8px">or</div>'
    + '<button class="btn ghost" id="gdemo" style="width:100%">Try the demo</button><p class="note" style="margin-top:10px">The demo works fully, with progress kept only in your browser.</p></div>'
    + '<p class="note" style="text-align:center;margin-top:14px">Built by <a href="https://suniljadhav.in" target="_blank" rel="noopener" style="color:inherit">Sunil Jadhav</a> with Claude.</p></div>';
  const enter = async () => {
    const code = $('#fcode').value.trim(); if (!code) return $('#fcode').focus();
    $('#gerr').textContent = 'Checking…'; lsSet('fq.familyCode', code);
    try { await remoteDb().doc('progress/main').get(); location.reload(); }
    catch (e) { lsSet('fq.familyCode', null); $('#gerr').textContent = e.code === 'unauthorized' ? 'That code is not right. Check with your parent.' : e.code === 'resource_exhausted' ? 'Too many wrong tries. Wait an hour and try again.' : 'Could not reach the server. Check the internet connection.'; }
  };
  $('#genter').onclick = enter; $('#fcode').addEventListener('keydown', e => { if (e.key === 'Enter') enter(); });
  $('#gdemo').onclick = () => { ssSet('fq.demo', '1'); location.reload(); };
}
setTimeout(() => { if (MODE.kind === 'file') maybeTelegramDaily(); }, 4000);
