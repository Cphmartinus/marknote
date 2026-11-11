'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { toDocx } = require('./lib/docx-export');

const MD_EXT = ['md', 'markdown', 'mdown', 'mkd', 'txt', 'docx', 'html', 'htm'];
const CONVERT_EXT = ['docx', 'html', 'htm'];
const IMG_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'];
const userData = () => app.getPath('userData');
const recentFile = () => path.join(userData(), 'recent.json');
const snapDir = (key) => path.join(userData(), 'snapshots', crypto.createHash('sha1').update(key).digest('hex').slice(0, 16));

let win = null;
let L = {};
const S = (k, d) => L[k] || d;
ipcMain.on('sys:locale', (e) => { e.returnValue = app.getLocale(); });
ipcMain.handle('lang:set', (_e, { spell, strings, lang }) => {
  L = strings || {};
  L.lang = lang || 'da';
  try {
    const ses = win.webContents.session;
    const avail = ses.availableSpellCheckerLanguages || [];
    const pick = [spell, 'en-US'].filter((x, i, a) => x && avail.includes(x) && a.indexOf(x) === i);
    if (pick.length) ses.setSpellCheckerLanguages(pick);
  } catch (_) {}
  return true;
});
let forceClose = false;
let pendingOpen = null;

/* ---------- start ---------- */
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
      const f = fileFromArgv(argv.slice(1));
      if (f) win.webContents.send('app:open-path', f);
    }
  });
}

function fileFromArgv(argv) {
  return argv.find((a) => !a.startsWith('-') && MD_EXT.includes(path.extname(a).slice(1).toLowerCase()) && fs.existsSync(a)) || null;
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 820, minWidth: 760, minHeight: 480,
    backgroundColor: '#e6e6e6',
    title: 'MarkNote',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
      spellcheck: true,
    },
  });
  win.webContents.session.setSpellCheckerLanguages(['da', 'en-US']);
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    e.preventDefault();
    openExternal(url);
  });
  win.on('close', (e) => {
    if (!forceClose) { e.preventDefault(); win.webContents.send('app:request-close'); }
  });
  win.on('closed', () => (win = null));
  win.webContents.once('did-finish-load', () => {
    if (pendingOpen) win.webContents.send('app:open-path', pendingOpen);
  });
}

function openExternal(url) {
  if (/^(https?:|mailto:)/i.test(url)) shell.openExternal(url);
}

Menu.setApplicationMenu(null);
app.whenReady().then(() => {
  pendingOpen = fileFromArgv(process.argv.slice(1));
  createWindow();
});
app.on('window-all-closed', () => app.quit());

/* ---------- filer ---------- */
async function readDoc(p) {
  const ext = path.extname(p).slice(1).toLowerCase();
  if (CONVERT_EXT.includes(ext)) return convertDoc(p, ext);
  const content = fs.readFileSync(p, 'utf8').replace(/^﻿/, '');
  addRecent(p);
  return { path: p, content };
}
async function convertDoc(p, ext) {
  const dir = path.dirname(p), base = path.basename(p, path.extname(p));
  let html, messages = [];
  if (ext === 'docx') {
    const mammoth = require('mammoth');
    const imgDir = path.join(dir, base + '_billeder');
    let n = 0;
    const r = await mammoth.convertToHtml({ path: p }, {
      convertImage: mammoth.images.imgElement(async (img) => {
        const buf = await img.read();
        const e = (img.contentType.split('/')[1] || 'png').replace('jpeg', 'jpg').replace(/\+.*/, '');
        fs.mkdirSync(imgDir, { recursive: true });
        const name = 'billede' + (++n) + '.' + e;
        fs.writeFileSync(path.join(imgDir, name), buf);
        return { src: encodeURI(base + '_billeder/' + name) };
      }),
    });
    html = r.value; messages = r.messages;
  } else {
    html = fs.readFileSync(p, 'utf8');
  }
  return { converted: ext, html, name: base, virtualPath: path.join(dir, base + '.md'), warnings: messages.length };
}
function addRecent(p) {
  let list = getRecent().filter((x) => x !== p);
  list.unshift(p);
  list = list.slice(0, 12);
  try { fs.mkdirSync(userData(), { recursive: true }); fs.writeFileSync(recentFile(), JSON.stringify(list)); } catch (_) {}
  app.addRecentDocument && app.addRecentDocument(p);
}
function getRecent() {
  try { return JSON.parse(fs.readFileSync(recentFile(), 'utf8')).filter((p) => fs.existsSync(p)); } catch (_) { return []; }
}
const mdFilters = [
  { name: 'Markdown, Word, HTML', extensions: ['md', 'markdown', 'mdown', 'txt', 'docx', 'html', 'htm'] },
  { name: 'All files', extensions: ['*'] },
];

ipcMain.handle('file:open', async () => {
  const r = await dialog.showOpenDialog(win, { title: S('openTitle', 'Åbn dokument'), filters: mdFilters, properties: ['openFile'] });
  if (r.canceled || !r.filePaths[0]) return null;
  return readDoc(r.filePaths[0]).catch((err) => ({ error: err.message }));
});
ipcMain.handle('file:read', async (_e, p) => {
  try { return await readDoc(p); } catch (err) { return { error: err.message }; }
});
ipcMain.handle('file:save', async (_e, { path: p, content, saveAs, suggested, suggestedPath }) => {
  if (!p || saveAs) {
    const r = await dialog.showSaveDialog(win, {
      title: S('saveTitle', 'Gem dokument'), defaultPath: p || suggestedPath || (suggested || 'Dokument1') + '.md',
      filters: [{ name: 'Markdown', extensions: ['md'] }, { name: S('filterAll', 'Alle filer'), extensions: ['*'] }],
    });
    if (r.canceled || !r.filePath) return null;
    p = r.filePath;
  }
  try {
    fs.writeFileSync(p, content, 'utf8');
    addRecent(p);
    return { path: p };
  } catch (err) {
    return { error: err.message };
  }
});
ipcMain.handle('file:recent', () => getRecent());
ipcMain.handle('file:clearRecent', () => { try { fs.unlinkSync(recentFile()); } catch (_) {} return true; });
ipcMain.handle('file:reveal', (_e, p) => { if (p) shell.showItemInFolder(p); });

ipcMain.handle('dialog:confirm', async (_e, { message, detail, buttons }) => {
  const r = await dialog.showMessageBox(win, {
    type: 'warning', title: 'MarkNote', message, detail,
    buttons: buttons || ['Gem', 'Gem ikke', 'Annuller'], defaultId: 0, cancelId: 2, noLink: true,
  });
  return r.response; // 0 gem, 1 gem ikke, 2 annuller
});
ipcMain.handle('app:closeConfirmed', () => { forceClose = true; win && win.close(); });
ipcMain.handle('app:openExternal', (_e, url) => openExternal(url));

/* ---------- billeder ---------- */
ipcMain.handle('image:pick', async (_e, docPath) => {
  const r = await dialog.showOpenDialog(win, {
    title: S('imageTitle', 'Indsæt billede'), properties: ['openFile', 'multiSelections'],
    filters: [{ name: S('imageFilter', 'Billeder'), extensions: IMG_EXT }],
  });
  if (r.canceled) return [];
  return r.filePaths.map((p) => relOrFileUrl(p, docPath));
});
ipcMain.handle('image:rel', (_e, p, docPath) => (IMG_EXT.includes(path.extname(p).slice(1).toLowerCase()) ? relOrFileUrl(p, docPath) : null));
function relOrFileUrl(p, docPath) {
  if (docPath) {
    const rel = path.relative(path.dirname(docPath), p);
    if (!rel.startsWith('..') && !path.isAbsolute(rel)) return encodeURI(rel.split(path.sep).join('/'));
    if (rel && !path.isAbsolute(rel)) return encodeURI(rel.split(path.sep).join('/'));
  }
  return require('url').pathToFileURL(p).href;
}

/* ---------- versionshistorik ---------- */
ipcMain.handle('snap:save', (_e, { key, content }) => {
  try {
    const d = snapDir(key);
    fs.mkdirSync(d, { recursive: true });
    const id = new Date().toISOString().replace(/[:.]/g, '-');
    fs.writeFileSync(path.join(d, id + '.md'), content, 'utf8');
    fs.writeFileSync(path.join(d, 'key.txt'), key, 'utf8');
    const files = fs.readdirSync(d).filter((f) => f.endsWith('.md')).sort();
    files.slice(0, Math.max(0, files.length - 60)).forEach((f) => fs.unlinkSync(path.join(d, f)));
    return id;
  } catch (_) { return null; }
});
ipcMain.handle('snap:list', (_e, key) => {
  try {
    const d = snapDir(key);
    return fs.readdirSync(d).filter((f) => f.endsWith('.md')).sort().reverse().map((f) => ({
      id: f.slice(0, -3), size: fs.statSync(path.join(d, f)).size,
    }));
  } catch (_) { return []; }
});
ipcMain.handle('snap:read', (_e, key, id) => {
  try { return fs.readFileSync(path.join(snapDir(key), path.basename(id) + '.md'), 'utf8'); } catch (_) { return null; }
});

/* ---------- eksport ---------- */
const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');

function katexCssInline() {
  const dir = path.join(__dirname, 'renderer', 'vendor', 'katex');
  let css = fs.readFileSync(path.join(dir, 'katex.min.css'), 'utf8');
  css = css.replace(/url\(fonts\/([^)]+?\.woff2)\)\s*format\("woff2"\)(?:,\s*url\([^)]*\)\s*format\("[^"]*"\))*/g, (_m, f) => {
    try {
      return 'url(data:font/woff2;base64,' + fs.readFileSync(path.join(dir, 'fonts', f)).toString('base64') + ') format("woff2")';
    } catch (_) { return _m; }
  });
  return css;
}

function wrapHtml({ title, body, baseDir, math, extraCss }) {
  const base = baseDir ? '<base href="' + require('url').pathToFileURL(baseDir + path.sep).href + '">' : '';
  return '<!doctype html><html lang="' + (L.lang || 'da') + '"><head><meta charset="utf-8">' + base +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta http-equiv="Content-Security-Policy" content="script-src \'none\'; object-src \'none\'">' +
    '<title>' + String(title).replace(/[<&]/g, '') + '</title><style>' +
    read('renderer/preview.css') + '\nbody{margin:0;background:#fff;color:#1b1b1b}.md{max-width:820px;margin:0 auto;padding:40px 32px}' +
    '@media print{.md{max-width:none;padding:0}}' + (extraCss || '') + '</style>' +
    (math ? '<style>' + katexCssInline() + '</style>' : '') +
    '</head><body><article class="md">' + body + '</article></body></html>';
}

function docDirOf(p) { return p ? path.dirname(p) : null; }
function suggestName(docPath, title, ext) {
  const base = docPath ? path.basename(docPath, path.extname(docPath)) : title || 'Dokument1';
  return path.join(docPath ? path.dirname(docPath) : app.getPath('documents'), base + '.' + ext);
}

ipcMain.handle('export:run', async (_e, { kind, md, html, title, docPath, math, fontFamily, fontSize }) => {
  const filters = {
    pdf: [{ name: 'PDF', extensions: ['pdf'] }],
    docx: [{ name: 'Word (.docx)', extensions: ['docx'] }],
    html: [{ name: 'HTML', extensions: ['html'] }],
    md: [{ name: 'Markdown', extensions: ['md'] }],
  }[kind];
  const r = await dialog.showSaveDialog(win, { title: S('exportTitle', 'Eksportér'), defaultPath: suggestName(docPath, title, kind), filters });
  if (r.canceled || !r.filePath) return null;
  const extraCss = (fontFamily ? '.md{font-family:' + fontFamily.replace(/[;{}<>]/g, '') + '}' : '') +
    (fontSize ? '.md{font-size:' + Number(fontSize) + 'px}' : '');
  try {
    if (kind === 'md') fs.writeFileSync(r.filePath, md, 'utf8');
    else if (kind === 'html') fs.writeFileSync(r.filePath, wrapHtml({ title, body: html, baseDir: docDirOf(docPath), math, extraCss }), 'utf8');
    else if (kind === 'docx') {
      const buf = await toDocx(md, {
        loadImage(href) {
          try {
            if (/^https?:/i.test(href)) return null;
            const p = href.startsWith('file:') ? require('url').fileURLToPath(href) : path.resolve(docDirOf(docPath) || '.', decodeURI(href));
            const ext = path.extname(p).slice(1).toLowerCase();
            if (!['png', 'jpg', 'jpeg', 'gif', 'bmp'].includes(ext)) return null;
            const data = fs.readFileSync(p);
            const size = nativeImage.createFromBuffer(data).getSize();
            return { data, width: size.width || 400, height: size.height || 300, type: ext === 'jpeg' ? 'jpg' : ext };
          } catch (_) { return null; }
        },
      });
      fs.writeFileSync(r.filePath, buf);
    } else if (kind === 'pdf') {
      const tmp = path.join(os.tmpdir(), 'marknote-' + crypto.randomBytes(6).toString('hex') + '.html');
      fs.writeFileSync(tmp, wrapHtml({ title, body: html, baseDir: docDirOf(docPath), math, extraCss }), 'utf8');
      const w = new BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: false, contextIsolation: true } });
      try {
        await w.loadFile(tmp);
        const pdf = await w.webContents.printToPDF({
          pageSize: 'A4', printBackground: true,
          margins: { top: 0.8, bottom: 0.8, left: 0.9, right: 0.9 },
        });
        fs.writeFileSync(r.filePath, pdf);
      } finally { w.destroy(); fs.unlink(tmp, () => {}); }
    }
    return { path: r.filePath };
  } catch (err) {
    return { error: err.message };
  }
});
ipcMain.handle('shell:show', (_e, p) => { if (p) shell.showItemInFolder(p); });
