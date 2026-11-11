'use strict';
const { contextBridge, ipcRenderer, webUtils } = require('electron');
const inv = (ch) => (...a) => ipcRenderer.invoke(ch, ...a);

contextBridge.exposeInMainWorld('api', {
  openFile: inv('file:open'),
  readFile: inv('file:read'),
  saveFile: inv('file:save'),
  recent: inv('file:recent'),
  clearRecent: inv('file:clearRecent'),
  confirm: inv('dialog:confirm'),
  closeConfirmed: inv('app:closeConfirmed'),
  openExternal: inv('app:openExternal'),
  pickImage: inv('image:pick'),
  imageRel: inv('image:rel'),
  snapSave: inv('snap:save'),
  snapList: inv('snap:list'),
  snapRead: inv('snap:read'),
  exportAs: inv('export:run'),
  showInFolder: inv('shell:show'),
  pathForFile: (f) => { try { return webUtils.getPathForFile(f); } catch (_) { return ''; } },
  systemLocale: (() => { try { return ipcRenderer.sendSync('sys:locale'); } catch (_) { return ''; } })(),
  setLang: inv('lang:set'),
  onOpenPath: (cb) => ipcRenderer.on('app:open-path', (_e, p) => cb(p)),
  onRequestClose: (cb) => ipcRenderer.on('app:request-close', () => cb()),
});
