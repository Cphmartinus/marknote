// Kopierer browser-bibliotekerne ind i renderer/vendor, så appen er selvstændig.
const fs = require('fs'), path = require('path');
const nm = (p) => path.join(__dirname, 'node_modules', p);
const out = path.join(__dirname, 'renderer', 'vendor');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'katex', 'fonts'), { recursive: true });
fs.copyFileSync(nm('marked/marked.min.js'), path.join(out, 'marked.min.js'));
fs.copyFileSync(nm('turndown/lib/turndown.browser.umd.js'), path.join(out, 'turndown.js'));
fs.copyFileSync(nm('turndown-plugin-gfm/dist/turndown-plugin-gfm.js'), path.join(out, 'turndown-gfm.js'));
fs.copyFileSync(nm('dompurify/dist/purify.min.js'), path.join(out, 'purify.min.js'));
fs.copyFileSync(nm('katex/dist/katex.min.js'), path.join(out, 'katex', 'katex.min.js'));
fs.copyFileSync(nm('katex/dist/katex.min.css'), path.join(out, 'katex', 'katex.min.css'));
for (const f of fs.readdirSync(nm('katex/dist/fonts'))) if (f.endsWith('.woff2')) fs.copyFileSync(nm('katex/dist/fonts/' + f), path.join(out, 'katex', 'fonts', f));
console.log('vendor ok');
