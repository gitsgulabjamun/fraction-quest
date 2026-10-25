// The most recent days of practice, newest first, for the parent report.
const { recentLogs } = require('../lib/store');
const { send, requireFamily, handle } = require('../lib/http');

module.exports = handle(async (req, res) => {
  if (!(await requireFamily(req, res))) return;
  const limit = Math.max(1, Math.min(60, parseInt((req.query && req.query.limit) || '30', 10) || 30));
  return send(res, 200, { logs: await recentLogs(limit) });
});
