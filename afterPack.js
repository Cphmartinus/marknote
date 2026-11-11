// Sætter ikon og filegenskaber på Windows-exe'en uden Wine (virker også ved bygning på Linux).
const fs = require('fs');
const path = require('path');

exports.default = async function afterPack(ctx) {
  if (ctx.electronPlatformName !== 'win32') return;
  const ResEdit = require('resedit');
  const pkg = require('./package.json');
  const exePath = path.join(ctx.appOutDir, ctx.packager.appInfo.productFilename + '.exe');
  const exe = ResEdit.NtExecutable.from(fs.readFileSync(exePath));
  const res = ResEdit.NtExecutableResource.from(exe);

  const iconFile = ResEdit.Data.IconFile.from(fs.readFileSync(path.join(__dirname, 'build', 'icon.ico')));
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
  const id = groups.length ? groups[0].id : 1;
  const lang = groups.length ? groups[0].lang : 1033;
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, id, lang, iconFile.icons.map((i) => i.data));

  const vi = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0];
  if (vi) {
    const v = pkg.version.split('.').map(Number);
    vi.setFileVersion(v[0], v[1] || 0, v[2] || 0, 0, 1033);
    vi.setProductVersion(v[0], v[1] || 0, v[2] || 0, 0, 1033);
    vi.setStringValues({ lang: 1033, codepage: 1200 }, {
      ProductName: 'MarkNote', FileDescription: 'MarkNote – Markdown-editor i Word-stil',
      InternalName: 'MarkNote', OriginalFilename: 'MarkNote.exe', LegalCopyright: 'MarkNote', CompanyName: 'MarkNote',
    });
    vi.outputToResourceEntries(res.entries);
  }
  res.outputResource(exe);
  fs.writeFileSync(exePath, Buffer.from(exe.generate()));
  console.log('  • afterPack: ikon og filegenskaber sat på ' + path.basename(exePath));
};
