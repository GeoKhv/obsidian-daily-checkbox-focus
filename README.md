# Daily Checkbox Focus

Daily Checkbox Focus is a small Obsidian plugin that moves the editor cursor to the first empty checkbox when you open a daily note.

It is intended for daily notes where the first unchecked task is the next place you want to type.

## What it does

- Detects daily notes by filename: `YYYY-MM-DD.md`.
- Works no matter which folder contains the daily note, for example `Alfa/WRK/2026-05-19.md`.
- On open, jumps once to the first truly empty checkbox line:
  - `- [ ]`
  - `* [ ]`
  - `+ [ ]`
- Places the cursor at the end of the checkbox line.
- Provides manual commands for the active Markdown file:
  - `Jump to first empty checkbox`
  - `Debug first empty checkbox`

## How it works

When a Markdown file opens, the plugin checks whether the filename matches `YYYY-MM-DD.md`. If it does, the plugin briefly retries while Obsidian finishes loading the editor, then moves the cursor to the first empty checkbox line it can safely use.

The automatic jump runs at most once for each file-open session. If you start typing after opening the note, pending automatic jumps are cancelled so your editing is not interrupted.

The plugin ignores empty checkboxes inside fenced code blocks, including `tasks` code blocks, and ignores callout or blockquote lines that start with `>`.

## Installation

After this plugin is approved for the Obsidian Community Plugin Directory:

1. Open Obsidian settings.
2. Go to `Community plugins`.
3. Choose `Browse`.
4. Search for `Daily Checkbox Focus`.
5. Install and enable the plugin.

## Beta or manual installation

Before Community Plugin approval, you can install a release manually:

1. Download `main.js` and `manifest.json` from the GitHub release.
2. In your vault, create `.obsidian/plugins/daily-checkbox-focus/`.
3. Put `main.js` and `manifest.json` in that folder.
4. Restart Obsidian or reload plugins.
5. Enable `Daily Checkbox Focus` in `Community plugins`.

## Troubleshooting

- Confirm your daily note filename is exactly `YYYY-MM-DD.md`, such as `2026-05-19.md`.
- Confirm the target checkbox has no text after it. `- [ ]` works; `- [ ] something` is intentionally skipped.
- Confirm the checkbox is not inside a fenced code block and is not in a callout or blockquote line.
- Run `Debug first empty checkbox` from the command palette to see the current file path, daily-note match status, session state, detected target, and nearby lines containing `[ ]`.
- Open the developer console if you need the structured debug log.

## Privacy and safety

Daily Checkbox Focus does not send data anywhere. It does not use network requests, Node.js APIs, or Electron APIs. It only reads the currently open editor content enough to find an empty checkbox and move the editor cursor.

## Limitations

- Automatic focus only runs for files named `YYYY-MM-DD.md`.
- The daily note may be in any folder, but the filename must match that date format.
- The plugin does not create, delete, or modify notes.
- The plugin does not change Tasks plugin settings or depend on the Tasks plugin.

## Compatibility

- Minimum Obsidian version: `1.0.0`.
- Desktop-only: no. The plugin does not use Node.js or Electron APIs, so `isDesktopOnly` is `false`.

## Releases

Release tags should match the plugin version exactly. For version `1.0.0`, create and push the tag `1.0.0`.
