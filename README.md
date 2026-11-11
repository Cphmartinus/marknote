# MarkNote

Markdown-læser og -editor til Windows 11 i Microsoft Word-stil (bånd/ribbon, faneblade, statuslinje).
Dokumenter gemmes som almindelige `.md`-filer.

## Funktioner
- **Hjem**: skrifttype/-størrelse, fed, kursiv, gennemstreget, fremhævning, overskrifter, lister, tjekliste, citat, kode
- **Indsæt**: tabelbygger, billede (relativ sti, træk-og-slip), link, fodnote, kommentar, LaTeX-formler
- **Visning**: Rå Markdown / Live preview / Læsetilstand, temaer (Lys, Mørk, Sepia, Word Blue), navigationsrude, zoom
- **Sprog**: 13 sprog (da, en, de, fr, es, it, nl, pt, pl, sv, nb, fi, is). Følger Windows-sproget som standard; kan ændres nederst til højre eller under Hjælp
- **Faner**: flere dokumenter ad gangen (Ctrl+N, Ctrl+W, Ctrl+Tab)
- **Åbn Word/HTML**: åbn en .docx eller .html – den konverteres automatisk til Markdown (billeder gemmes i en _billeder-mappe)
- **Eksport & Værktøjer**: PDF, DOCX (ægte Word), HTML, .md · versionshistorik (autosave-snapshots) · find/erstat med regex
- `Ctrl+F1` skjuler båndet. Hold musen over en knap for at se genvej og Markdown-syntaks.

## Byg exe
```bash
cd marknote
npm install
npm run dist            # dist/MarkNote-1.0.0-portable.exe (enkelt exe, ingen installation)
npm run dist:installer  # dist/MarkNote-Setup-1.0.0.exe (installer + .md-filtilknytning)
npm start               # kør i udviklingstilstand
```
Bygges også automatisk på Windows via GitHub Actions (`MarkNote (Windows-exe)`).

## Hjælp og kontakt
Indbygget hjælp under fanen **Hjælp** (F1). Spørgsmål og fejl kan rapporteres som en issue her på GitHub.

## Licens
MIT – se `LICENSE`.
