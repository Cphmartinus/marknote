/* MarkNote – renderer */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const api = window.api || {};
  const md = window.WDmd;
  const { t } = window.WDi18n;
  const loc = () => window.WDi18n.locale();

  const ed = $('#ed'), hl = $('#hl'), preview = $('#preview'), previewWrap = $('#previewWrap'), workspace = $('#workspace');
  const state = { virtual: null, path: null, saved: '', mode: 'split', theme: 'light', lastSnap: '', untitled: 'Dokument1', untitledNo: 1 };

  /* ---------- indstillinger ---------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem('wd.' + k); return v === null ? d : JSON.parse(v); } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem('wd.' + k, JSON.stringify(v)); } catch (_) {} },
  };

  function toast(msg, ms = 2600) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => (t.hidden = true), ms);
  }

  /* ---------- syntaksfremhævning i råtilstand ---------- */
  const esc = md.esc;
  const INLINE = /(`+)[^`\n]*?\1|\*\*[^*\n]+?\*\*|__[^_\n]+?__|(?<![*\w])\*[^*\s][^*\n]*?\*(?!\*)|(?<![\w_])_[^_\s][^_\n]*?_(?![\w_])|~~[^~\n]+?~~|==[^=\n]+?==|\$[^$\n]+\$|!?\[[^\]\n]*\]\([^)\n]*\)|&lt;!--.*?--&gt;|\[\^[^\]\s]+\]/g;
  function inlineHl(e) {
    return e.replace(INLINE, (m) => {
      if (m[0] === '`') return `<span class="c">${m}</span>`;
      if (m.startsWith('**') || m.startsWith('__')) return `<span class="m">${m.slice(0, 2)}</span><span class="b">${m.slice(2, -2)}</span><span class="m">${m.slice(-2)}</span>`;
      if (m.startsWith('~~')) return `<span class="m">~~</span><span class="s">${m.slice(2, -2)}</span><span class="m">~~</span>`;
      if (m.startsWith('==')) return `<span class="m">==</span><span class="hi">${m.slice(2, -2)}</span><span class="m">==</span>`;
      if (m[0] === '*' || m[0] === '_') return `<span class="m">${m[0]}</span><span class="i">${m.slice(1, -1)}</span><span class="m">${m[0]}</span>`;
      if (m[0] === '$') return `<span class="mt">${m}</span>`;
      if (m.startsWith('&lt;!--')) return `<span class="x">${m}</span>`;
      if (m.startsWith('[^')) return `<span class="f">${m}</span>`;
      return `<span class="l">${m}</span>`;
    });
  }
  function highlight(src) {
    const out = [];
    let fence = null, math = false, cmt = false;
    for (const line of src.split('\n')) {
      let e = esc(line);
      if (cmt) { out.push(`<span class="x">${e}</span>`); if (line.includes('-->')) cmt = false; continue; }
      const fm = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
      if (fm) { fence = fence ? (fm[1][0] === fence ? null : fence) : fm[1][0]; out.push(`<span class="f">${e}</span>`); continue; }
      if (fence) { out.push(`<span class="f">${e}</span>`); continue; }
      if (/^\s*\$\$/.test(line)) { if (!(/^\s*\$\$.+\$\$\s*$/.test(line))) math = !math; out.push(`<span class="mt">${e}</span>`); continue; }
      if (math) { out.push(`<span class="mt">${e}</span>`); continue; }
      const open = line.indexOf('<!--');
      if (open >= 0 && !line.slice(open).includes('-->')) {
        const idx = e.indexOf('&lt;!--');
        out.push(inlineHl(e.slice(0, idx)) + `<span class="x">${e.slice(idx)}</span>`); cmt = true; continue;
      }
      let m;
      if ((m = /^(\s{0,3}#{1,6})(\s.*|)$/.exec(line))) {
        out.push(`<span class="m">${esc(m[1])}</span><span class="h">${inlineHl(esc(m[2]))}</span>`);
      } else if ((m = /^(\s*(?:&gt;\s?)+)(.*)$/.exec(e))) {
        out.push(`<span class="q">${m[1]}${inlineHl(m[2])}</span>`);
      } else if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line) || /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(line)) {
        out.push(`<span class="m">${e}</span>`);
      } else if ((m = /^(\s*)([-*+]|\d+[.)])(\s+(?:\[[ xX]\]\s)?)(.*)$/.exec(e))) {
        out.push(`${m[1]}<span class="m">${m[2]}${m[3]}</span>${inlineHl(m[4])}`);
      } else if (e.includes('|')) {
        out.push(inlineHl(e).replace(/\|/g, '<span class="m">|</span>'));
      } else out.push(inlineHl(e));
    }
    return out.join('\n') + '\n​';
  }

  /* ---------- forhåndsvisning ---------- */
  let resolveImages = true;
  function docBase() {
    const vp = state.path || state.virtual;
    if (!vp) return null;
    const dir = vp.replace(/\\/g, '/').replace(/\/[^/]*$/, '');
    return 'file:///' + encodeURI(dir.replace(/^\/+/, '')).replace(/#/g, '%23') + '/';
  }
  if (window.DOMPurify) {
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
      if (node.tagName === 'IMG' && resolveImages) {
        const src = node.getAttribute('src') || '';
        if (src && !/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(src)) {
          const base = docBase();
          node.setAttribute('data-src', src);
          if (base) { try { node.setAttribute('src', new URL(src, base).href); } catch (_) {} }
        }
      }
    });
  }
  function sanitize(html, resolve) {
    resolveImages = resolve;
    return DOMPurify.sanitize(html, {
      ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|file):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
      ADD_ATTR: ['checked', 'disabled'],
    });
  }
  function renderHtml(showComments, resolve) {
    return sanitize(md.render(ed.value, { showComments }), resolve);
  }
  function renderPreview() {
    if (state.mode === 'raw') return;
    const y = previewWrap.scrollTop;
    const wy = rich();
    const html = renderHtml(true, true);
    preview.innerHTML = html || (wy ? '<p><br></p>' : '');
    preview.classList.toggle('empty', !ed.value.trim() && !wy);
    if (wy) {
      $$('.wd-math, .math-block, .footnotes, sup.fnref', preview).forEach((n) => n.setAttribute('contenteditable', 'false'));
      $$('input[type=checkbox]', preview).forEach((n) => n.removeAttribute('disabled'));
    }
    previewWrap.scrollTop = y;
  }

  preview.addEventListener('click', async (e) => {
    const a = e.target.closest('a');
    if (!a) return;
    e.preventDefault();
    if (rich() && !e.ctrlKey) return;
    const href = a.getAttribute('href') || '';
    if (href.startsWith('#')) {
      const id = decodeURIComponent(href.slice(1));
      let el = preview.querySelector('[id="' + CSS.escape(id) + '"]');
      if (!el) el = $$('h1,h2,h3,h4,h5,h6', preview).find((h) => md.slug(h.textContent) === id);
      if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
    } else if (/^(https?:|mailto:)/i.test(href)) api.openExternal && api.openExternal(href);
    else if (/\.(md|markdown|txt)$/i.test(href.split('#')[0]) && docBase()) {
      try {
        let p = decodeURIComponent(new URL(href, docBase()).pathname).replace(/^\/(?=[A-Za-z]:)/, '');
        if (/^[A-Za-z]:/.test(p)) p = p.replace(/\//g, '\\');
        applyOpened(await api.readFile(p));
      } catch (_) {}
    }
  });

  /* ---------- opdatering ved ændringer ---------- */
  let rT = 0, hT = 0;
  function onChange() {
    hl.innerHTML = highlight(ed.value);
    syncScroll();
    updateDirty();
    updateStats();
    clearTimeout(rT);
    rT = setTimeout(() => { renderPreview(); if (!$('#nav').hidden) buildNav(); }, 120);
  }
  function syncScroll() { hl.scrollTop = ed.scrollTop; hl.scrollLeft = ed.scrollLeft; }
  ed.addEventListener('input', onChange);
  ed.addEventListener('scroll', () => {
    syncScroll();
    if (state.mode === 'split' && $('#optSync').checked) {
      const max = ed.scrollHeight - ed.clientHeight;
      const pm = previewWrap.scrollHeight - previewWrap.clientHeight;
      if (max > 0 && pm > 0) previewWrap.scrollTop = (ed.scrollTop / max) * pm;
    }
  });

  function updateStats() {
    const s = md.stats(ed.value);
    $('#stWords').textContent = t('{0} ord', s.words.toLocaleString(loc()));
    $('#stChars').textContent = t('{0} tegn ({1} uden mellemrum)', s.chars.toLocaleString(loc()), s.charsNoSpaces.toLocaleString(loc()));
  }
  function updatePos() {
    const a = ed.selectionStart, before = ed.value.slice(0, a);
    const ln = before.split('\n').length, col = a - before.lastIndexOf('\n');
    const sel = ed.selectionEnd - a;
    $('#stPos').textContent = t('Ln {0}, Kol {1}', ln, col) + (sel ? ' ' + t('({0} valgt)', sel) : '');
    const line = ed.value.slice(before.lastIndexOf('\n') + 1).split('\n')[0];
    const h = /^ {0,3}(#{1,6})\s/.exec(line);
    $('#headingSel').value = h ? String(h[1].length) : '0';
  }
  ['keyup', 'click', 'select', 'focus'].forEach((ev) => ed.addEventListener(ev, updatePos));
  document.addEventListener('selectionchange', () => { if (document.activeElement === ed) updatePos(); });

  /* ---------- titel / dirty ---------- */
  const docName = () => (state.path ? state.path.split(/[\\/]/).pop() : state.untitled);
  const isDirty = () => ed.value !== state.saved;
  function updateDirty() {
    const d = isDirty();
    const full = docName() + (d ? ' *' : '') + ' – MarkNote';
    document.title = full;
    $('#doctitle').textContent = full;
    $('#savedState').textContent = d ? t('Ikke gemt') : state.path ? t('Gemt') : '';
    renderTabs();
  }

  /* ---------- filer ---------- */
  function loadDoc(content, path) {
    ed.value = content;
    state.path = path || null;
    state.virtual = null;
    state.saved = content;
    state.lastSnap = content;
    ed.scrollTop = 0; previewWrap.scrollTop = 0;
    ed.setSelectionRange(0, 0);
    onChange(); renderPreview(); updatePos(); buildNav();
  }
  async function confirmDiscard() {
    if (!isDirty()) return true;
    const r = await api.confirm({ message: t('Vil du gemme ændringerne i "{0}"?', docName()), detail: t('Dine ændringer går tabt, hvis du ikke gemmer dem.'), buttons: [t('Gem'), t('Gem ikke'), t('Annuller')] });
    if (r === 0) return await save(false);
    if (r === 1) { snapshot(true); return true; }
    return false;
  }
  async function save(as) {
    const r = await api.saveFile({ path: state.path, content: ed.value, saveAs: !!as, suggested: state.untitled, suggestedPath: state.virtual });
    if (!r) return false;
    if (r.error) { toast(t('Kunne ikke gemme: {0}', r.error), 5000); return false; }
    state.path = r.path; state.saved = ed.value;
    updateDirty(); snapshot(true); toast(t('Gemt'));
    return true;
  }
  /* ---------- dokumentfaner ---------- */
  let nextId = 1, untitledN = 1;
  const docs = [];
  let curId = 0;
  const newDoc = () => ({ id: nextId++, path: null, virtual: null, untitled: t('Dokument') + ' ' + untitledN, untitledNo: untitledN++, text: '', saved: '', lastSnap: '', sel: [0, 0], scroll: 0, pscroll: 0 });
  const current = () => docs.find((d) => d.id === curId);
  function stash() {
    const d = current(); if (!d) return;
    Object.assign(d, { path: state.path, virtual: state.virtual, untitled: state.untitled, untitledNo: state.untitledNo, saved: state.saved, lastSnap: state.lastSnap,
      text: ed.value, sel: [ed.selectionStart, ed.selectionEnd], scroll: ed.scrollTop, pscroll: previewWrap.scrollTop });
  }
  function restore(d) {
    curId = d.id;
    Object.assign(state, { path: d.path, virtual: d.virtual, untitled: d.untitled, untitledNo: d.untitledNo, saved: d.saved, lastSnap: d.lastSnap });
    ed.value = d.text;
    onChange(); renderPreview(); buildNav();
    ed.scrollTop = d.scroll; previewWrap.scrollTop = d.pscroll;
    try { ed.setSelectionRange(d.sel[0], d.sel[1]); } catch (_) {}
    syncScroll(); updatePos(); updateDirty();
    if (state.mode === 'read') preview.focus(); else ed.focus();
  }
  const docDirty = (d) => (d.id === curId ? isDirty() : d.text !== d.saved);
  const docLabel = (d) => { const n = d.id === curId ? docName() : d.path ? d.path.split(/[\\/]/).pop() : d.untitled; return n; };
  function activate(id) {
    if (id === curId) return;
    const d = docs.find((x) => x.id === id); if (!d) return;
    stash(); restore(d);
  }
  function newTab() {
    stash();
    const d = newDoc(); docs.push(d); restore(d);
    return d;
  }
  const isPristine = () => !state.path && !state.virtual && ed.value === state.saved && (ed.value === '' || ed.value === WELCOME);
  /* Åbn indhold i en ny fane (eller genbrug den aktuelle, hvis den er urørt) */
  function openInTab(content, path, extra) {
    const existing = path && (docs.find((d) => d.id !== curId && d.path === path) || (state.path === path ? current() : null));
    if (existing) { activate(existing.id); return false; }
    if (!isPristine()) newTab();
    loadDoc(content, path);
    if (extra) extra();
    return true;
  }
  function renderTabs() {
    const box = $('#doctabs'); if (!box) return;
    box.innerHTML = '';
    for (const d of docs) {
      const tab = document.createElement('div');
      tab.className = 'dtab' + (d.id === curId ? ' active' : '');
      const full = d.id === curId ? state.path : d.path;
      tab.title = full || docLabel(d);
      const n = document.createElement('span'); n.className = 'dn'; n.textContent = docLabel(d);
      const dirty = docDirty(d);
      const x = document.createElement('button'); x.className = 'dx'; x.title = t('Luk fane') + ' (Ctrl+W)'; x.textContent = dirty ? '\u25CF' : '\u2715';
      if (dirty) x.classList.add('dirty');
      x.onclick = (e) => { e.stopPropagation(); closeTab(d.id); };
      tab.onmousedown = (e) => { if (e.button === 1) { e.preventDefault(); closeTab(d.id); } };
      tab.onclick = () => activate(d.id);
      tab.append(n, x); box.append(tab);
    }
    const plus = document.createElement('button'); plus.className = 'dplus'; plus.title = t('Nyt dokument') + ' (Ctrl+N)'; plus.textContent = '+'; plus.onclick = () => cmdNew();
    box.append(plus);
    const a = box.querySelector('.dtab.active'); if (a && a.scrollIntoView) a.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  async function closeTab(id) {
    const d = docs.find((x) => x.id === id); if (!d) return false;
    if (docDirty(d)) {
      activate(id);
      if (!(await confirmDiscard())) return false;
    }
    const i = docs.findIndex((x) => x.id === id);
    docs.splice(i, 1);
    if (!docs.length) { const nd = newDoc(); docs.push(nd); curId = -1; restore(nd); return true; }
    if (id === curId) { const next = docs[Math.min(i, docs.length - 1)]; curId = -1; restore(next); } else renderTabs();
    return true;
  }
  const switchBy = (n) => { if (docs.length < 2) return; const i = docs.findIndex((x) => x.id === curId); activate(docs[(i + n + docs.length) % docs.length].id); };
  async function cmdNew() { newTab(); }
  /* Word/HTML -> Markdown ved åbning */
  function htmlToMd(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('table').forEach((t) => {
      t.querySelectorAll('td p, th p').forEach((p) => { p.replaceWith(...p.childNodes, doc.createTextNode(' ')); });
      const thead = t.querySelector('thead');
      if (thead && thead.querySelectorAll('tr').length > 1) {
        const tb = doc.createElement('tbody');
        Array.from(thead.querySelectorAll('tr')).slice(1).forEach((r) => {
          r.querySelectorAll('th').forEach((c) => { const d = doc.createElement('td'); d.innerHTML = c.innerHTML; c.replaceWith(d); });
          tb.append(r);
        });
        thead.after(tb);
      }
      if (!t.querySelector('thead')) {
        const first = t.querySelector('tr');
        if (first) {
          first.querySelectorAll('td').forEach((c) => { const th = doc.createElement('th'); th.innerHTML = c.innerHTML; c.replaceWith(th); });
          const th = doc.createElement('thead'); th.append(first);
          const tb = doc.createElement('tbody'); Array.from(t.querySelectorAll(':scope > tr')).forEach((r) => tb.append(r));
          t.prepend(tb); t.prepend(th);
        }
      }
    });
    doc.querySelectorAll('script,style').forEach((n) => n.remove());
    let out = td.turndown(doc.body).replace(/\u200b/g, '').replace(/\n{3,}/g, '\n\n').trim();
    out = out.replace(/^(\s*(?:-|\d+\.) )☑ /gm, '$1[x] ').replace(/^(\s*(?:-|\d+\.) )☐ /gm, '$1[ ] ');
    return out ? out + '\n' : '';
  }
  function applyOpened(r) {
    if (!r) return;
    if (r.error) return toast(t('Kunne ikke åbne filen: {0}', r.error), 5000);
    if (r.converted) {
      const text = htmlToMd(r.html);
      if (!isPristine()) newTab();
      loadDoc(text, null);
      state.untitled = r.name; state.untitledNo = null; state.virtual = r.virtualPath; state.saved = '';
      updateDirty(); buildNav(); renderPreview();
      toast(t('Konverteret fra {0} til Markdown – tryk Ctrl+S for at gemme som .md', r.converted.toUpperCase()) + (r.warnings ? ' ' + t('({0} bemærkninger)', r.warnings) : ''), 6000);
    } else openInTab(r.content, r.path);
  }
  async function cmdOpen() {
    applyOpened(await api.openFile());
  }
  async function openPath(p) {
    applyOpened(await api.readFile(p));
  }
  api.onOpenPath && api.onOpenPath(openPath);
  api.onRequestClose && api.onRequestClose(async () => {
    for (const d of [...docs]) {
      if (!docs.includes(d) || !docDirty(d)) continue;
      activate(d.id);
      if (!(await confirmDiscard())) return;
    }
    api.closeConfirmed();
  });

  /* ---------- snapshots ---------- */
  async function snapshot(quiet) {
    const v = ed.value;
    if (!v.trim() || v === state.lastSnap && quiet) return;
    await api.snapSave({ key: state.path || 'untitled', content: v });
    state.lastSnap = v;
    if (!quiet) toast(t('Snapshot gemt'));
  }
  setInterval(() => { if (ed.value !== state.lastSnap && ed.value.trim()) snapshot(true); }, 60000);

  /* ---------- redigeringshjælpere ---------- */
  function exec(text) {
    if (!document.execCommand('insertText', false, text)) {
      const a = ed.selectionStart, b = ed.selectionEnd;
      ed.setRangeText(text, a, b, 'end');
      ed.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
  function replaceRange(a, b, text, selA, selB) {
    ed.focus();
    ed.setSelectionRange(a, b);
    exec(text);
    if (selA !== undefined) ed.setSelectionRange(selA, selB === undefined ? selA : selB);
    updatePos();
  }
  const wordAt = (pos) => {
    const v = ed.value;
    let a = pos, b = pos;
    while (a > 0 && /[\p{L}\p{N}_]/u.test(v[a - 1])) a--;
    while (b < v.length && /[\p{L}\p{N}_]/u.test(v[b])) b++;
    return a === b ? null : [a, b];
  };
  function wrap(pre, suf = pre, ph = t('tekst')) {
    const v = ed.value;
    let a = ed.selectionStart, b = ed.selectionEnd;
    if (a === b) { const w = wordAt(a); if (w) [a, b] = w; }
    const sel = v.slice(a, b);
    const bold = pre === '*' && v.slice(a - 2, a) === '**' && v.slice(b, b + 2) === '**';
    if (v.slice(a - pre.length, a) === pre && v.slice(b, b + suf.length) === suf && !bold && (pre !== '*' || v[a - 2] !== '*')) {
      return replaceRange(a - pre.length, b + suf.length, sel, a - pre.length, a - pre.length + sel.length);
    }
    if (sel.length > pre.length + suf.length && sel.startsWith(pre) && sel.endsWith(suf) && !(pre === '*' && sel.startsWith('**'))) {
      const inner = sel.slice(pre.length, sel.length - suf.length);
      return replaceRange(a, b, inner, a, a + inner.length);
    }
    const text = sel || ph;
    replaceRange(a, b, pre + text + suf, a + pre.length, a + pre.length + text.length);
  }
  function lineRange() {
    const v = ed.value, a = ed.selectionStart;
    let b = ed.selectionEnd;
    if (b > a && v[b - 1] === '\n') b--;
    const start = v.lastIndexOf('\n', a - 1) + 1;
    let end = v.indexOf('\n', b);
    if (end < 0) end = v.length;
    return [start, end];
  }
  function mapLines(fn) {
    const [s, e] = lineRange();
    const lines = ed.value.slice(s, e).split('\n');
    const res = fn(lines);
    const text = res.join('\n');
    replaceRange(s, e, text, s, s + text.length);
  }
  const LIST_RE = /^(\s*)(?:[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+)/;
  function setList(kind) {
    mapLines((lines) => {
      const re = { ul: /^(\s*)[-*+]\s+(?!\[[ xX]\])/, ol: /^(\s*)\d+[.)]\s+/, task: /^(\s*)[-*+]\s+\[[ xX]\]\s+/ }[kind];
      const nonEmpty = lines.filter((l) => l.trim());
      const allOn = nonEmpty.length && nonEmpty.every((l) => re.test(l));
      let n = 0;
      return lines.map((l) => {
        if (!l.trim()) return l;
        const indent = /^\s*/.exec(l)[0];
        const bare = l.replace(LIST_RE, '$1');
        if (allOn) return bare;
        n++;
        return indent + (kind === 'ul' ? '- ' : kind === 'task' ? '- [ ] ' : n + '. ') + bare.slice(indent.length);
      });
    });
  }
  function setHeading(n) {
    mapLines((lines) => {
      const same = lines.every((l) => new RegExp('^ {0,3}#{' + n + '}\\s').test(l));
      return lines.map((l) => {
        const bare = l.replace(/^ {0,3}#{1,6}\s+/, '');
        return n === 0 || same ? bare : '#'.repeat(n) + ' ' + bare;
      });
    });
  }
  function setQuote() {
    mapLines((lines) => {
      const all = lines.every((l) => /^\s*>\s?/.test(l) || !l.trim());
      return lines.map((l) => (all ? l.replace(/^(\s*)>\s?/, '$1') : '> ' + l));
    });
  }
  function indentLines(dir) {
    if (ed.selectionStart === ed.selectionEnd && dir > 0) return exec('  ');
    mapLines((lines) => lines.map((l) => (dir > 0 ? '  ' + l : l.replace(/^( {1,2}|\t)/, ''))));
  }
  function insertBlock(text, cursorOffset) {
    const v = ed.value, a = ed.selectionStart, b = ed.selectionEnd;
    const before = v.slice(0, a), after = v.slice(b);
    const pre = !before.length ? '' : before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
    const suf = !after.length ? '\n' : after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n';
    const full = pre + text + suf;
    const c = cursorOffset === undefined ? undefined : a + pre.length + cursorOffset;
    replaceRange(a, b, full, c);
    return c;
  }
  function codeBlock() {
    const sel = ed.value.slice(ed.selectionStart, ed.selectionEnd);
    if (sel) insertBlock('```\n' + sel.replace(/\n$/, '') + '\n```');
    else insertBlock('```\n\n```', 4);
  }
  function comment() {
    const a = ed.selectionStart, b = ed.selectionEnd, sel = ed.value.slice(a, b);
    if (sel) replaceRange(a, b, '<!-- ' + sel + ' -->', a + 5, a + 5 + sel.length);
    else replaceRange(a, b, '<!--  -->', a + 5);
  }
  function footnote() {
    const v = ed.value;
    let n = 1;
    for (const m of v.matchAll(/\[\^(\d+)\]/g)) n = Math.max(n, +m[1] + 1);
    const a = ed.selectionStart, b = ed.selectionEnd;
    const tail = (v.endsWith('\n\n') ? '' : v.endsWith('\n') ? '\n' : '\n\n') + `[^${n}]: ${t('Fodnotetekst')}`;
    replaceRange(v.length, v.length, tail);
    replaceRange(b, b, `[^${n}]`, b + `[^${n}]`.length);
    toast(t('Fodnote {0} tilføjet nederst i dokumentet', n));
  }
  async function cmdLink() {
    const a = ed.selectionStart, b = ed.selectionEnd, sel = ed.value.slice(a, b);
    const r = await ask({ title: t('Indsæt link'), fields: [
      { id: 'text', label: t('Tekst der vises'), value: sel }, { id: 'url', label: t('Adresse (URL)'), value: sel && /^https?:\/\//.test(sel) ? sel : 'https://' }] });
    if (!r) return ed.focus();
    replaceRange(a, b, `[${r.text || r.url}](${r.url})`);
  }
  async function cmdImage(preset) {
    if (richTarget()) return W.image(preset);
    const a = ed.selectionStart, b = ed.selectionEnd;
    const r = await ask({ title: t('Indsæt billede'), fields: [
      { id: 'src', label: t('Billedsti eller URL'), value: preset || '', browse: true },
      { id: 'alt', label: t('Alternativ tekst'), value: ed.value.slice(a, b) }] });
    if (!r || !r.src) return ed.focus();
    const alt = r.alt || decodeURI(r.src.split('/').pop().replace(/\.[^.]+$/, ''));
    replaceRange(a, b, `![${alt}](${/\s/.test(r.src) ? '<' + r.src + '>' : r.src})`);
    if (!state.path && /^file:/.test(r.src)) toast(t('Gem dokumentet først, hvis billedet skal bruge relativ sti'), 4500);
  }
  async function cmdTable() {
    const r = await tableDialog();
    if (!r) return ed.focus();
    const { cols, rows, align } = r;
    const sep = { left: ':---', center: ':---:', right: '---:', none: '---' }[align];
    const row = (cells) => '| ' + cells.join(' | ') + ' |';
    const head = row(Array.from({ length: cols }, (_, i) => t('Kolonne') + ' ' + (i + 1)));
    const lines = [head, row(Array(cols).fill(sep)), ...Array.from({ length: rows }, () => row(Array(cols).fill('   ')))];
    insertBlock(lines.join('\n'));
  }

  /* ---------- dialoger ---------- */
  function modal({ title, body, buttons, wide }) {
    return new Promise((resolve) => {
      const root = $('#modalRoot');
      const ov = document.createElement('div');
      ov.className = 'overlay';
      const dlg = document.createElement('div');
      dlg.className = 'dlg' + (wide ? ' wide' : '');
      dlg.setAttribute('role', 'dialog');
      const h = document.createElement('h3'); h.textContent = title;
      const bd = document.createElement('div'); bd.className = 'body'; bd.append(body);
      const ft = document.createElement('div'); ft.className = 'foot';
      const close = (v) => { ov.remove(); document.removeEventListener('keydown', onKey, true); resolve(v); };
      const onKey = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(null); }
        else if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON' && !e.target.closest('.lst')) { e.preventDefault(); e.stopPropagation(); okBtn && okBtn.click(); }
      };
      let okBtn = null;
      for (const b of buttons) {
        const el = document.createElement('button');
        el.className = 'btn' + (b.primary ? ' primary' : ''); el.textContent = b.text;
        el.onclick = () => close(b.value ? b.value() : null);
        if (b.primary) okBtn = el;
        ft.append(el);
      }
      dlg.append(h, bd, ft); ov.append(dlg); root.append(ov);
      ov.addEventListener('mousedown', (e) => { if (e.target === ov) close(null); });
      document.addEventListener('keydown', onKey, true);
      const first = dlg.querySelector('input,select,textarea'); if (first) { first.focus(); first.select && first.select(); }
    });
  }
  function ask({ title, fields, okText = t('OK') }) {
    const body = document.createElement('div'); body.style.cssText = 'display:flex;flex-direction:column;gap:10px';
    const els = {};
    for (const f of fields) {
      const l = document.createElement('label'); l.className = 'f'; l.append(f.label);
      const i = document.createElement('input'); i.type = 'text'; i.value = f.value || ''; i.spellcheck = false;
      els[f.id] = i;
      if (f.browse) {
        const row = document.createElement('div'); row.className = 'inline2'; row.style.cssText = 'display:flex;gap:6px';
        const br = document.createElement('button'); br.className = 'btn'; br.textContent = t('Gennemse…'); br.style.flex = 'none';
        br.onclick = async () => { const r = await api.pickImage(state.path || state.virtual); if (r && r[0]) { i.value = r[0]; } };
        row.append(i, br); l.append(row);
      } else l.append(i);
      body.append(l);
    }
    return modal({ title, body, buttons: [
      { text: t('Annuller') },
      { text: okText, primary: true, value: () => Object.fromEntries(Object.entries(els).map(([k, v]) => [k, v.value.trim()])) }] });
  }
  function tableDialog() {
    const body = document.createElement('div'); body.style.cssText = 'display:flex;flex-direction:column;gap:10px';
    const grid = document.createElement('div'); grid.className = 'gridpick';
    const info = document.createElement('div'); info.className = 'muted';
    const mk = (id, label, val, min, max) => { const l = document.createElement('label'); l.className = 'f'; l.append(label); const i = document.createElement('input'); i.type = 'number'; i.min = min; i.max = max; i.value = val; i.id = id; l.append(i); return [l, i]; };
    const [lc, ic] = mk('tc', t('Kolonner'), 3, 1, 20), [lr, ir] = mk('tr', t('Rækker (ud over overskrift)'), 3, 1, 100);
    const row2 = document.createElement('div'); row2.className = 'inline2'; row2.append(lc, lr);
    const la = document.createElement('label'); la.className = 'f'; la.append(t('Justering'));
    const sa = document.createElement('select');
    [['none', 'Standard'], ['left', 'Venstre'], ['center', 'Midt'], ['right', 'Højre']].forEach(([v, n]) => sa.add(new Option(t(n), v)));
    la.append(sa);
    for (let r = 1; r <= 8; r++) for (let c = 1; c <= 10; c++) { const i = document.createElement('i'); i.dataset.r = r; i.dataset.c = c; grid.append(i); }
    const paint = (r, c) => { $$('i', grid).forEach((x) => x.classList.toggle('on', +x.dataset.r <= r && +x.dataset.c <= c)); info.textContent = t('{0} × {1} (inkl. overskrift)', c, r + 1); };
    grid.onmouseover = (e) => { const t = e.target; if (t.dataset && t.dataset.r) { ic.value = t.dataset.c; ir.value = t.dataset.r; paint(+t.dataset.r, +t.dataset.c); } };
    grid.onclick = (e) => { if (e.target.dataset && e.target.dataset.r) $('.dlg .btn.primary').click(); };
    ic.oninput = ir.oninput = () => paint(+ir.value || 1, +ic.value || 1);
    paint(3, 3);
    body.append(grid, info, row2, la);
    return modal({ title: t('Indsæt tabel'), body, buttons: [
      { text: t('Annuller') },
      { text: t('Indsæt'), primary: true, value: () => ({ cols: Math.min(20, Math.max(1, +ic.value || 3)), rows: Math.min(100, Math.max(1, +ir.value || 3)), align: sa.value }) }] });
  }
  async function cmdHistory() {
    await snapshot(true);
    const key = state.path || 'untitled';
    const list = await api.snapList(key);
    const wrapEl = document.createElement('div'); wrapEl.className = 'hist';
    const lst = document.createElement('div'); lst.className = 'lst';
    const pre = document.createElement('pre'); pre.textContent = list.length ? t('Vælg en version til venstre.') : t('Ingen tidligere versioner endnu. Der gemmes automatisk et snapshot hvert minut, når du har ændret noget, og hver gang du gemmer.');
    let sel = null, selText = null;
    const fmt = (id) => { const d = new Date(id.replace(/T(\d+)-(\d+)-(\d+)-\d+Z/, 'T$1:$2:$3Z')); return isNaN(d) ? id : d.toLocaleString(loc(), { dateStyle: 'medium', timeStyle: 'medium' }); };
    for (const s of list) {
      const b = document.createElement('button'); b.textContent = fmt(s.id) + '  ·  ' + Math.max(1, Math.round(s.size / 1024)) + ' kB';
      b.onclick = async () => { $$('button', lst).forEach((x) => x.classList.remove('on')); b.classList.add('on'); sel = s.id; selText = await api.snapRead(key, s.id); pre.textContent = selText || t('(kunne ikke læses)'); };
      lst.append(b);
    }
    wrapEl.append(lst, pre);
    const r = await modal({ title: t('Versionshistorik') + ' – ' + docName(), body: wrapEl, wide: true, buttons: [
      { text: t('Luk') }, { text: t('Gendan valgt version'), primary: true, value: () => (selText !== null ? { text: selText } : null) }] });
    if (r && r.text !== undefined) {
      ensureSource();
      ed.focus(); ed.select(); exec(r.text); ed.setSelectionRange(0, 0); toast(t('Version gendannet (kan fortrydes med Ctrl+Z)'));
    }
  }
  async function cmdAbout() {
    const b = document.createElement('div');
    b.innerHTML = '<p><b>MarkNote</b> – ' + t('Markdown-læser og -editor i Microsoft Word-stil.') + '</p><p>' + t('Dokumenter gemmes som helt almindelige <code>.md</code>-filer. Hold musen over en knap for at se genvej og Markdown-syntaks.') + '</p><p>' + t('Spørgsmål? Kontakt <b>Martin Piffet</b>:') + ' <a href="https://github.com/Cphmartinus/marknote/issues" class="maillink">GitHub Issues</a></p><p class="muted">' + t('Tip: <b>Ctrl+F1</b> skjuler båndet. Træk en .md-fil ind i vinduet for at åbne den.') + '</p>';
    await modal({ title: t('Om MarkNote'), body: b, buttons: [{ text: t('Luk'), primary: true }] });
  }

  /* Forhåndsvisningen er redigerbar (WYSIWYG) i Live preview og Læsetilstand */
  let lastPane = 'ed';
  const rich = () => state.mode !== 'raw';
  const richTarget = () => state.mode === 'read' || (state.mode === 'split' && lastPane === 'preview');
  ed.addEventListener('focus', () => (lastPane = 'ed'));
  preview.addEventListener('focus', () => (lastPane = 'preview'));
  preview.addEventListener('mousedown', () => (lastPane = 'preview'));


  /* ---------- hjælp ---------- */
  const contactHtml = () => t('Har du spørgsmål til programmet, er du velkommen til at kontakte <b>Martin Piffet</b> på {0}.', '<a href="https://github.com/Cphmartinus/marknote/issues" class="maillink">GitHub Issues</a>');
  const li = (k) => '<li>' + t(k) + '</li>';
  function helpHtml() {
    return '<div class="help"><p>' + t('<b>MarkNote</b> er en Markdown-læser og -editor i Microsoft Word-stil. Dokumenterne gemmes som helt almindelige <code>.md</code>-filer, så du aldrig er låst til et bestemt program.') + '</p>' +
      '<h4>' + t('Kom i gang') + '</h4><ul>' +
      ['<b>Filer</b>: Ny, Åbn, Gem, Gem som og seneste filer. Du kan også trække en fil ind i vinduet.',
       '<b>Faner</b>: Hvert dokument åbnes i sin egen fane. <kbd>Ctrl+N</kbd> åbner en ny, <kbd>Ctrl+W</kbd> lukker, og <kbd>Ctrl+Tab</kbd> / <kbd>Ctrl+Shift+Tab</kbd> skifter. En prik i fanen betyder, at dokumentet ikke er gemt. Fortryd-historikken nulstilles, når du skifter fane.',
       '<b>Åbn Word eller HTML</b>: Åbner du en <code>.docx</code> eller <code>.html</code>, konverteres den automatisk til Markdown. Tryk Ctrl+S for at gemme resultatet som <code>.md</code>. Billeder lægges i en mappe ved siden af filen.',
       'Hold musen over en knap for at se navn, genvej og den tilsvarende Markdown-syntaks.'].map(li).join('') + '</ul>' +
      '<h4>' + t('Visninger (fanen Visning, eller knapperne nederst til højre)') + '</h4><ul>' +
      ['<b>Rå Markdown</b>: ren tekst med farvefremhævning.',
       '<b>Live preview</b>: Markdown til venstre og det formaterede dokument til højre. Du kan skrive i begge ruder, og de holdes synkroniseret.',
       '<b>Læsetilstand</b>: det formaterede dokument alene. Du kan stadig rette direkte i teksten.'].map(li).join('') + '</ul>' +
      '<h4>' + t('Fanerne i båndet') + '</h4><ul>' +
      ['<b>Hjem</b>: skrifttype og størrelse, fed, kursiv, gennemstreget, fremhævning, overskrifter, lister, tjekliste, citat og kode.',
       '<b>Indsæt</b>: tabel (interaktiv bygger), billede (relativ sti), link, fodnote, usynlig kommentar og LaTeX-formler.',
       '<b>Visning</b>: tilstande, temaer (Lys, Mørk, Sepia, Word Blue), navigationsrude og zoom.',
       '<b>Eksport &amp; Værktøjer</b>: eksport til PDF, DOCX (ægte Word), HTML og ren .md, versionshistorik og Find/Erstat med regex.'].map(li).join('') + '</ul>' +
      '<h4>' + t('Gode råd') + '</h4><ul>' +
      ['<b>Skjul båndet</b> med Ctrl+F1 for at få kun den blanke side.',
       '<b>Versionshistorik</b>: Programmet gemmer automatisk et snapshot, når du har ændret noget, og hver gang du gemmer. Find dem under Eksport &amp; Værktøjer.',
       '<b>Skrifttype og størrelse</b> er kun visning og gemmes ikke i .md-filen.',
       'Første gang du retter i det formaterede dokument, kan Markdown-teksten blive skrevet om i en ensartet stil.',
       '<b>Fodnoter</b> oprettes i Markdown-ruden (Live preview eller Rå Markdown).',
       '<b>Sprog</b>: Programmet følger som standard Windows’ sprog. Du kan skifte sprog nederst til højre eller under fanen Hjælp.'].map(li).join('') + '</ul>' +
      '<h4>' + t('Kontakt') + '</h4><p>' + contactHtml() + '</p></div>';
  }
  function shortcutsHtml() {
    const k = (x) => '<kbd>' + x + '</kbd>', c = (x) => '<code>' + x + '</code>';
    const row = (a, b, m) => '<tr><td>' + a + '</td><td>' + b + '</td><td>' + (m || '') + '</td></tr>';
    return '<div class="help"><table><tr><th>' + t('Handling') + '</th><th>' + t('Genvej') + '</th><th>Markdown</th></tr>' +
      row(t('Luk fane / næste fane / forrige fane'), k('Ctrl+W') + ' / ' + k('Ctrl+Tab') + ' / ' + k('Ctrl+Shift+Tab')) +
      row(t('Ny / Åbn / Gem / Gem som'), k('Ctrl+N') + ' / ' + k('O') + ' / ' + k('S') + ' / ' + k('Ctrl+Shift+S')) +
      row(t('Fed'), k('Ctrl+B'), c('**' + t('tekst') + '**')) +
      row(t('Kursiv'), k('Ctrl+I'), c('*' + t('tekst') + '*')) +
      row(t('Gennemstreget'), k('Ctrl+Shift+X'), c('~~' + t('tekst') + '~~')) +
      row(t('Fremhævning'), k('Ctrl+Shift+H'), c('==' + t('tekst') + '==')) +
      row(t('Overskrift 1–6'), k('Ctrl+Alt+1') + ' … ' + k('6'), c('# ' + t('Overskrift'))) +
      row(t('Punktopstilling') + ' / ' + t('Nummereret liste') + ' / ' + t('Tjekliste'), k('Ctrl+Shift+8') + ' / ' + k('7') + ' / ' + k('9'), c('- ') + ' ' + c('1. ') + ' ' + c('- [ ] ')) +
      row(t('Citat'), k('Ctrl+Shift+Q'), c('&gt; ' + t('Citat'))) +
      row(t('Kode') + ' / ' + t('Kodeblok'), k('Ctrl+E') + ' / ' + k('Ctrl+Shift+E'), c('`' + t('kode') + '`') + ' ' + c('```')) +
      row(t('Link'), k('Ctrl+K'), c('[' + t('tekst') + '](url)')) +
      row(t('Fodnote') + ' / ' + t('Kommentar'), k('Ctrl+Alt+F') + ' / ' + k('Ctrl+Alt+M'), c('[^1]') + ' ' + c('&lt;!-- … --&gt;')) +
      row(t('Formel'), t('fanen Indsæt'), c('$E=mc^2$')) +
      row(t('Find') + ' / ' + t('Erstat') + ' / ' + t('Næste'), k('Ctrl+F') + ' / ' + k('Ctrl+H') + ' / ' + k('F3')) +
      row(t('Skjul/vis bånd'), k('Ctrl+F1')) +
      row('Zoom', k('Ctrl +') + ' / ' + k('Ctrl -') + ' / ' + k('Ctrl 0')) +
      row(t('Eksportér til PDF'), k('Ctrl+P')) +
      row(t('Hjælp'), k('F1')) + '</table></div>';
  }
  async function showHtml(title, html) {
    const b = document.createElement('div'); b.innerHTML = html;
    b.addEventListener('click', (e) => { const a = e.target.closest('a'); if (a) { e.preventDefault(); api.openExternal && api.openExternal(a.getAttribute('href')); } });
    await modal({ title, body: b, wide: true, buttons: [{ text: t('Luk'), primary: true }] });
  }
  const cmdHelp = () => showHtml(t('Hjælp') + ' – MarkNote', helpHtml());
  const cmdShortcuts = () => showHtml(t('Genveje og Markdown-syntaks'), shortcutsHtml());
  const cmdContact = () => showHtml(t('Kontakt'), '<div class="help"><p>' + contactHtml() + '</p></div>');
  document.addEventListener('click', (e) => { const a = e.target.closest('.maillink'); if (a) { e.preventDefault(); api.openExternal && api.openExternal(a.getAttribute('href')); } });

  /* ---------- tilstande, temaer, bånd ---------- */
  const mode = () => state.mode;
  function setMode(m) {
    state.mode = m; store.set('mode', m);
    workspace.className = 'mode-' + m;
    preview.contentEditable = m !== 'raw' ? 'true' : 'false';
    preview.spellcheck = m !== 'raw';
    $$('[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === m));
    if (m !== 'raw') renderPreview();
    if (m === 'read') { lastPane = 'preview'; preview.focus(); } else if (m === 'split') { lastPane = 'ed'; ed.focus(); } else ed.focus();
  }
  function setTheme(t) {
    state.theme = t; store.set('theme', t);
    document.documentElement.dataset.theme = t;
    $$('[data-set-theme]').forEach((b) => b.classList.toggle('on', b.dataset.setTheme === t));
    if (api.setOverlay) {
      const cs = getComputedStyle(document.documentElement);
      api.setOverlay({ color: cs.getPropertyValue('--chrome').trim() || '#2b579a', symbol: cs.getPropertyValue('--chrome-text').trim() || '#ffffff' });
    }
  }
  function setZoom(z) {
    z = Math.min(200, Math.max(60, z));
    workspace.style.setProperty('--zoom', z / 100);
    $('#zoom').value = $('#zoom2').value = z;
    $('#zoomVal').textContent = $('#zoomVal2').textContent = z + ' %';
    store.set('zoom', z);
  }
  function setFont() {
    const f = $('#fontFamily').value, s = $('#fontSize').value;
    const root = document.documentElement.style;
    root.setProperty('--doc-font', `"${f}", "Segoe UI", sans-serif`);
    if (f === 'Segoe UI') root.removeProperty('--head-font'); else root.setProperty('--head-font', `"${f}", sans-serif`);
    root.setProperty('--doc-size', s + 'px'); root.setProperty('--ed-size', s + 'px');
    store.set('font', f); store.set('size', s);
  }
  function showTab(name) {
    $$('.tab[data-tab]').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
    $$('.panel').forEach((p) => (p.hidden = p.dataset.panel !== name));
    if (name === 'file') loadRecent();
    store.set('tab', name);
  }
  function toggleRibbon(force) {
    const r = $('#ribbon');
    const c = force === undefined ? !r.classList.contains('collapsed') : force;
    r.classList.toggle('collapsed', c);
    $('#collapseBtn').innerHTML = WDicon(c ? 'chevup' : 'chevup');
    $('#collapseBtn svg').style.transform = c ? 'rotate(180deg)' : '';
    store.set('collapsed', c);
  }
  async function loadRecent() {
    const box = $('#recentList');
    const list = (await api.recent && await api.recent()) || [];
    box.innerHTML = '';
    if (!list.length) { box.innerHTML = '<span class="muted">Ingen seneste filer</span>'; return; }
    for (const p of list.slice(0, 8)) {
      const b = document.createElement('button'); b.textContent = p; b.title = p;
      b.onclick = () => openPath(p);
      box.append(b);
    }
  }

  /* ---------- navigationsrude ---------- */
  function buildNav() {
    if ($('#nav').hidden) return;
    const items = md.outline(ed.value);
    const list = $('#navList'); list.innerHTML = '';
    if (!items.length) { list.innerHTML = ''; { const d = document.createElement('div'); d.className = 'empty'; d.textContent = t('Ingen overskrifter'); list.append(d); }; return; }
    items.forEach((it, idx) => {
      const a = document.createElement('a'); a.href = '#'; a.textContent = it.text || t('(tom)');
      a.style.paddingLeft = 12 + (it.level - 1) * 14 + 'px'; a.style.fontWeight = it.level <= 2 ? '600' : '400';
      a.onclick = (e) => {
        e.preventDefault();
        if (state.mode !== 'read') { ed.focus(); ed.setSelectionRange(it.pos, it.pos); ed.blur(); ed.focus(); }
        const hs = $$('h1,h2,h3,h4,h5,h6', preview);
        if (hs[idx] && state.mode !== 'raw') hs[idx].scrollIntoView({ block: 'start' });
      };
      list.append(a);
    });
  }

  /* ---------- find og erstat ---------- */
  const fi = $('#findIn');
  function reFind() {
    let s = fi.value; if (!s) return null;
    if (!$('#fRegex').checked) s = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if ($('#fWord').checked) s = '\\b' + s + '\\b';
    try { return new RegExp(s, 'gm' + ($('#fCase').checked ? '' : 'i')); } catch (_) { return false; }
  }
  function matches() {
    const re = reFind(); if (!re) return re;
    const out = []; let m; const v = ed.value;
    while ((m = re.exec(v)) && out.length < 50000) { if (m[0] === '') { re.lastIndex++; continue; } out.push({ i: m.index, len: m[0].length }); }
    return out;
  }
  function updateCount() {
    const m = matches();
    $('#fCount').textContent = m === false ? t('Ugyldigt udtryk') : m ? (m.length ? t('{0} fundet', m.length) : t('Ingen resultater')) : '';
    return m;
  }
  function ensureSource() { if (state.mode === 'read') setMode('split'); }
  function goto(m) {
    ensureSource();
    ed.focus(); ed.setSelectionRange(m.i, m.i + m.len); ed.blur(); ed.focus(); updatePos();
  }
  function findNext(dir = 1) {
    if (!fi.value) { openFind(false); return; }
    const m = updateCount(); if (!m || !m.length) return;
    const a = ed.selectionStart, b = ed.selectionEnd;
    let t;
    if (dir > 0) t = m.find((x) => x.i >= b) || m[0];
    else t = [...m].reverse().find((x) => x.i < a) || m[m.length - 1];
    goto(t);
  }
  function openFind(withReplace) {
    ensureSource();
    $('#findbar').hidden = false; $('#replaceRow').hidden = !withReplace;
    const sel = ed.value.slice(ed.selectionStart, ed.selectionEnd);
    if (sel && !sel.includes('\n')) fi.value = sel;
    fi.focus(); fi.select(); updateCount();
  }
  function closeFind() { $('#findbar').hidden = true; ed.focus(); }
  function replaceOne() {
    const re = reFind(); if (!re) return;
    const a = ed.selectionStart, b = ed.selectionEnd, sel = ed.value.slice(a, b);
    const one = new RegExp(re.source, re.flags.replace('g', ''));
    const mm = one.exec(sel);
    if (mm && mm[0] === sel && sel) {
      const rep = $('#fRegex').checked ? sel.replace(one, $('#replIn').value) : $('#replIn').value;
      replaceRange(a, b, rep, a, a + rep.length);
    }
    findNext(1);
  }
  function replaceAll() {
    const re = reFind(); if (!re) return;
    const m = matches(); if (!m || !m.length) return;
    const rv = $('#replIn').value;
    const next = ed.value.replace(re, $('#fRegex').checked ? rv : () => rv);
    ed.focus(); ed.select(); exec(next); ed.setSelectionRange(0, 0);
    toast(t('{0} forekomster erstattet', m.length)); updateCount();
  }
  fi.addEventListener('input', updateCount);
  fi.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); findNext(e.shiftKey ? -1 : 1); } });
  $('#replIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); replaceOne(); } });
  ['fRegex', 'fCase', 'fWord'].forEach((id) => $('#' + id).addEventListener('change', updateCount));
  $('#fNext').onclick = () => findNext(1); $('#fPrev').onclick = () => findNext(-1);
  $('#fRepl').onclick = replaceOne; $('#fReplAll').onclick = replaceAll; $('#fClose').onclick = closeFind;

  /* ---------- eksport ---------- */
  async function doExport(kind) {
    const html = renderHtml(false, false);
    const r = await api.exportAs({
      kind, md: ed.value, html, title: state.path ? docName().replace(/\.[^.]+$/, '') : state.untitled,
      docPath: state.path || state.virtual, math: html.includes('class="katex'),
      fontFamily: getComputedStyle(document.documentElement).getPropertyValue('--doc-font').trim() || null,
      fontSize: parseInt($('#fontSize').value, 10),
    });
    if (!r) return;
    if (r.error) toast(t('Eksport mislykkedes: {0}', r.error), 6000); else toast(t('Eksporteret: {0}', r.path.split(/[\\/]/).pop()), 3500);
  }

  /* ---------- WYSIWYG ---------- */
  const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-', emDelimiter: '*', strongDelimiter: '**', hr: '---' });
  if (window.turndownPluginGfm) td.use(turndownPluginGfm.gfm);
  td.addRule('strike', { filter: ['del', 's', 'strike'], replacement: (c) => '~~' + c + '~~' });
  td.addRule('li', { filter: 'li', replacement: (content, node) => {
    content = content.replace(/^\n+/, '').replace(/^(\[[ xX]\])\s+/, '$1 ').replace(/\n+$/, '\n').replace(/\n/gm, '\n  ');
    const par = node.parentNode;
    const pre = par.nodeName === 'OL' ? (Number(par.getAttribute('start') || 1) + Array.prototype.indexOf.call(par.children, node)) + '. ' : '- ';
    return pre + content.replace(/\n  /g, '\n' + ' '.repeat(pre.length)).replace(/ +$/gm, '') + (node.nextSibling && !/\n$/.test(content) ? '\n' : '');
  } });
  td.addRule('mark', { filter: 'mark', replacement: (c) => '==' + c + '==' });
  td.addRule('mathInline', { filter: (n) => n.nodeName === 'SPAN' && n.classList.contains('wd-math'), replacement: (_c, n) => '$' + n.getAttribute('data-tex') + '$' });
  td.addRule('mathBlock', { filter: (n) => n.nodeName === 'DIV' && n.classList.contains('math-block'), replacement: (_c, n) => '\n\n$$\n' + n.getAttribute('data-tex') + '\n$$\n\n' });
  td.addRule('fnref', { filter: (n) => n.nodeName === 'SUP' && n.classList.contains('fnref'), replacement: (_c, n) => '[^' + n.getAttribute('data-fn') + ']' });
  td.addRule('fnsection', { filter: (n) => n.nodeName === 'SECTION' && n.classList.contains('footnotes'), replacement: () => '' });
  td.addRule('comment', { filter: (n) => n.nodeName === 'SPAN' && n.classList.contains('md-comment'), replacement: (_c, n) => '\n\n<!-- ' + n.textContent.trim() + ' -->\n\n' });
  td.addRule('img', { filter: 'img', replacement: (_c, n) => {
    const src = n.getAttribute('data-src') || n.getAttribute('src') || '';
    return '![' + (n.getAttribute('alt') || '') + '](' + (/\s/.test(src) ? '<' + src + '>' : src) + ')';
  } });
  function toMarkdown() {
    const defs = (ed.value.replace(/\r\n?/g, '\n').match(/^\[\^[^\]\s]+\]:.*(?:\n(?: {2,}|\t).*)*/gm) || []).join('\n');
    let out = td.turndown(preview).replace(/​/g, '').replace(/\n{3,}/g, '\n\n').trim();
    if (defs) out += '\n\n' + defs;
    return out ? out + '\n' : '';
  }
  let wT = 0;
  function wysiwygSync() {
    clearTimeout(wT);
    wT = setTimeout(() => {
      ed.value = toMarkdown();
      hl.innerHTML = highlight(ed.value);
      updateDirty(); updateStats(); buildNav();
    }, 150);
  }
  preview.addEventListener('input', () => { if (rich()) wysiwygSync(); });
  preview.addEventListener('change', (e) => {
    if (rich() && e.target.type === 'checkbox') { e.target.toggleAttribute('checked', e.target.checked); wysiwygSync(); }
  });
  preview.addEventListener('paste', (e) => {
    if (!rich()) return;
    e.preventDefault();
    const t = e.clipboardData.getData('text/plain');
    if (t) document.execCommand('insertText', false, t);
  });
  let lastRange = null;
  document.addEventListener('selectionchange', () => {
    if (!rich()) return;
    const sel = getSelection();
    if (!sel.rangeCount || !preview.contains(sel.anchorNode)) return;
    lastRange = sel.getRangeAt(0).cloneRange();
    const h = sel.anchorNode.nodeType === 1 ? sel.anchorNode.closest('h1,h2,h3,h4,h5,h6') : sel.anchorNode.parentElement && sel.anchorNode.parentElement.closest('h1,h2,h3,h4,h5,h6');
    $('#headingSel').value = h ? h.tagName[1] : '0';
  });
  function restoreRange() {
    preview.focus();
    if (lastRange) { const s = getSelection(); s.removeAllRanges(); s.addRange(lastRange); }
  }
  const wex = (c, v) => { preview.focus(); document.execCommand(c, false, v); };
  const wsel = () => String(getSelection());
  const wins = (h) => wex('insertHTML', h);
  const wdisp = (src) => { if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(src) || !docBase()) return src; try { return new URL(src, docBase()).href; } catch (_) { return src; } };
  const W = {
    undo: () => wex('undo'), redo: () => wex('redo'),
    bold: () => wex('bold'), italic: () => wex('italic'), strike: () => wex('strikeThrough'),
    highlight: () => {
      const s = getSelection(); const mk = s.anchorNode && (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement).closest('mark');
      if (mk) { mk.replaceWith(...mk.childNodes); wysiwygSync(); } else wins('<mark>' + esc(wsel() || t('tekst')) + '</mark>');
    },
    ul: () => wex('insertUnorderedList'), ol: () => wex('insertOrderedList'),
    task: () => wins('<ul><li><input type="checkbox"> ' + esc(wsel() || t('Opgave')) + '</li></ul>'),
    indent: () => wex('indent'), outdent: () => wex('outdent'),
    quote: () => wex('formatBlock', 'blockquote'),
    code: () => wins('<code>' + esc(wsel() || t('kode')) + '</code>'),
    codeblock: () => wins('<pre><code>' + esc(wsel() || 'kode') + '</code></pre><p><br></p>'),
    hr: () => wex('insertHorizontalRule'),
    math: () => wins('<span class="wd-math" data-tex="' + esc(wsel() || 'E = mc^2') + '" contenteditable="false">' + md.math(wsel() || 'E = mc^2', false) + '</span>&nbsp;'),
    mathblock: () => wins('<div class="math-block" data-tex="E = mc^2" contenteditable="false">' + md.math('E = mc^2', true) + '</div><p><br></p>'),
    link: async () => {
      const sel = wsel(); const saved = lastRange;
      const r = await ask({ title: t('Indsæt link'), fields: [{ id: 'text', label: t('Tekst der vises'), value: sel }, { id: 'url', label: t('Adresse (URL)'), value: 'https://' }] });
      lastRange = saved; restoreRange();
      if (!r) return;
      if (sel) wex('createLink', r.url); else wins('<a href="' + esc(r.url) + '">' + esc(r.text || r.url) + '</a>');
    },
    image: async (preset) => {
      const saved = lastRange;
      const r = await ask({ title: t('Indsæt billede'), fields: [{ id: 'src', label: t('Billedsti eller URL'), value: preset || '', browse: true }, { id: 'alt', label: t('Alternativ tekst'), value: '' }] });
      lastRange = saved; restoreRange();
      if (!r || !r.src) return;
      const alt = r.alt || decodeURI(r.src.split('/').pop().replace(/\.[^.]+$/, ''));
      wins('<img src="' + esc(wdisp(r.src)) + '" data-src="' + esc(r.src) + '" alt="' + esc(alt) + '">');
    },
    table: async () => {
      const saved = lastRange;
      const r = await tableDialog();
      lastRange = saved; restoreRange();
      if (!r) return;
      const cells = (tag, f) => '<tr>' + Array.from({ length: r.cols }, (_, i) => '<' + tag + (r.align !== 'none' ? ' align="' + r.align + '"' : '') + '>' + f(i) + '</' + tag + '>').join('') + '</tr>';
      wins('<table><thead>' + cells('th', (i) => t('Kolonne') + ' ' + (i + 1)) + '</thead><tbody>' + Array.from({ length: r.rows }, () => cells('td', () => '')).join('') + '</tbody></table><p><br></p>');
    },
    comment: async () => {
      const saved = lastRange;
      const r = await ask({ title: t('Indsæt kommentar'), fields: [{ id: 'text', label: t('Kommentar (usynlig i eksport)'), value: wsel() }] });
      lastRange = saved; restoreRange();
      if (r && r.text) wins('<span class="md-comment">' + esc(r.text) + '</span>');
    },
  };
  preview.addEventListener('dblclick', async (e) => {
    if (!rich()) return;
    const m = e.target.closest('.wd-math, .math-block'); if (!m) return;
    const r = await ask({ title: t('Rediger formel (LaTeX)'), fields: [{ id: 'tex', label: 'LaTeX', value: m.getAttribute('data-tex') }] });
    if (!r || !r.tex) return;
    m.setAttribute('data-tex', r.tex);
    m.innerHTML = md.math(r.tex, m.classList.contains('math-block'));
    wysiwygSync();
  });

  /* ---------- kommandoer ---------- */
  const EDIT_CMDS = new Set(['bold', 'italic', 'strike', 'highlight', 'ul', 'ol', 'task', 'indent', 'outdent', 'quote', 'code', 'codeblock', 'table', 'image', 'link', 'footnote', 'comment', 'math', 'mathblock', 'hr', 'undo', 'redo']);
  const CMDS = {
    new: cmdNew, open: cmdOpen, save: () => save(false), saveAs: () => save(true),
    reveal: () => state.path ? api.showInFolder(state.path) : toast(t('Dokumentet er ikke gemt endnu')),
    about: cmdAbout, help: cmdHelp, shortcuts: cmdShortcuts, contact: cmdContact,
    undo: () => { ed.focus(); document.execCommand('undo'); onChange(); },
    redo: () => { ed.focus(); document.execCommand('redo'); onChange(); },
    bold: () => wrap('**'), italic: () => wrap('*'), strike: () => wrap('~~'), highlight: () => wrap('=='),
    code: () => wrap('`', '`', t('kode')), codeblock: codeBlock,
    ul: () => setList('ul'), ol: () => setList('ol'), task: () => setList('task'),
    indent: () => indentLines(1), outdent: () => indentLines(-1), quote: setQuote,
    table: cmdTable, image: () => cmdImage(), link: cmdLink, footnote, comment,
    math: () => wrap('$', '$', 'E = mc^2'),
    mathblock: () => { const s = ed.value.slice(ed.selectionStart, ed.selectionEnd); insertBlock('$$\n' + (s || 'E = mc^2') + '\n$$'); },
    hr: () => insertBlock('---'),
    toggleRibbon: () => toggleRibbon(),
    exportPdf: () => doExport('pdf'), exportDocx: () => doExport('docx'), exportHtml: () => doExport('html'), exportMd: () => doExport('md'),
    history: cmdHistory, snapshot: () => snapshot(false),
    find: () => openFind(false), replace: () => openFind(true),
  };
  function run(cmd) {
    if (!CMDS[cmd]) return;
    if (richTarget() && EDIT_CMDS.has(cmd)) {
      if (W[cmd]) return W[cmd]();
      toast(t('Skift til Live preview for at bruge denne funktion'));
      return;
    }
    return CMDS[cmd]();
  }

  document.addEventListener('mousedown', (e) => {
    if (e.target.closest('.rb, .qb, .tab, .sb, .fb') && !e.target.closest('select,input')) e.preventDefault();
  });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cmd]'); if (b) return run(b.dataset.cmd);
    const m = e.target.closest('[data-mode]'); if (m) return setMode(m.dataset.mode);
    const t = e.target.closest('[data-set-theme]'); if (t) return setTheme(t.dataset.setTheme);
    const tab = e.target.closest('.tab[data-tab]');
    if (tab) { if ($('#ribbon').classList.contains('collapsed')) toggleRibbon(false); showTab(tab.dataset.tab); }
  });
  function applyHeading(n) {
    if (richTarget()) { restoreRange(); wex('formatBlock', n ? 'h' + n : 'p'); preview.focus(); return; }
    setHeading(n);
  }
  $('#headingSel').addEventListener('change', (e) => applyHeading(+e.target.value));
  $('#fontFamily').addEventListener('change', () => { setFont(); ed.focus(); });
  $('#fontSize').addEventListener('change', () => { setFont(); ed.focus(); });
  $('#optNav').addEventListener('change', (e) => { $('#nav').hidden = !e.target.checked; store.set('nav', e.target.checked); buildNav(); });
  $('#optSync').addEventListener('change', (e) => store.set('sync', e.target.checked));
  $('#zoom').addEventListener('input', (e) => setZoom(+e.target.value));
  $('#zoom2').addEventListener('input', (e) => setZoom(+e.target.value));

  /* ---------- tastatur ---------- */
  document.addEventListener('keydown', (e) => {
    const k = e.key, c = e.ctrlKey || e.metaKey;
    if (k === 'F1' && c) { e.preventDefault(); return toggleRibbon(); }
    if (k === 'F1' && !c) { e.preventDefault(); return cmdHelp(); }
    if (k === 'F3') { e.preventDefault(); return findNext(e.shiftKey ? -1 : 1); }
    if (k === 'Escape' && !$('#findbar').hidden) { return closeFind(); }
    if (!c) return;
    const key = k.toLowerCase();
    const code = e.code;
    const go = (fn) => { e.preventDefault(); fn(); };
    if (e.altKey && /^Digit[0-6]$/.test(code)) return go(() => applyHeading(+code.slice(5)));
    if (e.altKey && key === 'f') return go(() => run('footnote'));
    if (e.altKey && key === 'm') return go(() => run('comment'));
    if (key === 'tab' || code === 'PageDown' || code === 'PageUp') { return go(() => switchBy(key === 'tab' ? (e.shiftKey ? -1 : 1) : code === 'PageUp' ? -1 : 1)); }
    if (e.shiftKey) {
      if (code === 'Digit7') return go(() => run('ol'));
      if (code === 'Digit8') return go(() => run('ul'));
      if (code === 'Digit9') return go(() => run('task'));
      if (key === 's') return go(() => run('saveAs'));
      if (key === 'x') return go(() => run('strike'));
      if (key === 'h') return go(() => run('highlight'));
      if (key === 'q') return go(() => run('quote'));
      if (key === 'e') return go(() => run('codeblock'));
      return;
    }
    switch (key) {
      case 'n': return go(() => run('new'));
      case 'w': return go(() => closeTab(curId));
      case 'o': return go(() => run('open'));
      case 's': return go(() => run('save'));
      case 'b': return go(() => run('bold'));
      case 'i': return go(() => run('italic'));
      case 'k': return go(() => run('link'));
      case 'e': return go(() => run('code'));
      case 'f': return go(() => run('find'));
      case 'h': return go(() => run('replace'));
      case '=': case '+': return go(() => setZoom(+$('#zoom').value + 10));
      case '-': return go(() => setZoom(+$('#zoom').value - 10));
      case '0': return go(() => setZoom(100));
      case 'p': return go(() => run('exportPdf'));
    }
  }, true);

  ed.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && !e.ctrlKey) { e.preventDefault(); indentLines(e.shiftKey ? -1 : 1); return; }
    if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey && !e.altKey && ed.selectionStart === ed.selectionEnd) {
      const v = ed.value, pos = ed.selectionStart;
      const ls = v.lastIndexOf('\n', pos - 1) + 1;
      const before = v.slice(ls, pos);
      const lm = /^(\s*)(?:([-*+])|(\d+)([.)]))(\s+)(\[[ xX]\]\s+)?/.exec(before);
      const qm = !lm && /^(\s*(?:>\s?)+)/.exec(before);
      if (lm || qm) {
        e.preventDefault();
        if (lm && before.length === lm[0].length) return replaceRange(ls, pos, '', ls); // tomt punkt: afslut liste
        if (qm && before === qm[0] && !before.trim().replace(/>/g, '')) return replaceRange(ls, pos, '', ls);
        const marker = lm ? lm[1] + (lm[2] ? lm[2] : (+lm[3] + 1) + lm[4]) + lm[5] + (lm[6] ? '[ ] ' : '') : qm[1];
        exec('\n' + marker);
      }
    }
  });

  /* ---------- træk og slip ---------- */
  let dragN = 0;
  window.addEventListener('dragenter', (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { dragN++; document.body.classList.add('dropping'); } });
  window.addEventListener('dragleave', () => { if (--dragN <= 0) { dragN = 0; document.body.classList.remove('dropping'); } });
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', async (e) => {
    e.preventDefault(); dragN = 0; document.body.classList.remove('dropping');
    const files = [...(e.dataTransfer ? e.dataTransfer.files : [])];
    for (const f of files) {
      const p = api.pathForFile ? api.pathForFile(f) : '';
      if (!p) continue;
      if (/\.(md|markdown|mdown|mkd|txt|docx|html?)$/i.test(p)) { await openPath(p); break; }
      if (/\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(p)) {
        const rel = await api.imageRel(p, state.path || state.virtual);
        if (rel) await cmdImage(rel);
      }
    }
  });
  ed.addEventListener('paste', (e) => {
    const t = e.clipboardData && e.clipboardData.getData('text/plain');
    if (t && /^https?:\/\/\S+$/.test(t.trim()) && ed.selectionStart !== ed.selectionEnd) {
      e.preventDefault();
      const a = ed.selectionStart, b = ed.selectionEnd;
      replaceRange(a, b, `[${ed.value.slice(a, b)}](${t.trim()})`);
    }
  });
  window.addEventListener('wheel', (e) => { if (e.ctrlKey) { e.preventDefault(); setZoom(+$('#zoom').value + (e.deltaY < 0 ? 10 : -10)); } }, { passive: false });

  /* ---------- værktøjstips ---------- */
  const tip = $('#tip');
  let tipT = 0;
  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest('[data-tip]');
    clearTimeout(tipT);
    if (!el) { tip.hidden = true; return; }
    tipT = setTimeout(() => {
      const first = el.dataset.tip.indexOf('|');
      const second = first < 0 ? -1 : el.dataset.tip.indexOf('|', first + 1);
      const parts = first < 0 ? [el.dataset.tip] : second < 0 ? [el.dataset.tip.slice(0, first), el.dataset.tip.slice(first + 1)] : [el.dataset.tip.slice(0, first), el.dataset.tip.slice(first + 1, second), el.dataset.tip.slice(second + 1)];
      tip.innerHTML = '';
      const tt = document.createElement('b'); tt.textContent = t(parts[0]); tip.append(tt);
      if (parts[1]) { const k = document.createElement('div'); k.className = 'k'; k.textContent = t(parts[1]); tip.append(k); }
      if (parts[2]) { const d = document.createElement('div'); d.append('Markdown: '); const c = document.createElement('code'); c.textContent = parts[2]; d.append(c); tip.append(d); }
      tip.hidden = false;
      const r = el.getBoundingClientRect(), w = tip.offsetWidth;
      tip.style.left = Math.max(6, Math.min(innerWidth - w - 6, r.left)) + 'px';
      tip.style.top = Math.min(innerHeight - tip.offsetHeight - 6, r.bottom + 6) + 'px';
    }, 450);
  });
  document.addEventListener('mousedown', () => { tip.hidden = true; clearTimeout(tipT); });

  /* ---------- sprog ---------- */
  const I18N = window.WDi18n;
  const sysLang = I18N.detect(api.systemLocale || navigator.language);
  const resolveLang = (pref) => (pref === 'auto' ? sysLang : I18N.LANGS[pref] ? pref : sysLang);
  function fillLangSel() {
    const pref = store.get('lang', 'auto');
    for (const sel of [$('#langSel'), $('#langSel2')]) {
      sel.innerHTML = '';
      sel.add(new Option(t('Automatisk (Windows)') + ' – ' + I18N.LANGS[sysLang], 'auto'));
      for (const [c, n] of Object.entries(I18N.LANGS)) sel.add(new Option(n, c));
      sel.value = pref;
    }
  }
  function applyLanguage(pref) {
    store.set('lang', pref);
    const code = I18N.setLang(resolveLang(pref));
    document.body.dataset.drop = t('Slip filen for at åbne / indsætte');
    $('#ed').lang = code;
    $('#langSel').title = t('Sprog');
    fillLangSel();
    $('#contactLine').innerHTML = t('Spørgsmål om programmet? Kontakt <b>Martin Piffet</b>:') + '<br><a href="https://github.com/Cphmartinus/marknote/issues" class="maillink">GitHub Issues</a>';
    api.setLang && api.setLang({ spell: I18N.SPELL[code], lang: code, strings: {
      openTitle: t('Åbn dokument'), saveTitle: t('Gem dokument'), filterAll: t('Alle filer'), exportTitle: t('Eksportér'),
      imageTitle: t('Indsæt billede'), imageFilter: t('Billeder') } });
    if (typeof docs !== 'undefined') {
      for (const d of docs) if (d.untitledNo != null && !d.path) d.untitled = t('Dokument') + ' ' + d.untitledNo;
      if (state.untitledNo != null && !state.path) state.untitled = t('Dokument') + ' ' + state.untitledNo;
      const wasWelcome = !state.path && !state.virtual && ed.value === WELCOME && state.saved === WELCOME;
      WELCOME = welcomeText();
      if (wasWelcome) { const sel = [ed.selectionStart, ed.selectionEnd]; loadDoc(WELCOME, null); try { ed.setSelectionRange(0, 0); } catch (_) {} }
      updateStats(); updatePos(); updateDirty(); buildNav();
    }
  }
  const onLangPick = (e) => { applyLanguage(e.target.value); $('#langSel').value = $('#langSel2').value = e.target.value; };
  $('#langSel').addEventListener('change', onLangPick);
  $('#langSel2').addEventListener('change', onLangPick);
  I18N.setLang(resolveLang(store.get('lang', 'auto')));

  /* ---------- start ---------- */
  $('#fontFamily').value = store.get('font', 'Segoe UI');
  $('#fontSize').value = store.get('size', '14');
  setFont();
  setTheme(store.get('theme', 'light'));
  setZoom(store.get('zoom', 100));
  $('#optSync').checked = store.get('sync', true);
  $('#optNav').checked = store.get('nav', false);
  $('#nav').hidden = !$('#optNav').checked;
  showTab(store.get('tab', 'home') === 'file' ? 'home' : store.get('tab', 'home'));
  if (store.get('collapsed', false)) toggleRibbon(true);

  const welcomeText = () => '# ' + t('Velkommen til MarkNote') + '\n\n' + t('Skriv **Markdown** til venstre – og se resultatet med det samme til højre. Brug båndet foroven, som du kender det fra Word.') + '\n\n## ' + t('Prøv det her') + '\n\n' +
    '- ' + t('Marker tekst og tryk **Ctrl+B** for fed, **Ctrl+I** for kursiv') + '\n- ' + t('==Fremhævning==, ~~gennemstreget~~ og `indlejret kode`') + '\n- [x] ' + t('Tjeklister understøttes') + '\n- [ ] ' + t('Skift tilstand under fanen *Visning*') + '\n\n> ' +
    t('Dokumenter gemmes som helt almindelige `.md`-filer – ingen låste formater.') + '\n\n| ' + t('Funktion') + ' | ' + t('Genvej') + ' |\n| --- | :---: |\n| ' + t('Skjul båndet') + ' | Ctrl+F1 |\n| ' + t('Find og erstat') + ' | Ctrl+F / Ctrl+H |\n\n' +
    t('Formler: $E = mc^2$ og fodnoter[^1] virker også.') + '\n\n[^1]: ' + t('Eksportér til PDF, DOCX og HTML under fanen *Eksport & Værktøjer*.') + '\n';
  let WELCOME = '';
  setMode(['raw', 'split', 'read'].includes(store.get('mode', 'split')) ? store.get('mode', 'split') : 'split');
  { const d0 = newDoc(); docs.push(d0); curId = d0.id; state.untitled = d0.untitled; state.untitledNo = d0.untitledNo; }
  WELCOME = welcomeText();
  loadDoc(WELCOME, null);
  state.lastSnap = WELCOME;
  updateDirty();
  ed.setSelectionRange(0, 0);
  ed.focus();
  applyLanguage(store.get('lang', 'auto'));
  window.__wd = { applyLanguage, ed, state, setMode, setTheme, run, loadDoc, applyOpened };
})();
