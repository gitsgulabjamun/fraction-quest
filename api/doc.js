// Read or replace one saved document: "progress/main" (stars, XP, settings) or "log/YYYY-MM-DD" (one day of practice).
const { getDoc, setDoc, PATH_RE } = require('../lib/store');
const { send, requireFamily, jsonBody, handle } = require('../lib/http');

const MAX_BYTES = 900 * 1024;

module.exports = handle(async (req, res) => {
  if (!(await requireFamily(req, res))) return;
  const path = String((req.query && req.query.path) || '');
  if (!PATH_RE.test(path)) return send(res, 400, { error: 'Unknown path.' });

  if (req.method === 'GET') {
    const data = await getDoc(path);
    return send(res, 200, data ? { exists: true, data } : { exists: false });
  }
  if (req.method === 'PUT' || req.method === 'POST') {
    const body = jsonBody(req);
    if (!body) return send(res, 400, { error: 'Body must be a JSON object.' });
    if (JSON.stringify(body).length > MAX_BYTES) return send(res, 413, { error: 'Too large.' });
    await setDoc(path, body);
    return send(res, 200, { ok: true });
  }
  res.setHeader('Allow', 'GET, PUT');
  return send(res, 405, { error: 'Method not allowed.' });
});
