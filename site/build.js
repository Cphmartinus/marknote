// Builds the website in every language the app supports.
//   node site/build.js
// Input:  site/template.html (the page with {{tokens}}) and site/i18n/<lang>.json
// Output: docs/index.html (English), docs/<lang>/index.html and docs/sitemap.xml
// To change the page: edit the template or the English strings, then update the
// other languages and run the script again.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = 'https://cphmartinus.github.io/marknote/';
const DOCS = path.join(__dirname, '..', 'docs');
// code, native name, og:locale. The first one is served at the root.
const LANGS = [
  ['en', 'English', 'en_GB'], ['da', 'Dansk', 'da_DK'], ['de', 'Deutsch', 'de_DE'], ['fr', 'Français', 'fr_FR'],
  ['es', 'Español', 'es_ES'], ['it', 'Italiano', 'it_IT'], ['nl', 'Nederlands', 'nl_NL'], ['pt', 'Português', 'pt_PT'],
  ['pl', 'Polski', 'pl_PL'], ['sv', 'Svenska', 'sv_SE'], ['nb', 'Norsk', 'nb_NO'], ['fi', 'Suomi', 'fi_FI'], ['is', 'Íslenska', 'is_IS'],
];
const CODES = LANGS.map((l) => l[0]);
const url = (code) => (code === 'en' ? ROOT : ROOT + code + '/');
const rel = (from, to) => (from === 'en' ? (to === 'en' ? './' : to + '/') : (to === 'en' ? '../' : '../' + to + '/'));
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plain = (h) => String(h).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

const template = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf8');
const en = JSON.parse(fs.readFileSync(path.join(__dirname, 'i18n', 'en.json'), 'utf8'));
const strings = {};
for (const [code] of LANGS) {
  const file = path.join(__dirname, 'i18n', code + '.json');
  const t = code === 'en' ? en : JSON.parse(fs.readFileSync(file, 'utf8'));
  const missing = Object.keys(en).filter((k) => !(k in t));
  if (missing.length) throw new Error(code + ': missing ' + missing.join(', '));
  if (t.faq.length !== en.faq.length) throw new Error(code + ': FAQ has ' + t.faq.length + ' items, expected ' + en.faq.length);
  strings[code] = t;
}

const GLOBE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z"/></svg>';

function langLinks(code, cls) {
  return LANGS.map(([c, name]) => `<a href="${rel(code, c)}" hreflang="${c}" lang="${c}" data-setlang="${c}"${c === code ? ' aria-current="page"' : ''}${cls ? ` class="${cls}"` : ''}>${name}</a>`);
}

function jsonld(code, t) {
  const app = {
    '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'MarkNote',
    description: t.schemaDesc, url: url(code), applicationCategory: 'BusinessApplication', applicationSubCategory: 'Markdown editor',
    operatingSystem: 'Windows 10, Windows 11', isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    downloadUrl: 'https://github.com/Cphmartinus/marknote/releases/latest', installUrl: 'https://github.com/Cphmartinus/marknote/releases/latest',
    license: 'https://opensource.org/licenses/MIT', image: ROOT + 'icon.png',
    video: { '@type': 'VideoObject', name: t.videoName, description: t.videoDesc, thumbnailUrl: [ROOT + 'marknote-tour.jpg'],
      contentUrl: ROOT + 'marknote-tour.mp4', embedUrl: url(code) + '#video', uploadDate: '2026-11-18', duration: 'PT2M3S', inLanguage: 'en' },
    screenshot: [ROOT + 'story-write.webp', ROOT + 'diagram-editor.webp', ROOT + 'context-menu.webp'],
    featureList: t.featureList, inLanguage: CODES, sameAs: ['https://github.com/Cphmartinus/marknote'],
  };
  const faq = { '@context': 'https://schema.org', '@type': 'FAQPage', inLanguage: code,
    mainEntity: t.faq.map(([q, a]) => ({ '@type': 'Question', name: plain(q), acceptedAnswer: { '@type': 'Answer', text: plain(a) } })) };
  const block = (o) => '<script type="application/ld+json">\n' + JSON.stringify(o, null, 1) + '\n</script>';
  return block(app) + '\n' + block(faq);
}

function suggest(code) {
  const data = {};
  for (const [c] of LANGS) data[c] = { t: strings[c].sugText, b: strings[c].sugBtn, x: strings[c].sugClose, u: rel(code, c) };
  return `<div class="suggest" id="suggest" hidden role="region" aria-live="polite"><span class="s-t"></span><a class="s-b" href="#"></a><button class="s-x" type="button">×</button></div>
<script>
(function () {
  var page = ${JSON.stringify(code)}, D = ${JSON.stringify(data)};
  var store = function (k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-setlang]'); if (a) store('mn.lang', a.getAttribute('data-setlang'));
    document.querySelectorAll('details.lang[open]').forEach(function (d) { if (!d.contains(e.target)) d.removeAttribute('open'); });
  });
  if (store('mn.lang')) return;
  var want = null, langs = navigator.languages || [navigator.language || ''];
  for (var i = 0; i < langs.length && !want; i++) {
    var l = String(langs[i]).toLowerCase().split('-')[0]; if (l === 'no' || l === 'nn') l = 'nb';
    if (D[l]) want = l;
  }
  if (!want || want === page) return;
  var box = document.getElementById('suggest'), d = D[want];
  box.setAttribute('lang', want);
  box.querySelector('.s-t').textContent = d.t;
  var b = box.querySelector('.s-b'); b.textContent = d.b; b.href = d.u; b.setAttribute('data-setlang', want);
  var x = box.querySelector('.s-x'); x.setAttribute('aria-label', d.x);
  x.addEventListener('click', function () { store('mn.lang', page); box.hidden = true; });
  setTimeout(function () { box.hidden = false; }, 1200);
})();
</script>`;
}

function build(code) {
  const t = strings[code];
  const base = code === 'en' ? '' : '../';
  const vars = {
    lang: code, url: url(code), base, ogLocale: LANGS.find((l) => l[0] === code)[2],
    alternates: LANGS.map(([c]) => `<link rel="alternate" hreflang="${c}" href="${url(c)}">`).join('\n') + `\n<link rel="alternate" hreflang="x-default" href="${ROOT}">`,
    jsonld: jsonld(code, t),
    langmenu: `<details class="lang"><summary aria-label="${esc(t.langLabel)}">${GLOBE}<span class="ln-full">${LANGS.find((l) => l[0] === code)[1]}</span><span class="ln-code">${code.toUpperCase()}</span></summary><div class="lang-list">${langLinks(code).join('')}</div></details>`,
    footlangs: langLinks(code).join(''),
    suggest: suggest(code),
    jsL: JSON.stringify({ lines: t.lines, ver: t.ver }),
    linesZero: esc(t.lines.replace('{k}', 0).replace('{n}', 7)),
    faq: t.faq.map(([q, a]) => `        <details data-r><summary>${q}</summary><div class="a"><p>${a}</p></div></details>`).join('\n'),
  };
  let out = template.replace(/\{\{(\w+)\}\}/g, (m, k) => {
    if (k in vars) return vars[k];
    if (k in t) return t[k];
    throw new Error(code + ': unknown token ' + k);
  });
  // relative links inside translated strings (user guides, etc.) also need the prefix
  if (base) out = out.replace(/(\s(?:src|href|poster)=")(?!https?:|#|mailto:|\.\.\/|data:)([^"]+\.(?:docx|png|webp|jpg|mp4|webm|gif|vtt|xml))"/g, '$1' + base + '$2"');
  if (/\{\{\w+\}\}/.test(out)) throw new Error(code + ': unreplaced token');
  const file = code === 'en' ? path.join(DOCS, 'index.html') : path.join(DOCS, code, 'index.html');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, out);
  return file;
}

for (const [code] of LANGS) console.log('wrote', path.relative(process.cwd(), build(code)));

// sitemap with language alternates and the tour video on every page
const today = new Date().toISOString().slice(0, 10);
const alt = LANGS.map(([c]) => `    <xhtml:link rel="alternate" hreflang="${c}" href="${url(c)}"/>`).join('\n') + `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${ROOT}"/>`;
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${LANGS.map(([c]) => `  <url>
    <loc>${url(c)}</loc>
    <lastmod>${today}</lastmod>
${alt}
    <video:video>
      <video:thumbnail_loc>${ROOT}marknote-tour.jpg</video:thumbnail_loc>
      <video:title>${esc(strings[c].videoName)}</video:title>
      <video:description>${esc(strings[c].videoDesc)}</video:description>
      <video:content_loc>${ROOT}marknote-tour.mp4</video:content_loc>
      <video:duration>123</video:duration>
      <video:publication_date>2026-11-18</video:publication_date>
      <video:family_friendly>yes</video:family_friendly>
    </video:video>
  </url>`).join('\n')}
</urlset>
`;
fs.writeFileSync(path.join(DOCS, 'sitemap.xml'), sitemap);
console.log('wrote docs/sitemap.xml');
