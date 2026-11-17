# Privacy policy

**MarkNote** is a desktop program that works on your own computer. This page explains what it does, and does not do, with your data.

## Summary

- MarkNote does **not** collect, store on a server, or transmit personal data.
- MarkNote has **no telemetry, analytics, tracking, advertising or accounts**.
- MarkNote checks GitHub for new versions at most once a day. You can turn this off.
- Your documents stay on your computer. MarkNote only reads and writes files that you open or save.

## What is stored on your computer

| What | Where | Why |
| --- | --- | --- |
| Settings (theme, language, font, zoom, last used tab) | Local browser storage inside the MarkNote profile | To remember your preferences |
| List of recently opened files | A small file in the MarkNote application data folder (`%APPDATA%`) | To show the "recent files" list |
| Automatic snapshots of your documents | The MarkNote application data folder (`%APPDATA%`) | For the version history feature (the 60 latest snapshots per document are kept) |
| Images extracted from Word files | A folder next to the `.docx` file you opened | So the converted Markdown can show the images |

All of this stays on your computer. You can remove it by deleting the MarkNote folder in `%APPDATA%`, or by uninstalling the program.

## Network access

MarkNote does not contact any server of its own.

The program connects to the internet only in these cases:

- **Update check:** At most once a day, and when you click *Check for updates* on the Help tab, MarkNote asks GitHub's public API (`api.github.com`) which version is the newest. No document content or personal data is sent, but GitHub can see your IP address, as with any web request. You can turn the automatic check off on the Help tab. If you choose *Download and install*, the installer is downloaded from GitHub and its checksum is verified before it runs.

- **Links:** When you click a web or e-mail link in a document, it is opened in your default browser or mail program.
- **Remote images:** If a Markdown document contains an image with a web address (`https://…`), the image is loaded from that address when the document is displayed, like in any web browser. The owner of that server can see that the image was requested. Documents that only use local images make no requests.

## Spell checking

Spell checking uses the dictionaries of your operating system. Text is not sent to MarkNote's authors or to any online service by MarkNote.

## Export and conversion

Exporting to PDF, DOCX, HTML or Markdown, and converting Word or HTML files, happen entirely on your computer.

## Children

MarkNote does not collect any personal data from anyone, including children.

## Changes

If this policy changes, the new version will be published in this repository with the release it applies to.

## Contact

Questions about this policy: open an [issue](https://github.com/Cphmartinus/marknote/issues).
