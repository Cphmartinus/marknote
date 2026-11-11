/* Markdown -> ægte .docx (Microsoft Word-format) */
'use strict';
const docx = require('docx');
const md = require('./md');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType,
  ExternalHyperlink, ImageRun, FootnoteReferenceRun, AlignmentType, BorderStyle, ShadingType, LevelFormat,
} = docx;

const decode = (s) =>
  String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6];
const MONO = 'Consolas';

/**
 * @param {string} src markdown
 * @param {{loadImage?: (href:string)=>({data:Buffer,width:number,height:number,type:string}|null)}} opts
 */
async function toDocx(src, opts = {}) {
  const { tokens, footnotes } = md.lex(src);
  const fnIndex = {};
  footnotes.forEach((f, i) => (fnIndex[f.id] = i + 1));
  const numberings = [];

  const bulletLevels = Array.from({ length: 6 }, (_, i) => ({
    level: i, format: LevelFormat.BULLET, text: ['•', '◦', '▪'][i % 3], alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 720 + i * 360, hanging: 360 } } },
  }));
  const numLevels = Array.from({ length: 6 }, (_, i) => ({
    level: i, format: [LevelFormat.DECIMAL, LevelFormat.LOWER_LETTER, LevelFormat.LOWER_ROMAN][i % 3],
    text: `%${i + 1}.`, alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 720 + i * 360, hanging: 360 } } },
  }));
  numberings.push({ reference: 'bullets', levels: bulletLevels });

  /* ---------- inline ---------- */
  function inline(toks, style = {}) {
    const runs = [];
    for (const t of toks || []) {
      switch (t.type) {
        case 'text':
        case 'escape':
          if (t.tokens && t.tokens.length) runs.push(...inline(t.tokens, style));
          else runs.push(new TextRun({ text: decode(t.text), ...style }));
          break;
        case 'strong': runs.push(...inline(t.tokens, { ...style, bold: true })); break;
        case 'em': runs.push(...inline(t.tokens, { ...style, italics: true })); break;
        case 'del': runs.push(...inline(t.tokens, { ...style, strike: true })); break;
        case 'highlight': runs.push(...inline(t.tokens, { ...style, highlight: 'yellow' })); break;
        case 'codespan':
          runs.push(new TextRun({ text: decode(t.text), ...style, font: MONO, shading: { type: ShadingType.CLEAR, fill: 'EEEEEE' } }));
          break;
        case 'inlineMath':
          runs.push(new TextRun({ text: t.text, ...style, italics: true, font: 'Cambria Math' }));
          break;
        case 'footnoteRef':
          if (fnIndex[t.id]) runs.push(new FootnoteReferenceRun(fnIndex[t.id]));
          break;
        case 'br': runs.push(new TextRun({ break: 1 })); break;
        case 'link':
          runs.push(new ExternalHyperlink({
            link: t.href,
            children: inline(t.tokens, { ...style, color: '0563C1', underline: {} }),
          }));
          break;
        case 'image': {
          const img = opts.loadImage && opts.loadImage(t.href);
          if (img) {
            const max = 560;
            const k = img.width > max ? max / img.width : 1;
            runs.push(new ImageRun({
              type: img.type, data: img.data,
              transformation: { width: Math.round(img.width * k), height: Math.round(img.height * k) },
            }));
          } else runs.push(new TextRun({ text: `[${decode(t.text || t.href)}]`, ...style, italics: true }));
          break;
        }
        case 'html':
          if (/^<br\s*\/?>$/i.test(t.raw.trim())) runs.push(new TextRun({ break: 1 }));
          break;
        default:
          if (t.tokens) runs.push(...inline(t.tokens, style));
          else if (t.text) runs.push(new TextRun({ text: decode(t.text), ...style }));
      }
    }
    return runs;
  }

  /* ---------- blocks ---------- */
  function blocks(toks, ctx = {}) {
    const out = [];
    for (const t of toks) {
      switch (t.type) {
        case 'heading':
          out.push(new Paragraph({ heading: HEADINGS[t.depth - 1], children: inline(t.tokens), indent: ctx.indent ? { left: ctx.indent } : undefined }));
          break;
        case 'paragraph':
        case 'text':
          out.push(new Paragraph({
            children: inline(t.tokens || [{ type: 'text', text: t.text }]),
            spacing: { after: 120 },
            indent: ctx.indent ? { left: ctx.indent } : undefined,
            border: ctx.quote ? { left: { style: BorderStyle.SINGLE, size: 18, color: 'A6A6A6', space: 8 } } : undefined,
          }));
          break;
        case 'code': {
          const lines = decode(t.text).split('\n');
          lines.forEach((ln, i) =>
            out.push(new Paragraph({
              children: [new TextRun({ text: ln || ' ', font: MONO, size: 20 })],
              shading: { type: ShadingType.CLEAR, fill: 'F2F2F2' },
              spacing: { after: i === lines.length - 1 ? 160 : 0 },
              indent: ctx.indent ? { left: ctx.indent } : undefined,
            })));
          break;
        }
        case 'blockquote':
          out.push(...blocks(t.tokens, { ...ctx, quote: true, indent: (ctx.indent || 0) + 360 }));
          break;
        case 'blockMath':
          out.push(new Paragraph({
            alignment: AlignmentType.CENTER, spacing: { before: 120, after: 160 },
            children: [new TextRun({ text: t.text, italics: true, font: 'Cambria Math' })],
          }));
          break;
        case 'hr':
          out.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '999999', space: 1 } }, spacing: { after: 160 } }));
          break;
        case 'list': out.push(...list(t, ctx.level || 0)); break;
        case 'table': out.push(table(t)); break;
        default: break; // space, html (kommentarer) m.m.
      }
    }
    return out;
  }

  function list(t, level) {
    const out = [];
    let ref = 'bullets';
    if (t.ordered) {
      ref = 'num' + numberings.length;
      numberings.push({ reference: ref, levels: numLevels });
    }
    for (const item of t.items) {
      let first = true;
      for (const b of item.tokens) {
        if (b.type === 'list') out.push(...list(b, Math.min(level + 1, 5)));
        else if (b.type === 'text' || b.type === 'paragraph') {
          const runs = inline(b.tokens || [{ type: 'text', text: b.text }]);
          if (item.task && first) runs.unshift(new TextRun({ text: item.checked ? '☑ ' : '☐ ' }));
          out.push(new Paragraph({
            children: runs,
            ...(first ? { numbering: { reference: ref, level } } : { indent: { left: 720 + level * 360 } }),
            spacing: { after: 60 },
          }));
          first = false;
        } else out.push(...blocks([b], { indent: 720 + level * 360 }));
      }
    }
    return out;
  }

  function table(t) {
    const al = (a) => (a === 'center' ? AlignmentType.CENTER : a === 'right' ? AlignmentType.RIGHT : AlignmentType.LEFT);
    const mkRow = (cells, header) =>
      new TableRow({
        tableHeader: header,
        children: cells.map((c, i) =>
          new TableCell({
            width: { size: Math.floor(100 / t.header.length), type: WidthType.PERCENTAGE },
            shading: header ? { type: ShadingType.CLEAR, fill: 'E7ECF4' } : undefined,
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            children: [new Paragraph({ alignment: al(t.align[i]), children: inline(c.tokens, header ? { bold: true } : {}) })],
          })),
      });
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [mkRow(t.header, true), ...t.rows.map((r) => mkRow(r, false))],
    });
  }

  const body = blocks(tokens);
  if (!body.length) body.push(new Paragraph({}));

  const fnObj = {};
  for (const f of footnotes) {
    const lex = md.lex(f.text).tokens;
    const first = lex.find((x) => x.type === 'paragraph' || x.type === 'text');
    fnObj[fnIndex[f.id]] = { children: [new Paragraph({ children: inline(first ? first.tokens : [{ type: 'text', text: f.text }]) })] };
  }

  const hStyle = (id, name, size, color) => ({
    id, name, basedOn: 'Normal', next: 'Normal', quickFormat: true,
    run: { size, bold: true, color, font: 'Calibri Light' },
    paragraph: { spacing: { before: 280, after: 100 }, keepNext: true },
  });

  const doc = new Document({
    creator: 'MarkNote',
    title: 'MarkNote-dokument',
    styles: {
      default: { document: { run: { font: 'Calibri', size: 22 } } },
      paragraphStyles: [
        hStyle('Heading1', 'Heading 1', 40, '2F5496'), hStyle('Heading2', 'Heading 2', 32, '2F5496'),
        hStyle('Heading3', 'Heading 3', 26, '1F3763'), hStyle('Heading4', 'Heading 4', 24, '2F5496'),
        hStyle('Heading5', 'Heading 5', 22, '2F5496'), hStyle('Heading6', 'Heading 6', 22, '595959'),
      ],
    },
    numbering: { config: numberings },
    footnotes: fnObj,
    sections: [{ properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } }, children: body }],
  });
  return Packer.toBuffer(doc);
}

module.exports = { toDocx };
