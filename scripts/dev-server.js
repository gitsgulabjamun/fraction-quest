// Local stand-in for Vercel: serves public/ and runs the api/ handlers with an in-memory store.
// Usage: FAMILY_CODE=test node scripts/dev-server.js [port]
const http = require('http'); const fs = require('fs'); const path = require('path'); const url = require('url');
const root = path.join(__dirname, '..');
const port = +process.argv[2] || 3000;
const server = http.createServer((req, res) => {
  const u = url.parse(req.url, true);
  res.status = c => { res.statusCode = c; return res; };
  res.json = o => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); return res; };
  if (u.pathname.startsWith('/api/')) {
    const name = u.pathname.slice(5).replace(/[^a-z]/g, '');
    const file = path.join(root, 'api', name + '.js');
    if (!fs.existsSync(file)) return res.status(404).json({ error: 'not found' });
    let body = ''; req.on('data', d => (body += d)); req.on('end', async () => {
      req.query = u.query; req.body = body;
      try { await require(file)(req, res); } catch (e) { res.status(500).json({ error: e.message }); }
    });
    return;
  }
  const f = path.join(root, 'public', u.pathname === '/' ? 'index.html' : path.normalize(u.pathname).replace(/^(\.\.[\/\\])+/, ''));
  fs.readFile(f, (err, data) => { if (err) { res.statusCode = 404; return res.end('not found'); } res.setHeader('Content-Type', f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream'); res.end(data); });
});
server.listen(port, () => console.log('dev server on http://localhost:' + port));
module.exports = server;
