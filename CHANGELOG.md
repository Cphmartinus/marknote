# Changelog

All notable changes to MarkNote are listed here. Release notes for each version are in [`release-notes/`](release-notes).

## Unreleased

- Fixed: the text style dropdown in the right-click menu could not be opened. It is now a Word-style list with previews of Body text and Heading 1–4
- Fixed: the two paste buttons gave the same result. Keep Source Formatting (Ctrl+V) now keeps headings, bold, italic, links, lists and tables from Word, Google Docs and web pages; Keep Text Only (Ctrl+Shift+V) pastes plain text. In the Markdown pane, Keep Source Formatting converts the formatting to Markdown
- The diagram editor's section heading now reads "Steps"
- Help tab: new Support the project button after Project page, linking to Ko-fi

## 1.2.3 – 2026-11-18

- Fixed: start-up sometimes took about 15 seconds on Windows because the window waited for a signal that does not always arrive while it is hidden. The window is now shown as soon as its content has loaded

## 1.2.2 – 2026-11-18

- Word-style right-click menu with a formatting bar (heading, bold, italic, strikethrough, highlight, code, lists, new comment), Cut, Copy, Paste options, Link, Insert submenu, New comment and Select all. Links get Open link and Copy link address; diagrams get Edit diagram

## 1.2.1 – 2026-11-18

- Fixed: MarkNote could hang on the loading screen after installation (until Windows was restarted) when a second copy was started while another was running or still loading
- The window is now always shown within 15 seconds, and a load error shows a message instead of a loading screen that never closes
- A small local start-up log (`startup.log` in MarkNote's data folder) helps troubleshoot start-up problems

## 1.2.0 – 2026-11-17

- Visual diagram editor: create flowcharts, sequence diagrams, pie charts and Gantt charts by filling in tables, with a live preview. Diagrams the editor cannot read open on the Code tab
- User guides are attached to releases

## 1.1.0 – 2026-11-17

- Mermaid diagrams: insert from the Insert tab, drawn in the preview, editable with a double-click, included in PDF, DOCX and HTML exports
- Redesigned Help tab with Help, Shortcuts, About, Report a problem, Project page, language and updates
- Check for updates: automatic daily check (can be turned off) and a button on the Help tab. The installer edition can download, verify and install the new version; the portable edition opens the release page
- Arrow labels in diagrams are shown in a small box on the line
- Office-style look for diagrams in light and dark theme
- Mermaid diagrams: insert from the Insert tab, drawn in the preview, editable with a double-click in the formatted document, and included in PDF, DOCX and HTML exports

## 1.0.1 – 2026-11-11

- One Word-style title bar with the Windows window buttons built in
- Splash screen while MarkNote starts
- New "M" icon
- Fixed: the formatted document in live preview now lines up with the editor

## 1.0.0 – 2026-11-11

- First public release
