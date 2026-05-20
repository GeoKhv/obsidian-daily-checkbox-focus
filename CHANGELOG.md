# Changelog

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
