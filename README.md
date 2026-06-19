# Daily Checkbox Focus

Daily Checkbox Focus is a small Obsidian plugin that moves the editor cursor to a configured empty checkbox when you open a daily note.

It is intended for daily notes where the first empty checkbox in your preferred capture area is the next place you want to type.

## What it does

- Detects daily notes by filename: `YYYY-MM-DD.md`.
- Works no matter which folder contains the daily note, for example `Alfa/WRK/2026-05-19.md`.
- On open, jumps once to the first truly empty checkbox line in the configured search area:
  - `- [ ] `
  - `* [ ] `
  - `+ [ ] `
- Inserts one missing empty checkbox in the top capture area when that setting is enabled.
- Places the cursor after the checkbox marker and at least one following space.
- Lets you choose whether to search before the first heading or across the full note after optional frontmatter.
- Provides manual commands for the active Markdown file:
  - `Jump to configured empty checkbox`
  - `Show configured checkbox target`

## Checkbox search modes

By default, the plugin searches the top capture area. The top capture area starts at the beginning of the file, after optional YAML frontmatter, and ends before the first Markdown heading:

```md
---
date: 2026-05-20
---

- [ ]

# Work
```

In this mode, the plugin only searches this area. It never focuses empty checkboxes below the first heading, so sections such as `# Work`, `## Todo.Family`, `# Life`, or `# Hobbies` are left alone.

You can change `Checkbox search` to `First on page` if you want the plugin to focus the first empty checkbox after optional YAML frontmatter anywhere in the note, including below headings.

## How it works

When a Markdown file opens, the plugin checks whether the filename matches `YYYY-MM-DD.md`. If it does, the plugin briefly retries while Obsidian finishes loading the editor, then moves the cursor to the first empty checkbox line it can safely use in the configured search area.

If there is no matching empty checkbox and `Create missing checkbox` is enabled, the plugin inserts one empty checkbox immediately before the first heading and keeps one blank line before that heading. If the note has YAML frontmatter and no content before the first heading, the checkbox is inserted after the frontmatter.

The automatic jump runs at most once for each file-open session. If you start typing after opening the note, pending automatic jumps are cancelled so your editing is not interrupted.

The plugin ignores empty checkboxes inside fenced code blocks, including `tasks` code blocks, and ignores callout or blockquote lines that start with `>`.

## Settings

- `Checkbox search`: `Before first heading` by default. Choose `First on page` to search the full note after optional YAML frontmatter.
- `Create missing checkbox`: enabled by default. When enabled, the plugin inserts one empty checkbox before the first heading if no matching empty checkbox exists. When disabled, the plugin only focuses an existing empty checkbox.
- `Focus on open`: enabled by default. When disabled, automatic focus on daily-note open is turned off, but the manual command still works.
- `Current target`: shows which checkbox would be focused in the current note.

## Installation

1. Open Obsidian settings.
2. Go to `Community plugins`.
3. Choose `Browse`.
4. Search for `Daily Checkbox Focus`.
5. Install and enable the plugin.

## Manual installation

You can also install a release manually:

1. Download `main.js` and `manifest.json` from the GitHub release.
2. In your vault, create `.obsidian/plugins/daily-checkbox-focus/`.
3. Put `main.js` and `manifest.json` in that folder.
4. Restart Obsidian or reload plugins.
5. Enable `Daily Checkbox Focus` in `Community plugins`.

## Troubleshooting

- Confirm your daily note filename is exactly `YYYY-MM-DD.md`, such as `2026-05-19.md`.
- Confirm the target checkbox is inside the configured search area and has no text after it. `- [ ] ` works; `- [ ] something` is intentionally skipped.
- Confirm the checkbox is not inside a fenced code block and is not in a callout or blockquote line.
- Check `Create missing checkbox` if you expect the plugin to insert a missing top checkbox.
- Run `Show configured checkbox target` from the command palette or press `Current target` in settings to see the current file path, daily-note match status, search range, session state, detected target, and nearby search-area lines containing `[ ]`.
- Open the developer console if you need the structured debug log.

## Privacy and safety

Daily Checkbox Focus does not send data anywhere. It does not use network requests, Node.js APIs, or Electron APIs. It only reads the currently open editor content enough to find or insert the configured checkbox target and move the editor cursor.

## Limitations

- Automatic focus only runs for files named `YYYY-MM-DD.md`.
- The daily note may be in any folder, but the filename must match that date format.
- The plugin may insert one empty checkbox before the first heading when `Create missing checkbox` is enabled.
- The plugin does not change Tasks plugin settings or depend on the Tasks plugin.

## Compatibility

- Minimum Obsidian version: `1.0.0`.
- Desktop-only: no. The plugin does not use Node.js or Electron APIs, so `isDesktopOnly` is `false`.

## Releases

Release tags should match the plugin version exactly. For version `1.2.0`, create and push the tag `1.2.0`.
