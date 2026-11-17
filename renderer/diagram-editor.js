/* MarkNote – visuel diagrameditor. Genererer og læser et enkelt udsnit af Mermaid-syntaksen. */
(function () {
  'use strict';

  /* ---------------- Mermaid: generering og fortolkning ---------------- */
  const SHAPES = { box: ['["', '"]'], round: ['("', '")'], decision: ['{"', '"}'], stadium: ['(["', '"])'], circle: ['(("', '"))'] };
  const COLORS = {
    blue: 'fill:#dbe7f7,stroke:#2b579a,color:#1b1f27',
    green: 'fill:#e2f0d9,stroke:#548235,color:#1b1f27',
    yellow: 'fill:#fff2cc,stroke:#bf9000,color:#1b1f27',
    red: 'fill:#fbe0e0,stroke:#c0392b,color:#1b1f27',
    gray: 'fill:#ededed,stroke:#7f7f7f,color:#1b1f27',
  };
  const EDGES = { arrow: '-->', dotted: '-.->', thick: '==>', line: '---' };
  const DIRS = ['LR', 'TD', 'RL', 'BT'];
  const q = (s) => String(s == null ? '' : s).replace(/"/g, '#quot;').replace(/[\r\n]+/g, ' ').trim();
  const uq = (s) => String(s == null ? '' : s).replace(/#quot;/g, '"');
  const plain = (s) => String(s == null ? '' : s).replace(/[\r\n]+/g, ' ').trim();

  function genFlow(m) {
    const out = ['flowchart ' + (DIRS.includes(m.dir) ? m.dir : 'LR')];
    for (const n of m.nodes) { const s = SHAPES[n.shape] || SHAPES.box; out.push('  ' + n.id + s[0] + q(n.text) + s[1]); }
    for (const e of m.edges) {
      if (!e.from || !e.to) continue;
      const op = EDGES[e.type] || EDGES.arrow;
      out.push('  ' + e.from + ' ' + op + (plain(e.text) ? '|"' + q(e.text) + '"|' : '') + ' ' + e.to);
    }
    const used = [...new Set(m.nodes.map((n) => n.color).filter((c) => COLORS[c]))];
    for (const c of used) out.push('  classDef ' + c + ' ' + COLORS[c]);
    for (const c of used) out.push('  class ' + m.nodes.filter((n) => n.color === c).map((n) => n.id).join(',') + ' ' + c);
    return out.join('\n');
  }
  const NODE_RE = /^([A-Za-z_][\w]*)(?:\(\["?(.*?)"?\]\)|\(\("?(.*?)"?\)\)|\["?(.*?)"?\]|\("?(.*?)"?\)|\{"?(.*?)"?\})?/;
  const EDGE_RE = /^\s*(-->|-\.->|==>|---)\s*(?:\|"?(.*?)"?\|)?\s*/;
  function parseFlow(code) {
    const lines = code.split('\n').map((l) => l.replace(/;\s*$/, '').trim()).filter((l) => l && !l.startsWith('%%'));
    const head = /^(flowchart|graph)\s+(TB|TD|BT|RL|LR)$/i.exec(lines.shift() || '');
    if (!head) return null;
    const m = { dir: head[2].toUpperCase() === 'TB' ? 'TD' : head[2].toUpperCase(), nodes: [], edges: [] };
    const byId = {};
    const classDefs = {};
    const node = (id, shape, text) => {
      let n = byId[id];
      if (!n) { n = byId[id] = { id, text: id, shape: 'box', color: 'none' }; m.nodes.push(n); }
      if (shape) { n.shape = shape; n.text = uq(text); }
      return n;
    };
    const readNode = (s) => {
      const r = NODE_RE.exec(s); if (!r) return null;
      let shape = null, text = null;
      if (r[2] !== undefined) { shape = 'stadium'; text = r[2]; }
      else if (r[3] !== undefined) { shape = 'circle'; text = r[3]; }
      else if (r[4] !== undefined) { shape = 'box'; text = r[4]; }
      else if (r[5] !== undefined) { shape = 'round'; text = r[5]; }
      else if (r[6] !== undefined) { shape = 'decision'; text = r[6]; }
      node(r[1], shape, text);
      return { id: r[1], rest: s.slice(r[0].length) };
    };
    for (const line of lines) {
      let r;
      if ((r = /^classDef\s+(\w+)\s+(.+)$/.exec(line))) {
        const key = Object.keys(COLORS).find((k) => COLORS[k] === r[2].replace(/\s+/g, ''));
        if (!key) return null;
        classDefs[r[1]] = key; continue;
      }
      if ((r = /^class\s+([\w,\s]+?)\s+(\w+)$/.exec(line))) {
        const color = classDefs[r[2]]; if (!color) return null;
        for (const id of r[1].split(',').map((x) => x.trim()).filter(Boolean)) node(id).color = color;
        continue;
      }
      let cur = readNode(line); if (!cur) return null;
      let rest = cur.rest;
      while (rest.trim()) {
        const e = EDGE_RE.exec(rest); if (!e) return null;
        const next = readNode(rest.slice(e[0].length)); if (!next) return null;
        const type = Object.keys(EDGES).find((k) => EDGES[k] === e[1]);
        m.edges.push({ from: cur.id, to: next.id, type, text: uq(e[2] || '') });
        cur = next; rest = next.rest;
      }
    }
    return m;
  }

  function genSeq(m) {
    const out = ['sequenceDiagram'];
    for (const p of m.parts) out.push('  participant ' + p.id + ' as ' + (plain(p.text) || p.id));
    for (const x of m.msgs) {
      if (!x.from || !x.to) continue;
      out.push('  ' + x.from + (x.reply ? '-->>' : '->>') + x.to + ': ' + (plain(x.text).replace(/[;#]/g, ' ') || ' '));
    }
    return out.join('\n');
  }
  function parseSeq(code) {
    const lines = code.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('%%'));
    if (!/^sequenceDiagram$/.test(lines.shift() || '')) return null;
    const m = { parts: [], msgs: [] }; const byId = {};
    const part = (id, text) => { let p = byId[id]; if (!p) { p = byId[id] = { id, text: id }; m.parts.push(p); } if (text) p.text = text; return p; };
    for (const line of lines) {
      let r;
      if ((r = /^(participant|actor)\s+(\w+)(?:\s+as\s+(.+))?$/.exec(line))) { part(r[2], r[3]); continue; }
      if ((r = /^(\w+)\s*(->>|-->>|->|-->)\s*(\w+)\s*:\s*(.*)$/.exec(line))) {
        part(r[1]); part(r[3]);
        m.msgs.push({ from: r[1], to: r[3], text: r[4], reply: r[2].startsWith('--') });
        continue;
      }
      return null;
    }
    return m;
  }

  function genPie(m) {
    const out = ['pie' + (plain(m.title) ? ' title ' + plain(m.title) : '')];
    for (const r of m.rows) { const v = parseFloat(r.value); if (plain(r.text) && isFinite(v)) out.push('  "' + plain(r.text).replace(/"/g, "'") + '" : ' + v); }
    return out.join('\n');
  }
  function parsePie(code) {
    const lines = code.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('%%'));
    const h = /^pie(?:\s+showData)?(?:\s+title\s+(.*))?$/.exec(lines.shift() || ''); if (!h) return null;
    const m = { title: h[1] || '', rows: [] };
    for (const line of lines) {
      let r;
      if ((r = /^title\s+(.*)$/.exec(line))) { m.title = r[1]; continue; }
      if ((r = /^"(.*)"\s*:\s*(-?[\d.]+)$/.exec(line))) { m.rows.push({ text: r[1], value: r[2] }); continue; }
      return null;
    }
    return m;
  }

  const today = () => new Date().toISOString().slice(0, 10);
  function genGantt(m) {
    const out = ['gantt'];
    if (plain(m.title)) out.push('  title ' + plain(m.title));
    out.push('  dateFormat YYYY-MM-DD');
    let section = null;
    m.tasks.forEach((tk, i) => {
      const sec = plain(tk.section) || '-';
      if (sec !== section) { out.push('  section ' + sec); section = sec; }
      const tags = { done: 'done, ', active: 'active, ', crit: 'crit, ' }[tk.status] || '';
      const start = tk.after && i > 0 ? 'after t' + i : (tk.start || today());
      const dur = Math.max(1, parseInt(tk.dur, 10) || 1) + 'd';
      out.push('  ' + (plain(tk.name).replace(/[:#;]/g, ' ') || '-') + ' :' + tags + 't' + (i + 1) + ', ' + start + ', ' + dur);
    });
    return out.join('\n');
  }
  function parseGantt(code) {
    const lines = code.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('%%'));
    if (!/^gantt$/.test(lines.shift() || '')) return null;
    const m = { title: '', tasks: [] }; let section = ''; const ids = [];
    for (const line of lines) {
      let r;
      if ((r = /^title\s+(.*)$/.exec(line))) { m.title = r[1]; continue; }
      if (/^dateFormat\s+YYYY-MM-DD$/.test(line)) continue;
      if ((r = /^section\s+(.*)$/.exec(line))) { section = r[1]; continue; }
      if ((r = /^(.+?)\s*:\s*(.+)$/.exec(line))) {
        const parts = r[2].split(',').map((x) => x.trim()).filter(Boolean);
        let status = 'normal';
        while (parts.length && /^(done|active|crit)$/.test(parts[0])) { const s = parts.shift(); status = s === 'crit' ? 'crit' : (status === 'crit' ? 'crit' : s); }
        const dur = parts.pop(); const dm = /^(\d+)d$/.exec(dur || ''); if (!dm) return null;
        let start = parts.pop(); let id = parts.pop();
        if (parts.length) return null;
        let after = false, date = today();
        const am = /^after\s+(\w+)$/.exec(start || '');
        if (am) { if (ids[ids.length - 1] !== am[1]) return null; after = true; }
        else if (/^\d{4}-\d{2}-\d{2}$/.test(start || '')) date = start;
        else return null;
        ids.push(id || 'x' + ids.length);
        m.tasks.push({ name: r[1], section, start: date, after, dur: dm[1], status });
        continue;
      }
      return null;
    }
    return m;
  }

  const KINDS = {
    flow: { gen: genFlow, parse: parseFlow, test: /^(flowchart|graph)\b/ },
    seq: { gen: genSeq, parse: parseSeq, test: /^sequenceDiagram\b/ },
    pie: { gen: genPie, parse: parsePie, test: /^pie\b/ },
    gantt: { gen: genGantt, parse: parseGantt, test: /^gantt\b/ },
  };
  function detect(code) {
    const first = (String(code).split('\n').map((l) => l.trim()).find((l) => l && !l.startsWith('%%')) || '');
    return Object.keys(KINDS).find((k) => KINDS[k].test.test(first)) || null;
  }

  /* ---------------- standardindhold ---------------- */
  function defaults(kind, t) {
    if (kind === 'flow') return { dir: 'LR', nodes: [
      { id: 'n1', text: t('Start'), shape: 'stadium', color: 'none' },
      { id: 'n2', text: t('Trin') + ' 1', shape: 'box', color: 'none' },
      { id: 'n3', text: t('Slut'), shape: 'stadium', color: 'none' }],
      edges: [{ from: 'n1', to: 'n2', type: 'arrow', text: '' }, { from: 'n2', to: 'n3', type: 'arrow', text: '' }] };
    if (kind === 'seq') return { parts: [{ id: 'p1', text: t('Bruger') }, { id: 'p2', text: t('System') }],
      msgs: [{ from: 'p1', to: 'p2', text: t('Forespørgsel'), reply: false }, { from: 'p2', to: 'p1', text: t('Svar'), reply: true }] };
    if (kind === 'pie') return { title: t('Fordeling'), rows: [{ text: t('Kategori') + ' A', value: '60' }, { text: t('Kategori') + ' B', value: '40' }] };
    return { title: t('Projektplan'), tasks: [
      { name: t('Opgave') + ' 1', section: t('Fase') + ' 1', start: today(), after: false, dur: '5', status: 'normal' },
      { name: t('Opgave') + ' 2', section: t('Fase') + ' 1', start: today(), after: true, dur: '3', status: 'normal' }] };
  }

  /* ---------------- brugerflade ---------------- */
  function el(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k === 'value') e.value = v; else if (k === 'checked') e.checked = !!v; else if (v != null && v !== false) e.setAttribute(k, v);
    }
    for (const kid of kids.flat()) if (kid != null) e.append(kid.nodeType ? kid : document.createTextNode(kid));
    return e;
  }
  function select(options, value, onchange, cls) {
    const s = el('select', { class: 'dg-sel' + (cls ? ' ' + cls : ''), onchange: (e) => onchange(e.target.value) });
    for (const [v, label] of options) s.add(new Option(label, v));
    s.value = value; return s;
  }

  function open(code, deps) {
    const { t, render } = deps;
    return new Promise((resolve) => {
      const models = {};
      let kind = 'flow', codeText = '', notice = '';
      const initialKind = code ? detect(code) : 'flow';
      if (code) {
        const parsed = initialKind ? KINDS[initialKind].parse(code) : null;
        if (parsed) { kind = initialKind; models[kind] = parsed; }
        else { kind = 'code'; codeText = code; notice = t('Diagrammet bruger funktioner, som editoren ikke kan vise. Du kan rette koden direkte.'); }
      } else models.flow = defaults('flow', t);

      const currentCode = () => (kind === 'code' ? codeText : KINDS[kind].gen(models[kind]));

      // --- opbygning ---
      const ov = el('div', { class: 'overlay' });
      const dlg = el('div', { class: 'dlg dg-dlg', role: 'dialog' });
      const tabs = el('div', { class: 'dg-tabs' });
      const form = el('div', { class: 'dg-form' });
      const canvas = el('div', { class: 'dg-canvas md' });
      const preview = el('div', { class: 'dg-preview' }, el('div', { class: 'dg-cap' }, t('Forhåndsvisning')), canvas);
      const okBtn = el('button', { class: 'btn primary' }, code ? t('Opdater') : t('Indsæt'));
      const cancelBtn = el('button', { class: 'btn' }, t('Annuller'));
      dlg.append(el('h3', {}, t('Diagrameditor')), tabs, el('div', { class: 'dg-main' }, form, preview), el('div', { class: 'foot' }, cancelBtn, okBtn));
      ov.append(dlg); document.getElementById('modalRoot').append(ov);

      const close = (v) => { ov.remove(); document.removeEventListener('keydown', onKey, true); resolve(v); };
      const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(null); } };
      document.addEventListener('keydown', onKey, true);
      cancelBtn.onclick = () => close(null);
      okBtn.onclick = () => close(currentCode().replace(/\s+$/, ''));

      let rT = 0, seq = 0;
      function refresh() {
        clearTimeout(rT);
        rT = setTimeout(async () => {
          const my = ++seq; const src = currentCode();
          const r = await render(src);
          if (my !== seq) return;
          canvas.innerHTML = '';
          if (r && r.svg) { canvas.innerHTML = r.svg; deps.decorate && deps.decorate(canvas); }
          else canvas.append(el('div', { class: 'dg-err' }, (r && r.error) || ''));
        }, 220);
      }

      const KIND_LABELS = [['flow', t('Rutediagram')], ['seq', t('Sekvensdiagram')], ['pie', t('Cirkeldiagram')], ['gantt', t('Gantt-diagram')], ['code', t('Kode')]];
      function drawTabs() {
        tabs.innerHTML = '';
        for (const [k, label] of KIND_LABELS) {
          tabs.append(el('button', { class: 'dg-tab' + (k === kind ? ' on' : ''), onclick: () => switchTo(k) }, label));
        }
      }
      function switchTo(k) {
        if (k === kind) return;
        if (k === 'code') { codeText = currentCode(); kind = 'code'; notice = ''; }
        else if (kind === 'code') {
          const d = detect(codeText);
          const parsed = d === k ? KINDS[k].parse(codeText) : null;
          if (parsed) models[k] = parsed;
          else if (codeText.trim() && d === k) { notice = t('Diagrammet bruger funktioner, som editoren ikke kan vise. Du kan rette koden direkte.'); drawForm(); return; }
          if (!models[k]) models[k] = defaults(k, t);
          kind = k; notice = '';
        } else { if (!models[k]) models[k] = defaults(k, t); kind = k; }
        drawTabs(); drawForm(); refresh();
      }

      // --- formularer ---
      const section = (title, ...kids) => el('div', { class: 'dg-sec' }, el('div', { class: 'dg-sec-h' }, title), ...kids);
      const addBtn = (label, fn) => el('button', { class: 'dg-add', onclick: fn }, '+ ' + label);
      const delBtn = (fn) => el('button', { class: 'dg-del', title: t('Slet'), 'aria-label': t('Slet'), onclick: fn }, '✕');
      const input = (value, oninput, attrs) => el('input', Object.assign({ type: 'text', class: 'dg-in', value: value == null ? '' : value, oninput: (e) => oninput(e.target.value) }, attrs || {}));
      const head = (cls, ...cols) => el('div', { class: 'dg-row dg-head ' + cls }, ...cols.map((c) => el('span', {}, c)));

      function drawForm() {
        form.innerHTML = '';
        if (notice) form.append(el('div', { class: 'dg-note' }, notice));
        if (kind === 'flow') drawFlow();
        else if (kind === 'seq') drawSeq();
        else if (kind === 'pie') drawPie();
        else if (kind === 'gantt') drawGantt();
        else drawCode();
      }

      function drawFlow() {
        const m = models.flow;
        const nodeOpts = () => m.nodes.map((n) => [n.id, plain(n.text) || n.id]);
        const syncLabels = (n) => form.querySelectorAll('option[value="' + n.id + '"]').forEach((o) => { o.textContent = plain(n.text) || n.id; });
        form.append(el('label', { class: 'dg-inline' }, t('Retning'),
          select([['LR', t('Venstre mod højre')], ['TD', t('Top mod bund')], ['RL', t('Højre mod venstre')], ['BT', t('Bund mod top')]], m.dir, (v) => { m.dir = v; refresh(); })));
        const shapes = [['box', t('Boks')], ['round', t('Afrundet')], ['decision', t('Beslutning')], ['stadium', t('Start/slut')], ['circle', t('Cirkel')]];
        const colors = [['none', t('Standard')], ['blue', t('Blå')], ['green', t('Grøn')], ['yellow', t('Gul')], ['red', t('Rød')], ['gray', t('Grå')]];
        const nodesBox = el('div', { class: 'dg-rows' });
        nodesBox.append(head('dg-nodes', t('Tekst'), t('Form'), t('Farve'), ''));
        m.nodes.forEach((n) => nodesBox.append(el('div', { class: 'dg-row dg-nodes' },
          input(n.text, (v) => { n.text = v; syncLabels(n); refresh(); }),
          select(shapes, n.shape, (v) => { n.shape = v; refresh(); }),
          select(colors, n.color || 'none', (v) => { n.color = v; refresh(); }),
          delBtn(() => { m.nodes = m.nodes.filter((x) => x !== n); m.edges = m.edges.filter((e) => e.from !== n.id && e.to !== n.id); drawForm(); refresh(); }))));
        const nextId = () => 'n' + (Math.max(0, ...m.nodes.map((n) => parseInt(String(n.id).replace(/\D/g, ''), 10) || 0)) + 1);
        nodesBox.append(addBtn(t('Tilføj trin'), () => {
          const last = m.nodes[m.nodes.length - 1];
          const steps = m.nodes.filter((x) => x.shape !== 'stadium').length;
          const n = { id: nextId(), text: t('Trin') + ' ' + (steps + 1), shape: 'box', color: 'none' };
          if (last && last.shape === 'stadium' && m.nodes.length > 1) {
            // indsæt før slut-trinnet: ... -> nyt trin -> Slut
            m.nodes.splice(m.nodes.length - 1, 0, n);
            m.edges.forEach((e) => { if (e.to === last.id) e.to = n.id; });
            m.edges.push({ from: n.id, to: last.id, type: 'arrow', text: '' });
          } else {
            m.nodes.push(n);
            if (last) m.edges.push({ from: last.id, to: n.id, type: 'arrow', text: '' });
          }
          drawForm(); refresh();
          const box = [...form.querySelectorAll('.dg-row.dg-nodes:not(.dg-head)')][m.nodes.indexOf(n)];
          const inp = box && box.querySelector('.dg-in'); if (inp) { inp.focus(); inp.select(); }
        }));
        form.append(section(t('Trin'), nodesBox));

        const lines = [['arrow', t('Pil')], ['dotted', t('Stiplet pil')], ['thick', t('Tyk pil')], ['line', t('Uden pil')]];
        const edgesBox = el('div', { class: 'dg-rows' });
        edgesBox.append(head('dg-edges', t('Fra'), t('Linje'), t('Til'), t('Tekst'), ''));
        m.edges.forEach((e) => edgesBox.append(el('div', { class: 'dg-row dg-edges' },
          select(nodeOpts(), e.from, (v) => { e.from = v; refresh(); }),
          select(lines, e.type || 'arrow', (v) => { e.type = v; refresh(); }),
          select(nodeOpts(), e.to, (v) => { e.to = v; refresh(); }),
          input(e.text, (v) => { e.text = v; refresh(); }, { placeholder: t('Tekst') }),
          delBtn(() => { m.edges = m.edges.filter((x) => x !== e); drawForm(); refresh(); }))));
        edgesBox.append(addBtn(t('Tilføj forbindelse'), () => {
          const a = m.nodes[0], b = m.nodes[1] || m.nodes[0];
          if (!a) return;
          m.edges.push({ from: a.id, to: b.id, type: 'arrow', text: '' }); drawForm(); refresh();
        }));
        form.append(section(t('Forbindelser'), edgesBox));
      }

      function drawSeq() {
        const m = models.seq;
        const opts = () => m.parts.map((p) => [p.id, plain(p.text) || p.id]);
        const syncLabels = (p) => form.querySelectorAll('option[value="' + p.id + '"]').forEach((o) => { o.textContent = plain(p.text) || p.id; });
        const partsBox = el('div', { class: 'dg-rows' });
        m.parts.forEach((p) => partsBox.append(el('div', { class: 'dg-row dg-parts' },
          input(p.text, (v) => { p.text = v; syncLabels(p); refresh(); }),
          delBtn(() => { m.parts = m.parts.filter((x) => x !== p); m.msgs = m.msgs.filter((x) => x.from !== p.id && x.to !== p.id); drawForm(); refresh(); }))));
        partsBox.append(addBtn(t('Tilføj deltager'), () => {
          const id = 'p' + (Math.max(0, ...m.parts.map((p) => parseInt(String(p.id).replace(/\D/g, ''), 10) || 0)) + 1);
          m.parts.push({ id, text: t('Deltager') + ' ' + (m.parts.length + 1) }); drawForm(); refresh();
        }));
        form.append(section(t('Deltagere'), partsBox));
        const msgsBox = el('div', { class: 'dg-rows' });
        msgsBox.append(head('dg-msgs', t('Fra'), t('Til'), t('Tekst'), t('Linje'), ''));
        m.msgs.forEach((x) => msgsBox.append(el('div', { class: 'dg-row dg-msgs' },
          select(opts(), x.from, (v) => { x.from = v; refresh(); }),
          select(opts(), x.to, (v) => { x.to = v; refresh(); }),
          input(x.text, (v) => { x.text = v; refresh(); }),
          select([['msg', t('Besked')], ['reply', t('Svar')]], x.reply ? 'reply' : 'msg', (v) => { x.reply = v === 'reply'; refresh(); }),
          delBtn(() => { m.msgs = m.msgs.filter((y) => y !== x); drawForm(); refresh(); }))));
        msgsBox.append(addBtn(t('Tilføj besked'), () => {
          const last = m.msgs[m.msgs.length - 1];
          const a = last ? last.to : (m.parts[0] && m.parts[0].id), b = last ? last.from : (m.parts[1] && m.parts[1].id);
          if (!a || !b) return;
          m.msgs.push({ from: a, to: b, text: t('Besked'), reply: false }); drawForm(); refresh();
        }));
        form.append(section(t('Beskeder'), msgsBox));
      }

      function drawPie() {
        const m = models.pie;
        form.append(el('label', { class: 'dg-inline' }, t('Titel'), input(m.title, (v) => { m.title = v; refresh(); })));
        const box = el('div', { class: 'dg-rows' });
        box.append(head('dg-pie', t('Tekst'), t('Værdi'), ''));
        m.rows.forEach((r) => box.append(el('div', { class: 'dg-row dg-pie' },
          input(r.text, (v) => { r.text = v; refresh(); }),
          el('input', { type: 'number', class: 'dg-in', value: r.value, min: '0', step: 'any', oninput: (e) => { r.value = e.target.value; refresh(); } }),
          delBtn(() => { m.rows = m.rows.filter((x) => x !== r); drawForm(); refresh(); }))));
        box.append(addBtn(t('Tilføj række'), () => { m.rows.push({ text: t('Kategori') + ' ' + String.fromCharCode(65 + m.rows.length), value: '10' }); drawForm(); refresh(); }));
        form.append(section(t('Cirkeldiagram'), box));
      }

      function drawGantt() {
        const m = models.gantt;
        form.append(el('label', { class: 'dg-inline' }, t('Titel'), input(m.title, (v) => { m.title = v; refresh(); })));
        const st = [['normal', t('Normal')], ['done', t('Færdig')], ['active', t('I gang')], ['crit', t('Kritisk')]];
        const box = el('div', { class: 'dg-rows' });
        box.append(head('dg-gantt', t('Opgave'), t('Afsnit'), t('Startdato'), t('Varighed (dage)'), t('Status'), ''));
        m.tasks.forEach((tk, i) => {
          const date = el('input', { type: 'date', class: 'dg-in', value: tk.start, oninput: (e) => { tk.start = e.target.value; refresh(); } });
          date.disabled = tk.after && i > 0;
          const after = el('label', { class: 'dg-after', title: t('Efter forrige') }, el('input', { type: 'checkbox', checked: tk.after && i > 0, onchange: (e) => { tk.after = e.target.checked; date.disabled = tk.after; refresh(); } }), t('Efter forrige'));
          if (i === 0) after.style.visibility = 'hidden';
          box.append(el('div', { class: 'dg-row dg-gantt' },
            input(tk.name, (v) => { tk.name = v; refresh(); }),
            input(tk.section, (v) => { tk.section = v; refresh(); }),
            el('div', { class: 'dg-date' }, date, after),
            el('input', { type: 'number', class: 'dg-in', value: tk.dur, min: '1', oninput: (e) => { tk.dur = e.target.value; refresh(); } }),
            select(st, tk.status || 'normal', (v) => { tk.status = v; refresh(); }),
            delBtn(() => { m.tasks = m.tasks.filter((x) => x !== tk); drawForm(); refresh(); })));
        });
        box.append(addBtn(t('Tilføj række'), () => {
          const last = m.tasks[m.tasks.length - 1];
          m.tasks.push({ name: t('Opgave') + ' ' + (m.tasks.length + 1), section: last ? last.section : t('Fase') + ' 1', start: last ? last.start : today(), after: !!last, dur: '5', status: 'normal' });
          drawForm(); refresh();
        }));
        form.append(section(t('Gantt-diagram'), box));
      }

      function drawCode() {
        const ta = el('textarea', { class: 'dg-code', spellcheck: 'false', oninput: (e) => { codeText = e.target.value; refresh(); } });
        ta.value = codeText;
        form.append(ta);
        setTimeout(() => ta.focus(), 0);
      }

      drawTabs(); drawForm(); refresh();
    });
  }

  window.WDDiagram = { open, detect, parsers: { flow: parseFlow, seq: parseSeq, pie: parsePie, gantt: parseGantt }, generators: { flow: genFlow, seq: genSeq, pie: genPie, gantt: genGantt } };
})();
