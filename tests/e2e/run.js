// Runs every browser test: web mode end to end, then the full game regression, figure and phone checks (file mode).
const { execFileSync } = require('child_process'); const path = require('path'); const fs = require('fs');
process.env.SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'fq-shots'); fs.mkdirSync(process.env.SHOTS, { recursive: true });
(async () => {
  let failed = false;
  console.log('== Web mode (local server + real API)');
  const res = await require('./web.e2e.js')(); res.forEach(r => console.log('  ' + r)); if (res.some(r => r.startsWith('FAIL'))) failed = true;
  const checks = [['playtest.js', /fails 0\b/, 'Every question on every level accepts its correct answer'], ['visualtest.js', /bad 0\b/, 'Every figure draws its shaded parts'], ['mobiletest.js', /overflow \[\]/, 'No sideways scrolling at phone width']];
  for (const [file, pass, label] of checks) {
    const out = execFileSync('node', [path.join(__dirname, file)], { encoding: 'utf8', timeout: 900000, env: process.env });
    const okRun = pass.test(out); if (!okRun) failed = true;
    console.log('== ' + label + ': ' + (okRun ? 'PASS' : 'FAIL')); console.log(out.split('\n').filter(l => /questions played|fails|figures checked|types tested|bad /.test(l)).map(l => '  ' + l).join('\n'));
  }
  console.log(failed ? '\nSOME TESTS FAILED' : '\nALL BROWSER TESTS PASSED'); process.exit(failed ? 1 : 0);
})();
