// Builds the evening report for the parent and sends it by email (Resend) and/or Telegram.
const SKILL = { meaning: 'Meaning of a fraction', collection: 'Fraction of a collection', numline: 'Number line', proper: 'Proper and improper', mixed: 'Mixed fractions', equiv: 'Equivalent fractions', simplest: 'Simplest form', compare: 'Comparing', order: 'Ordering', addlike: 'Adding like fractions', addunlike: 'Adding unlike fractions', sub: 'Subtraction', mulwhole: 'Fraction × whole number', mulfrac: 'Fraction × fraction', div: 'Division', bodmas: 'BODMAS', word: 'Word problems', other: 'Other' };
const ISLAND = { 0: 'Daily Mix', 1: 'Ex 5.1 Meaning', 2: 'Ex 5.2 Number line', 3: 'Ex 5.3 Proper and improper', 4: 'Ex 5.4 Mixed fractions', 5: 'Ex 5.5 Equivalent', 6: 'Ex 5.6 Simplest form', 7: 'Ex 5.7 Comparing', 8: 'Ex 5.8 Adding and subtracting', 9: 'Ex 5.9 Multiplying', 10: 'Ex 5.10 Dividing', 11: 'Ex 5.11 BODMAS', 12: 'Revision' };
const LEVEL = { 0: 'Daily Mix', 1: 'Warm-up', 2: 'Explorer', 3: 'Twist' };

const IST_OFFSET = 330 * 60000;
const istDate = (t = Date.now()) => new Date(t + IST_OFFSET).toISOString().slice(0, 10);
const istTime = t => new Date(t + IST_OFFSET).toISOString().slice(11, 16);
const pct = (a, b) => (b ? Math.round((100 * a) / b) + '%' : 'n/a');
const mins = ms => Math.round((ms || 0) / 60000);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function lastDays(date, n) { const out = []; const base = Date.parse(date + 'T00:00:00Z'); for (let i = n - 1; i >= 0; i--) out.push(new Date(base - i * 86400000).toISOString().slice(0, 10)); return out; }

function buildReport({ date, day, history = [], progress = {} }) {
  const name = (progress && progress.player && progress.player.name) || 'Your child';
  const byDate = {}; history.forEach(d => { if (d && d.date) byDate[d.date] = d; }); if (day) byDate[date] = day;
  const trend = lastDays(date, 7).map(d => ({ d, m: byDate[d] ? mins(byDate[d].ms) : 0, q: byDate[d] ? byDate[d].att : 0 }));
  const trendLine = trend.map(t => t.d.slice(5) + ' ' + t.m + 'm').join(', ');
  const practised = !!(day && day.att > 0);
  const subject = 'Fraction Quest: ' + name + ' on ' + date + ' (' + (practised ? 'practised' : 'no practice') + ')';

  if (!practised) {
    const text = 'No practice was recorded for ' + name + ' on ' + date + '.\n\nLast 7 days (minutes): ' + trendLine + '\n';
    const html = '<p>No practice was recorded for <b>' + esc(name) + '</b> on ' + date + '.</p>' + trendHtml(trend);
    return { subject, text, html, practised };
  }

  const att = day.attempts || [];
  const sessions = (day.sessions || []).filter(s => s.att > 0).map(s => istTime(s.s) + ' to ' + istTime(s.e));
  const islands = {};
  att.forEach(a => { const k = (ISLAND[a.w] || 'Island ' + a.w) + ' · ' + (LEVEL[a.l] || ''); islands[k] = islands[k] || { n: 0, ok: 0 }; islands[k].n++; if (a.ok > 0) islands[k].ok++; });
  const islandLines = Object.entries(islands).sort((a, b) => b[1].n - a[1].n).map(([k, v]) => k + ': ' + v.n + ' questions, ' + pct(v.ok, v.n) + ' correct');
  const weak = Object.entries(day.skills || {}).filter(([, v]) => v.att >= 3).sort((a, b) => a[1].cor / a[1].att - b[1].cor / b[1].att).slice(0, 3);
  const weakLines = weak.filter(([, v]) => v.cor / v.att < 0.85).map(([k, v]) => (SKILL[k] || k) + ' (' + pct(v.cor, v.att) + ' of ' + v.att + ')');
  const mistakes = att.filter(a => a.ok === 0).slice(-5);
  const simplifyNudges = att.filter(a => a.nu).length;
  const hinted = att.filter(a => a.h > 0).length;

  const suggestion = weak.length && weak[0][1].cor / weak[0][1].att < 0.85
    ? 'Tomorrow, start with the Learn card for ' + (SKILL[weak[0][0]] || weak[0][0]) + ', then play that island\'s Twist level.'
    : simplifyNudges >= 3 ? 'She often stopped before simplifying. Ask her to say the HCF out loud before typing an answer.'
    : 'A steady day. Tomorrow, try the next island or a Daily Mix to revise older topics.';

  const lines = [
    name + ' practised fractions on ' + date + '.', '',
    'Active time: ' + mins(day.ms) + ' min',
    'Answered: ' + day.att + ' questions, ' + pct(day.cor, day.att) + ' correct, ' + pct(day.first, day.att) + ' right on the first try',
    'Hints used: ' + day.hints + (hinted ? ' (on ' + hinted + ' questions)' : ''),
    'Sessions (IST): ' + (sessions.join(', ') || 'n/a'), '',
    'Where she played:', ...islandLines.map(l => '  ' + l), '',
    'Weakest skills today: ' + (weakLines.join(', ') || 'none stood out'),
    simplifyNudges ? 'She needed a reminder to simplify ' + simplifyNudges + ' time' + (simplifyNudges > 1 ? 's' : '') + '.' : 'She simplified her answers without reminders.', '',
  ];
  if (mistakes.length) { lines.push('Mistakes to talk about:'); mistakes.forEach(m => lines.push('  ' + m.q + '  Her answer: ' + (m.g || 'blank') + '. Correct: ' + m.x + '.')); lines.push(''); }
  lines.push('Last 7 days (minutes): ' + trendLine, '', 'Suggestion: ' + suggestion);
  const text = lines.join('\n') + '\n';

  const tile = (label, value) => '<td style="padding:10px 14px;border:1px solid #CFE3DE;border-radius:10px"><div style="font-size:12px;color:#5B5272;text-transform:uppercase">' + label + '</div><div style="font-size:22px;font-weight:700">' + value + '</div></td>';
  const html = '<div style="font-family:Segoe UI,Arial,sans-serif;color:#2A2140;max-width:620px">'
    + '<h2 style="margin:0 0 8px">' + esc(name) + ' practised fractions on ' + date + '</h2>'
    + '<table style="border-collapse:separate;border-spacing:6px"><tr>' + tile('Active', mins(day.ms) + ' min') + tile('Questions', day.att) + tile('Correct', pct(day.cor, day.att)) + tile('First try', pct(day.first, day.att)) + '</tr></table>'
    + '<p>Hints used: ' + day.hints + '. Sessions (IST): ' + esc(sessions.join(', ') || 'n/a') + '.</p>'
    + '<h3>Where she played</h3><ul>' + islandLines.map(l => '<li>' + esc(l) + '</li>').join('') + '</ul>'
    + '<p><b>Weakest skills today:</b> ' + esc(weakLines.join(', ') || 'none stood out') + '<br>' + esc(simplifyNudges ? 'She needed a reminder to simplify ' + simplifyNudges + ' time' + (simplifyNudges > 1 ? 's' : '') + '.' : 'She simplified her answers without reminders.') + '</p>'
    + (mistakes.length ? '<h3>Mistakes to talk about</h3><table style="border-collapse:collapse;font-size:14px"><tr><th align="left" style="padding:4px 8px">Question</th><th align="left" style="padding:4px 8px">Her answer</th><th align="left" style="padding:4px 8px">Correct</th></tr>' + mistakes.map(m => '<tr><td style="padding:4px 8px;border-top:1px solid #CFE3DE">' + esc(m.q) + '</td><td style="padding:4px 8px;border-top:1px solid #CFE3DE">' + esc(m.g || 'blank') + '</td><td style="padding:4px 8px;border-top:1px solid #CFE3DE">' + esc(m.x) + '</td></tr>').join('') + '</table>' : '')
    + trendHtml(trend) + '<p><b>Suggestion:</b> ' + esc(suggestion) + '</p></div>';
  return { subject, text, html, practised };
}

function trendHtml(trend) {
  const max = Math.max(30, ...trend.map(t => t.m));
  return '<h3>Last 7 days</h3><table style="border-collapse:collapse"><tr>' + trend.map(t => '<td style="vertical-align:bottom;text-align:center;padding:0 4px;font-size:11px;color:#5B5272">' + t.m + '<div style="width:22px;height:' + Math.max(2, Math.round((60 * t.m) / max)) + 'px;background:' + (t.m ? '#1FAE9B' : '#CFE3DE') + ';border-radius:4px 4px 0 0;margin:2px auto 0"></div>' + t.d.slice(8) + '</td>').join('') + '</tr></table>';
}

async function deliver(rep) {
  const sent = { email: false, telegram: false }; const errors = [];
  if (process.env.RESEND_API_KEY && process.env.REPORT_EMAIL) {
    try {
      const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: process.env.REPORT_FROM || 'Fraction Quest <onboarding@resend.dev>', to: process.env.REPORT_EMAIL.split(',').map(s => s.trim()), subject: rep.subject, html: rep.html, text: rep.text }) });
      sent.email = r.ok; if (!r.ok) errors.push('email ' + r.status);
    } catch (e) { errors.push('email ' + e.message); }
  }
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    try {
      const body = '<b>' + esc(rep.subject) + '</b>\n\n' + esc(rep.text).slice(0, 3800);
      const r = await fetch('https://api.telegram.org/bot' + process.env.TELEGRAM_BOT_TOKEN + '/sendMessage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: body, parse_mode: 'HTML' }) });
      sent.telegram = r.ok; if (!r.ok) errors.push('telegram ' + r.status);
    } catch (e) { errors.push('telegram ' + e.message); }
  }
  return { sent, errors };
}

module.exports = { buildReport, deliver, istDate, istTime, lastDays };
