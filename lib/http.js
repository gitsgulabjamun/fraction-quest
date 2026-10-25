// Shared request helpers: family code check with brute force protection, JSON body parsing, error handling.
const crypto = require('crypto');
const { cmd, pipeline, K } = require('./store');

const MAX_FAILS = 20; // wrong codes per address per hour

function send(res, status, body) { res.setHeader('Cache-Control', 'no-store'); return res.status(status).json(body); }

function clientIp(req) { return String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'local').split(',')[0].trim(); }

function safeEqual(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest(), y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

// Returns true when the request carries the right family code. Otherwise it has already answered.
async function requireFamily(req, res) {
  const want = process.env.FAMILY_CODE;
  if (!want) { send(res, 503, { error: 'FAMILY_CODE is not set on the server.' }); return false; }
  const failKey = K.fail(clientIp(req));
  const fails = +((await cmd('GET', failKey)) || 0);
  if (fails >= MAX_FAILS) { send(res, 429, { error: 'Too many wrong codes. Try again in an hour.' }); return false; }
  if (!safeEqual(req.headers['x-family-code'] || '', want)) {
    await pipeline([['INCR', failKey], ['EXPIRE', failKey, 3600]]);
    send(res, 401, { error: 'Wrong family code.' }); return false;
  }
  return true;
}

function jsonBody(req) {
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (_) { return null; } }
  if (Buffer.isBuffer(b)) { try { b = JSON.parse(b.toString('utf8')); } catch (_) { return null; } }
  return b && typeof b === 'object' && !Array.isArray(b) ? b : null;
}

// Wrap a handler so storage and unexpected errors become clean JSON responses.
const handle = fn => async (req, res) => {
  try { return await fn(req, res); }
  catch (e) { return send(res, e.status || 500, { error: e.status ? e.message : 'Server error' }); }
};

module.exports = { send, requireFamily, jsonBody, handle, safeEqual };
