# Changelog

## 1.2.0

### Added

- Added a `Checkbox search` setting:
  - `Before first heading` keeps the previous top capture behavior.
  - `First on page` focuses the first empty checkbox after optional frontmatter anywhere in the note.
- Added a `Current target` button in settings to show which checkbox would be focused in the current note.

### Changed

- Updated debug output and command names to describe the configured checkbox target.

## 1.1.1

### Fixed

- Created and focused checkboxes now keep a space after the checkbox marker, so typing starts after "- [ ] " instead of immediately after the closing bracket.

## 1.1.0

### Added

- The plugin can now maintain a top capture checkbox by inserting one before the first heading when none exists.

### Fixed

- Focus is now limited to the top capture area before the first heading and no longer jumps into later sections.

## 1.0.0

- Initial public release.
- Auto-focus the first empty checkbox in daily notes named `YYYY-MM-DD.md`.
- Add manual jump and debug commands.
- Ignore fenced code blocks and callout or blockquote lines.
- Cancel pending automatic jumps after user edits or file/session changes.
