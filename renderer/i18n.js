/* Lokalisering: dansk tekst er nøglen; WD_STRINGS indeholder rækker [da, en, de, fr, es, it, nl, pt, pl, sv, nb, fi, is] */
(function () {
  'use strict';
  const ORDER = ['en', 'de', 'fr', 'es', 'it', 'nl', 'pt', 'pl', 'sv', 'nb', 'fi', 'is'];
  const LANGS = { da: 'Dansk', en: 'English', de: 'Deutsch', fr: 'Français', es: 'Español', it: 'Italiano', nl: 'Nederlands', pt: 'Português', pl: 'Polski', sv: 'Svenska', nb: 'Norsk (bokmål)', fi: 'Suomi', is: 'Íslenska' };
  const LOCALES = { da: 'da-DK', en: 'en-GB', de: 'de-DE', fr: 'fr-FR', es: 'es-ES', it: 'it-IT', nl: 'nl-NL', pt: 'pt-PT', pl: 'pl-PL', sv: 'sv-SE', nb: 'nb-NO', fi: 'fi-FI', is: 'is-IS' };
  const SPELL = { da: 'da', en: 'en-GB', de: 'de', fr: 'fr', es: 'es', it: 'it', nl: 'nl', pt: 'pt-PT', pl: 'pl', sv: 'sv', nb: 'nb', fi: 'fi', is: 'is' };
  const maps = {};
  for (const l of ORDER) maps[l] = {};
  for (const row of window.WD_STRINGS || []) ORDER.forEach((l, i) => { if (row[i + 1] !== undefined && row[i + 1] !== '') maps[l][row[0]] = row[i + 1]; });
  const known = new Set((window.WD_STRINGS || []).map((r) => r[0]));
  let cur = 'da';
  const origText = new WeakMap();
  const SKIP = '#preview, #ed, #hl, #doctabs, #navList, #modalRoot, #toast';

  function detect(code) {
    const c = String(code || 'en').toLowerCase().split(/[-_]/)[0];
    const m = { no: 'nb', nn: 'nb' }[c] || c;
    return LANGS[m] ? m : 'en';
  }
  function t(key, ...args) {
    let s = cur === 'da' ? key : maps[cur][key];
    if (s === undefined) s = key;
    return args.length ? s.replace(/\{(\d+)\}/g, (_m, i) => (args[i] === undefined ? '' : args[i])) : s;
  }
  function tr(key) { return cur === 'da' ? key : maps[cur][key]; }

  function apply(root) {
    root = root || document.body;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (w.nextNode()) nodes.push(w.currentNode);
    for (const n of nodes) {
      if (n.parentElement && n.parentElement.closest(SKIP)) continue;
      const orig = origText.has(n) ? origText.get(n) : n.nodeValue;
      const key = orig.trim();
      if (!key || !known.has(key)) continue;
      origText.set(n, orig);
      const v = tr(key);
      n.nodeValue = orig.replace(key, v === undefined ? key : v);
    }
    root.querySelectorAll('[title],[placeholder],[aria-label],[data-i18n-title],[data-i18n-placeholder]').forEach((el) => {
      if (el.closest(SKIP)) return;
      for (const a of ['title', 'placeholder', 'aria-label']) {
        const store = 'i18n' + a.replace(/-/g, '');
        const orig = el.dataset[store] !== undefined ? el.dataset[store] : el.getAttribute(a);
        if (!orig || !known.has(orig)) continue;
        el.dataset[store] = orig;
        const v = tr(orig);
        el.setAttribute(a, v === undefined ? orig : v);
      }
    });
  }
  function setLang(code) {
    cur = LANGS[code] ? code : 'en';
    document.documentElement.lang = cur;
    apply(document.body);
    return cur;
  }
  window.WDi18n = { t, setLang, apply, detect, lang: () => cur, LANGS, LOCALES, SPELL, locale: () => LOCALES[cur], known };
})();
