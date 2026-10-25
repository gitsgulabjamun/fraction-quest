// Evening report. Vercel Cron calls this daily with "Authorization: Bearer $CRON_SECRET".
// The parent can also trigger it from the game's settings (family code) to test delivery.
const { getDoc, recentLogs } = require('../lib/store');
const { send, requireFamily, handle, safeEqual } = require('../lib/http');
const { buildReport, deliver, istDate } = require('../lib/report');

module.exports = handle(async (req, res) => {
  const auth = String(req.headers.authorization || '');
  const isCron = !!process.env.CRON_SECRET && safeEqual(auth, 'Bearer ' + process.env.CRON_SECRET);
  if (!isCron && !(await requireFamily(req, res))) return;

  const q = req.query || {};
  const date = /^\d{4}-\d{2}-\d{2}$/.test(q.date || '') ? q.date : istDate();
  const [day, history, progress] = await Promise.all([getDoc('log/' + date), recentLogs(14), getDoc('progress/main')]);
  const rep = buildReport({ date, day, history, progress: progress || {} });
  const { sent, errors } = await deliver(rep);
  const note = !sent.email && !sent.telegram && !errors.length ? 'No delivery channel is set. Add RESEND_API_KEY and REPORT_EMAIL, or TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID, in Vercel.' : undefined;
  return send(res, 200, { date, sent, errors, note, subject: rep.subject, text: rep.text });
});
