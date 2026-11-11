/* MarkNote markdown-motor. Virker både i Node (main/test) og i browseren (renderer). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('marked'), require('katex'));
  } else {
    root.WDmd = factory(root.marked, root.katex);
  }
})(typeof self !== 'undefined' ? self : this, function (marked, katex) {
  'use strict';
  const { Marked } = marked;

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const slug = (s) =>
    String(s).toLowerCase().replace(/<[^>]+>/g, '').replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-');

  function math(tex, display) {
    try {
      return katex.renderToString(tex, { displayMode: display, throwOnError: false, output: 'html' });
    } catch (e) {
      return '<code>' + esc(tex) + '</code>';
    }
  }

  /* Fjerner fodnote-definitioner "[^id]: tekst" (uden for kodeblokke) og returnerer dem separat. */
  function extractFootnotes(src) {
    const defs = {};
    const out = [];
    let fence = null;
    const lines = src.replace(/\r\n?/g, '\n').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const f = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
      if (f) {
        if (!fence) fence = f[1][0];
        else if (f[1][0] === fence) fence = null;
        out.push(line);
        continue;
      }
      const d = !fence && /^\[\^([^\]\s]+)\]:\s?(.*)$/.exec(line);
      if (d) {
        let text = d[2];
        while (i + 1 < lines.length && /^( {2,}|\t)\S/.test(lines[i + 1])) text += ' ' + lines[++i].trim();
        defs[d[1]] = text;
        continue;
      }
      out.push(line);
    }
    return { text: out.join('\n'), defs };
  }

  function createInstance(state) {
    const m = new Marked({ gfm: true, breaks: false });
    m.use({
      extensions: [
        {
          name: 'highlight',
          level: 'inline',
          start: (s) => s.indexOf('=='),
          tokenizer(s) {
            const r = /^==(?=\S)([^=\n]+?)(?<=\S)==/.exec(s);
            if (r) return { type: 'highlight', raw: r[0], text: r[1], tokens: this.lexer.inlineTokens(r[1]) };
          },
          renderer(t) {
            return '<mark>' + this.parser.parseInline(t.tokens) + '</mark>';
          },
        },
        {
          name: 'inlineMath',
          level: 'inline',
          start: (s) => s.indexOf('$'),
          tokenizer(s) {
            const r = /^\$(?=\S)([^$\n]+?)(?<=\S)\$(?!\d)/.exec(s);
            if (r) return { type: 'inlineMath', raw: r[0], text: r[1] };
          },
          renderer: (t) => '<span class="wd-math" data-tex="' + esc(t.text) + '">' + math(t.text, false) + '</span>',
        },
        {
          name: 'blockMath',
          level: 'block',
          start: (s) => s.indexOf('$$'),
          tokenizer(s) {
            const r = /^\$\$[ \t]*\n?([\s\S]+?)\n?\$\$[ \t]*(?:\n|$)/.exec(s);
            if (r) return { type: 'blockMath', raw: r[0], text: r[1].trim() };
          },
          renderer: (t) => '<div class="math-block" data-tex="' + esc(t.text) + '">' + math(t.text, true) + '</div>\n',
        },
        {
          name: 'footnoteRef',
          level: 'inline',
          start: (s) => s.indexOf('[^'),
          tokenizer(s) {
            const r = /^\[\^([^\]\s]+)\]/.exec(s);
            if (r && state.defs[r[1]] !== undefined) {
              let n = state.order.indexOf(r[1]);
              if (n < 0) n = state.order.push(r[1]) - 1;
              return { type: 'footnoteRef', raw: r[0], id: r[1], n: n + 1 };
            }
          },
          renderer: (t) =>
            '<sup class="fnref" data-fn="' + esc(t.id) + '"><a href="#fn-' + esc(t.id) + '" id="fnref-' + esc(t.id) + '">' + t.n + '</a></sup>',
        },
      ],
      renderer: {
        heading(text, level, raw) {
          return '<h' + level + ' id="' + esc(slug(raw)) + '">' + text + '</h' + level + '>\n';
        },
        html(t) {
          const raw = typeof t === 'string' ? t : t.text || t.raw;
          if (state.showComments && /^\s*<!--([\s\S]*?)-->\s*$/.test(raw)) {
            const c = /<!--([\s\S]*?)-->/.exec(raw)[1].trim();
            return '<span class="md-comment">' + esc(c) + '</span>';
          }
          return raw;
        },
      },
    });
    return m;
  }

  function parse(src, opts) {
    opts = opts || {};
    const { text, defs } = extractFootnotes(src);
    const state = { defs, order: [], showComments: !!opts.showComments };
    const m = createInstance(state);
    return { m, state, text };
  }

  /** Markdown -> (usanitiseret) HTML */
  function render(src, opts) {
    const { m, state, text } = parse(src, opts);
    let html = m.parse(text);
    if (state.order.length) {
      html += '<section class="footnotes"><hr><ol>';
      for (const id of state.order) {
        html +=
          '<li id="fn-' + esc(id) + '">' + m.parseInline(state.defs[id]) +
          ' <a class="fnback" href="#fnref-' + esc(id) + '">↩</a></li>';
      }
      html += '</ol></section>';
    }
    return html;
  }

  /** Markdown -> tokens + fodnoter (til DOCX-eksport) */
  function lex(src) {
    const { m, state, text } = parse(src, {});
    const tokens = m.lexer(text);
    return { tokens, footnotes: state.order.map((id) => ({ id, text: state.defs[id] })) };
  }

  /** Overskrifter til navigationsruden (springer kodeblokke over) */
  function outline(src) {
    const res = [];
    let fence = null;
    let pos = 0;
    for (const line of src.split('\n')) {
      const f = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
      if (f) fence = fence ? (f[1][0] === fence ? null : fence) : f[1][0];
      else if (!fence) {
        const h = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
        if (h) res.push({ level: h[1].length, text: h[2].replace(/[*_`~=]/g, ''), pos });
      }
      pos += line.length + 1;
    }
    return res;
  }

  /** Ord- og tegntælling på selve teksten (uden syntaks) */
  function stats(src) {
    const plain = src
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+[.)]|- \[[ xX]\])\s+/gm, '')
      .replace(/[*_~=`|]|\$\$?/g, '')
      .replace(/^\s*[-:| ]{3,}\s*$/gm, ' ');
    const words = (plain.match(/\S+/g) || []).length;
    return { words, chars: src.length, charsNoSpaces: src.replace(/\s/g, '').length };
  }

  return { render, lex, outline, stats, esc, slug, math };
});
