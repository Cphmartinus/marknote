# MarkNote

A Word-style Markdown reader and editor for Windows 11.

MarkNote gives you the familiar ribbon, tabs and status bar of a word processor, while your documents stay plain `.md` files. No lock-in, no proprietary format.

## Features

- **Three views:** raw Markdown with syntax highlighting, live preview (Markdown and formatted document side by side), and reading mode.
- **WYSIWYG editing:** edit directly in the formatted document in live preview and reading mode. Both panes stay in sync.
- **Ribbon interface:** Home, Insert, View, Export & Tools and Help tabs. Hover over a button to see its shortcut and the Markdown it produces. `Ctrl+F1` hides the ribbon.
- **Insert:** interactive table builder, images with automatic relative paths (drag and drop supported), links, footnotes, invisible comments and LaTeX formulas.
- **Tabs:** several documents at once, with unsaved-changes markers.
- **Open Word and HTML files:** `.docx` and `.html` files are converted to Markdown when opened.
- **Export:** PDF, DOCX (real Word format), standalone HTML and plain `.md`.
- **Version history:** automatic snapshots that can be restored.
- **Find and replace** with regular expression support.
- **Themes:** Light, Dark, Sepia and Word Blue.
- **13 languages:** Danish, English, German, French, Spanish, Italian, Dutch, Portuguese, Polish, Swedish, Norwegian (Bokmål), Finnish and Icelandic. MarkNote follows your Windows language by default and you can change it in the status bar or on the Help tab.

## Download

Prebuilt Windows executables are built by GitHub Actions and attached to the releases of this repository. The portable `.exe` needs no installation. The installer also associates `.md` files with MarkNote.

> **Note:** The executables are not code-signed yet, so Windows SmartScreen may show a warning the first time you run one. Choose **More info → Run anyway**.

## Build from source

Requires [Node.js](https://nodejs.org/) 22 or newer.

```bash
npm install
npm start                 # run in development
npm run dist              # portable exe in dist/
npm run dist:installer    # installer exe in dist/
```

The Windows build also runs automatically in GitHub Actions (see `.github/workflows/build.yml`).

## Project structure

| Path | Purpose |
| --- | --- |
| `main.js`, `preload.js` | Electron main process: windows, file dialogs, export |
| `renderer/` | User interface (HTML, CSS, JavaScript) |
| `renderer/strings.js` | Translations. The Danish text is the key for each row |
| `lib/md.js` | Markdown engine shared by the preview and the DOCX export |
| `lib/docx-export.js` | Markdown to DOCX conversion |
| `afterPack.js` | Sets the icon and file properties on the Windows exe |

## Translations

All user interface text lives in `renderer/strings.js` as rows of `[Danish, English, German, French, Spanish, Italian, Dutch, Portuguese, Polish, Swedish, Norwegian, Finnish, Icelandic]`. Corrections from native speakers are very welcome, especially for Finnish, Icelandic and Polish.

## Support

Questions and bug reports: please open an [issue](https://github.com/Cphmartinus/marknote/issues).

## License

[MIT](LICENSE)
