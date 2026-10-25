// Test helpers: a fake Upstash Redis REST server and a tiny req/res harness for Vercel-style handlers.
const http = require('http');

function startFakeUpstash(token = 'test-token') {
  const kv = new Map(); const z = new Map(); const calls = [];
  const exec = ([c, ...a]) => {
    c = String(c).toUpperCase(); calls.push([c, ...a]);
    if (c === 'GET') return kv.has(a[0]) ? kv.get(a[0]) : null;
    if (c === 'SET') { kv.set(a[0], String(a[1])); return 'OK'; }
    if (c === 'DEL') { const had = kv.delete(a[0]); return had ? 1 : 0; }
    if (c === 'MGET') return a.map(k => (kv.has(k) ? kv.get(k) : null));
    if (c === 'INCR') { const v = (+(kv.get(a[0]) || 0)) + 1; kv.set(a[0], String(v)); return v; }
    if (c === 'EXPIRE') return 1;
    if (c === 'ZADD') { const m = z.get(a[0]) || new Map(); m.set(String(a[2]), +a[1]); z.set(a[0], m); return 1; }
    if (c === 'ZREVRANGE') { const m = z.get(a[0]) || new Map(); const arr = [...m.entries()].sort((x, y) => y[1] - x[1]).map(e => e[0]); return arr.slice(+a[1], +a[2] + 1); }
    throw new Error('fake upstash: unsupported ' + c);
  };
  const server = http.createServer((req, res) => {
    let body = ''; req.on('data', d => (body += d)); req.on('end', () => {
      if (req.headers.authorization !== 'Bearer ' + token) { res.writeHead(401); return res.end('{"error":"unauthorized"}'); }
      const parsed = JSON.parse(body || 'null');
      res.setHeader('content-type', 'application/json');
      try {
        if (req.url === '/pipeline') return res.end(JSON.stringify(parsed.map(cmd => { try { return { result: exec(cmd) }; } catch (e) { return { error: e.message }; } })));
        return res.end(JSON.stringify({ result: exec(parsed) }));
      } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: e.message })); }
    });
  });
  return new Promise(r => server.listen(0, () => r({ url: 'http://127.0.0.1:' + server.address().port, token, kv, z, calls, close: () => server.close() })));
}

// Call a Vercel-style handler with a fake req/res.
async function call(handler, { method = 'GET', query = {}, headers = {}, body } = {}) {
  const req = { method, query, headers: Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])), body };
  let statusCode = 200, json, headersOut = {};
  const res = {
    status(c) { statusCode = c; return res; },
    json(o) { json = o; return res; },
    setHeader(k, v) { headersOut[k.toLowerCase()] = v; },
    end() { return res; },
  };
  await handler(req, res);
  return { status: statusCode, body: json, headers: headersOut };
}

function freshModules() {
  for (const k of Object.keys(require.cache)) if (k.includes('/fraction-quest/lib/') || k.includes('/fraction-quest/api/')) delete require.cache[k];
  global.__fqMem = undefined;
}

module.exports = { startFakeUpstash, call, freshModules };
