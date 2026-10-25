// Bundles src/ into one self-contained page: public/index.html (Vercel) and dist/artifact.html (Claude artifact body).
const fs = require('fs'); const path = require('path');
const root = path.join(__dirname, '..');
const shell = fs.readFileSync(path.join(root, 'src/shell.html'), 'utf8');
const js = ['engine.js', 'book.js', 'learn.js', 'gen.js', 'ui.js']
  .map(f => '// ---- ' + f + '\n' + fs.readFileSync(path.join(root, 'src', f), 'utf8').replace(/^if \(typeof module !== 'undefined'\).*$/m, ''))
  .join('\n');
const body = shell + '\n<script>\n"use strict";\n' + js + '\n</script>\n';
const head = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
  + '<meta name="description" content="Fraction Quest: a first-principles fractions practice game for Class 6, with textbook warm-ups, fresh questions, twists and a parent report.">'
  + '<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Ccircle cx=%2232%22 cy=%2233%22 r=%2228%22 fill=%22%23F2B45A%22/%3E%3Cpath d=%22M32 33 L32 9 A24 24 0 1 1 11.2 21 Z%22 fill=%22%23FF8FA8%22/%3E%3C/svg%3E">'
  + '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}[hidden]{display:none!important}img{max-width:100%}</style></head><body>';
fs.mkdirSync(path.join(root, 'public'), { recursive: true }); fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'public/index.html'), head + body + '</body></html>');
fs.writeFileSync(path.join(root, 'dist/artifact.html'), body);
new Function(js); // syntax check
console.log('built public/index.html', Math.round(body.length / 1024) + ' KB');
