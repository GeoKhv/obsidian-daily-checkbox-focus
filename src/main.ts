import { App, Editor, MarkdownView, Notice, Plugin, PluginSettingTab, Setting, TFile } from "obsidian";

const PLUGIN_NAME = "Daily Checkbox Focus";
const PLUGIN_VERSION = "1.1.1";
const AUTO_JUMP_DELAYS_MS = [150, 400, 900, 1600];
const EMPTY_CHECKBOX_RE = /^(\s*[-*+]\s+\[[ \t]\])([ \t]*)$/;
const FENCE_RE = /^\s{0,3}(```+|~~~+)/;
const BLOCKQUOTE_RE = /^\s*>/;
const HEADING_RE = /^\s{0,3}#{1,6}(?:\s|$)/;
const FRONTMATTER_OPEN_RE = /^---\s*$/;
const FRONTMATTER_CLOSE_RE = /^(---|\.\.\.)\s*$/;
const TOP_CAPTURE_CHECKBOX_TEXT = "- [ ] ";

interface DailyCheckboxFocusSettings {
  createMissingTopCheckbox: boolean;
  focusOnOpen: boolean;
}

const DEFAULT_SETTINGS: DailyCheckboxFocusSettings = {
  createMissingTopCheckbox: true,
  focusOnOpen: true,
};

interface FenceState {
  type: string;
  length: number;
}

interface CheckboxTarget {
  line: number;
  ch: number;
}

interface TopCaptureArea {
  startLine: number;
  endLine: number;
}

interface SearchableLine {
  line: number;
  text: string;
}

interface ExistingCheckboxTarget {
  target: CheckboxTarget;
  needsSpacingNormalization: boolean;
}

interface FocusResult {
  target: CheckboxTarget;
  created: boolean;
  spacingNormalized: boolean;
}

interface JumpOptions {
  manual: boolean;
  showNotice: boolean;
}

interface EditorChangeInfo {
  file?: TFile | null;
  view?: MarkdownView | null;
}

export default class DailyCheckboxFocusPlugin extends Plugin {
  settings: DailyCheckboxFocusSettings = { ...DEFAULT_SETTINGS };
  private currentSessionId = 0;
  private currentSessionFilePath: string | null = null;
  private autoJumpDoneForSession = false;
  private userEditedSinceOpen = false;
  private pendingTimers: number[] = [];
  private suppressEditorChangeForFilePath: string | null = null;
  private lastFocusResultFilePath: string | null = null;
  private lastFocusSpacingNormalized: boolean | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new DailyCheckboxFocusSettingTab(this.app, this));

    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        this.startOpenSession(file?.path ?? null);
      })
    );

    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        this.startOpenSession(null);
      })
    );

    this.registerEvent(
      this.app.workspace.on("editor-change", (_editor, info) => {
        this.handleEditorChange(info as EditorChangeInfo | undefined);
      })
    );

    this.app.workspace.onLayoutReady(() => {
      this.startOpenSession(null);
    });

    this.addCommand({
      id: "jump-to-first-empty-checkbox",
      name: "Jump to first empty checkbox",
      callback: () => this.jumpToFirstEmptyCheckbox({ manual: true, showNotice: true }),
    });

    this.addCommand({
      id: "debug-first-empty-checkbox",
      name: "Debug first empty checkbox",
      callback: () => this.debugFirstEmptyCheckbox(),
    });
  }

  onunload(): void {
    this.clearPendingTimers();
  }

  private startOpenSession(fallbackFilePath: string | null): void {
    const nextFilePath = fallbackFilePath || this.getActiveFilePath() || null;

    // Obsidian can emit several open/leaf events for the same file; keep one session.
    if (nextFilePath && nextFilePath === this.currentSessionFilePath) {
      return;
    }

    this.currentSessionId += 1;
    this.currentSessionFilePath = nextFilePath;
    this.autoJumpDoneForSession = false;
    this.userEditedSinceOpen = false;
    this.clearPendingTimers();
    this.scheduleAutoJumpForCurrentFile();
  }

  private scheduleAutoJumpForCurrentFile(): void {
    const sessionId = this.currentSessionId;
    const filePath = this.currentSessionFilePath;

    if (!this.settings.focusOnOpen) {
      return;
    }

    if (!filePath || !this.isDailyFilePath(filePath)) {
      return;
    }

    for (const delay of AUTO_JUMP_DELAYS_MS) {
      const timerId = window.setTimeout(() => {
        this.removePendingTimer(timerId);
        this.attemptAutoJump(sessionId, filePath);
      }, delay);

      this.pendingTimers.push(timerId);
    }
  }

  private attemptAutoJump(sessionId: number, filePath: string): boolean {
    if (!this.settings.focusOnOpen) return false;
    if (sessionId !== this.currentSessionId) return false;
    if (filePath !== this.currentSessionFilePath) return false;
    if (this.getActiveFilePath() !== filePath) return false;
    if (!this.isDailyFilePath(filePath)) return false;
    if (this.autoJumpDoneForSession) return false;
    if (this.userEditedSinceOpen) return false;

    const jumped = this.jumpToFirstEmptyCheckbox({ manual: false, showNotice: false });

    if (jumped) {
      this.autoJumpDoneForSession = true;
      this.clearPendingTimers();
    }

    return jumped;
  }

  private handleEditorChange(info: EditorChangeInfo | undefined): void {
    const changedPath = this.getPathFromEditorInfo(info) || this.getActiveFilePath();

    if (!changedPath || changedPath !== this.currentSessionFilePath) {
      return;
    }

    if (changedPath === this.suppressEditorChangeForFilePath) {
      return;
    }

    this.userEditedSinceOpen = true;
    this.clearPendingTimers();
  }

  private clearPendingTimers(): void {
    for (const timerId of this.pendingTimers) {
      window.clearTimeout(timerId);
    }

    this.pendingTimers = [];
  }

  private removePendingTimer(timerId: number): void {
    this.pendingTimers = this.pendingTimers.filter((pendingTimerId) => pendingTimerId !== timerId);
  }

  private getActiveMarkdownView(): MarkdownView | null {
    return this.app.workspace.getActiveViewOfType(MarkdownView);
  }

  private getActiveFilePath(): string | null {
    const view = this.getActiveMarkdownView();
    return view?.file?.path ?? null;
  }

  private getPathFromEditorInfo(info: EditorChangeInfo | undefined): string | null {
    if (!info) return null;
    if (info.file?.path) return info.file.path;
    if (info.view?.file?.path) return info.view.file.path;
    return null;
  }

  private isDailyFilePath(filePath: string): boolean {
    const fileName = filePath.split("/").pop();
    return /^\d{4}-\d{2}-\d{2}\.md$/.test(fileName ?? "");
  }

  private jumpToFirstEmptyCheckbox({ manual, showNotice }: JumpOptions): boolean {
    const view = this.getActiveMarkdownView();

    if (!view?.file || !view.editor) {
      if (showNotice) new Notice(`${PLUGIN_NAME}: no active markdown editor`);
      return false;
    }

    if (!manual && !this.isDailyFilePath(view.file.path)) {
      return false;
    }

    const result = this.focusOrCreateTopCheckbox(view.editor, view.file.path);

    if (!result) {
      this.lastFocusResultFilePath = view.file.path;
      this.lastFocusSpacingNormalized = null;
      if (showNotice) new Notice(`${PLUGIN_NAME}: top capture checkbox not found`);
      return false;
    }

    const target = result.target;
    this.lastFocusResultFilePath = view.file.path;
    this.lastFocusSpacingNormalized = result.spacingNormalized;

    view.editor.focus();
    view.editor.setCursor({ line: target.line, ch: target.ch });
    view.editor.scrollIntoView(
      {
        from: { line: target.line, ch: 0 },
        to: { line: target.line, ch: target.ch },
      },
      true
    );

    if (showNotice) {
      const action = result.created ? "created and focused" : "jumped to";
      new Notice(`${PLUGIN_NAME}: ${action} line ${target.line + 1}, ch ${target.ch}`);
    }

    return true;
  }

  private focusOrCreateTopCheckbox(editor: Editor, filePath: string): FocusResult | null {
    const area = this.getTopCaptureArea(editor);
    const existingTarget = this.findFirstEmptyCheckboxInTopCaptureArea(editor, area);

    if (existingTarget) {
      if (existingTarget.needsSpacingNormalization) {
        this.suppressEditorChangeForFilePath = filePath;
        editor.replaceRange(" ", { line: existingTarget.target.line, ch: existingTarget.target.ch - 1 });
        window.setTimeout(() => {
          if (this.suppressEditorChangeForFilePath === filePath) {
            this.suppressEditorChangeForFilePath = null;
          }
        }, 0);
      }

      return {
        target: existingTarget.target,
        created: false,
        spacingNormalized: existingTarget.needsSpacingNormalization,
      };
    }

    if (!this.settings.createMissingTopCheckbox) {
      return null;
    }

    const createdTarget = this.insertTopCaptureCheckbox(editor, area, filePath);
    return { target: createdTarget, created: true, spacingNormalized: false };
  }

  private getTopCaptureArea(editor: Editor): TopCaptureArea {
    const startLine = this.getTopCaptureStartLine(editor);
    const endLine = this.getFirstMarkdownHeadingLine(editor, startLine) ?? editor.lineCount();
    return { startLine, endLine };
  }

  private getTopCaptureStartLine(editor: Editor): number {
    if (editor.lineCount() === 0) {
      return 0;
    }

    if (!FRONTMATTER_OPEN_RE.test(editor.getLine(0))) {
      return 0;
    }

    for (let line = 1; line < editor.lineCount(); line += 1) {
      if (FRONTMATTER_CLOSE_RE.test(editor.getLine(line))) {
        return line + 1;
      }
    }

    return 0;
  }

  private getFirstMarkdownHeadingLine(editor: Editor, startLine: number): number | null {
    for (const { line, text } of this.iterSearchableTopLines(editor, startLine, editor.lineCount())) {
      if (HEADING_RE.test(text)) {
        return line;
      }
    }

    return null;
  }

  private findFirstEmptyCheckboxInTopCaptureArea(editor: Editor, area: TopCaptureArea): ExistingCheckboxTarget | null {
    for (const { line, text } of this.iterSearchableTopLines(editor, area.startLine, area.endLine)) {
      const checkboxMatch = text.match(EMPTY_CHECKBOX_RE);

      if (checkboxMatch) {
        const marker = checkboxMatch[1];
        const spacing = checkboxMatch[2];
        const needsSpacingNormalization = spacing.length === 0;
        const targetCh = needsSpacingNormalization ? marker.length + 1 : text.length;

        return { target: { line, ch: targetCh }, needsSpacingNormalization };
      }
    }

    return null;
  }

  private insertTopCaptureCheckbox(editor: Editor, area: TopCaptureArea, filePath: string): CheckboxTarget {
    const checkboxText = TOP_CAPTURE_CHECKBOX_TEXT;
    const hasHeading = area.endLine < editor.lineCount();
    let insertAt = this.getDocumentEndPosition(editor);
    let insertText = checkboxText;
    let targetLine = insertAt.line;

    if (hasHeading) {
      insertAt = { line: area.endLine, ch: 0 };
      targetLine = area.endLine;

      if (area.endLine > area.startLine && editor.getLine(area.endLine - 1).trim() === "") {
        insertAt = { line: area.endLine - 1, ch: 0 };
        targetLine = area.endLine - 1;
        insertText = `${checkboxText}\n`;
      } else {
        insertText = `${checkboxText}\n\n`;
      }
    } else {
      const lastLineText = editor.getLine(insertAt.line);
      insertText = lastLineText.length === 0 ? checkboxText : `\n${checkboxText}`;
      targetLine = lastLineText.length === 0 ? insertAt.line : insertAt.line + 1;
    }

    this.suppressEditorChangeForFilePath = filePath;
    editor.replaceRange(insertText, insertAt);
    window.setTimeout(() => {
      if (this.suppressEditorChangeForFilePath === filePath) {
        this.suppressEditorChangeForFilePath = null;
      }
    }, 0);

    return { line: targetLine, ch: checkboxText.length };
  }

  private getDocumentEndPosition(editor: Editor): CheckboxTarget {
    const line = Math.max(0, editor.lineCount() - 1);
    return { line, ch: editor.getLine(line).length };
  }

  private nextFenceState(currentFence: FenceState | null, marker: string): FenceState | null {
    const type = marker.charAt(0);

    if (!currentFence) {
      return { type, length: marker.length };
    }

    if (currentFence.type === type && marker.length >= currentFence.length) {
      return null;
    }

    return currentFence;
  }

  private debugFirstEmptyCheckbox(): void {
    const view = this.getActiveMarkdownView();

    if (!view?.file || !view.editor) {
      new Notice(`${PLUGIN_NAME}: no active markdown editor`, 10000);
      return;
    }

    const area = this.getTopCaptureArea(view.editor);
    const result = this.findFirstEmptyCheckboxInTopCaptureArea(view.editor, area);
    const target = result?.target ?? null;
    const firstCheckboxLines = this.getFirstCheckboxLinesInTopCaptureArea(view.editor, area);
    const dailyFileMatch = this.isDailyFilePath(view.file.path);
    const wouldCreate = !target && this.settings.createMissingTopCheckbox;
    const wouldNormalizeSpacing = result?.needsSpacingNormalization ?? false;
    const lastFocusSpacingNormalized =
      this.lastFocusResultFilePath === view.file.path && this.lastFocusSpacingNormalized !== null
        ? this.lastFocusSpacingNormalized
        : null;
    const message = [
      `${PLUGIN_NAME} v${PLUGIN_VERSION}`,
      `file: ${view.file.path}`,
      `daily file match: ${dailyFileMatch ? "yes" : "no"}`,
      `top capture area start/end lines: ${this.formatTopCaptureArea(area)}`,
      `empty checkbox found: ${target ? "yes" : "no"}`,
      `target: ${target ? `line ${target.line + 1}, ch ${target.ch}` : "not found"}`,
      `checkbox spacing would be normalized on focus: ${wouldNormalizeSpacing ? "yes" : "no"}`,
      `last focus normalized checkbox spacing: ${this.formatNullableYesNo(lastFocusSpacingNormalized)}`,
      `would create checkbox: ${wouldCreate ? "yes" : "no"}`,
      `open session id: ${this.currentSessionId}`,
      `auto-jump already happened: ${this.autoJumpDoneForSession ? "yes" : "no"}`,
      `user edit detected after open: ${this.userEditedSinceOpen ? "yes" : "no"}`,
      `first [ ] lines in top capture area: ${firstCheckboxLines.length ? firstCheckboxLines.join(" | ") : "none"}`,
    ].join("\n");

    new Notice(message, 12000);
    console.log(`[${PLUGIN_NAME} debug]`, {
      version: PLUGIN_VERSION,
      currentFilePath: view.file.path,
      dailyFileMatch,
      topCaptureArea: area,
      emptyCheckboxFound: Boolean(target),
      target: target ?? null,
      checkboxSpacingWouldBeNormalizedOnFocus: wouldNormalizeSpacing,
      lastFocusNormalizedCheckboxSpacing: lastFocusSpacingNormalized,
      wouldCreateCheckboxWithCurrentSettings: wouldCreate,
      currentSessionId: this.currentSessionId,
      autoJumpDoneForSession: this.autoJumpDoneForSession,
      userEditedSinceOpen: this.userEditedSinceOpen,
      firstLinesContainingCheckboxInTopCaptureArea: firstCheckboxLines,
    });
  }

  private getFirstCheckboxLinesInTopCaptureArea(editor: Editor, area: TopCaptureArea): string[] {
    const lines: string[] = [];

    for (const { line, text } of this.iterSearchableTopLines(editor, area.startLine, area.endLine)) {
      if (text.includes("[ ]")) {
        lines.push(`${line + 1}: ${JSON.stringify(text)}`);
      }
    }

    return lines;
  }

  private *iterSearchableTopLines(editor: Editor, startLine: number, endLine: number): Generator<SearchableLine> {
    let fence: FenceState | null = null;

    for (let line = startLine; line < endLine; line += 1) {
      const text = editor.getLine(line);
      const fenceMatch = text.match(FENCE_RE);

      if (fenceMatch) {
        fence = this.nextFenceState(fence, fenceMatch[1]);
        continue;
      }

      if (fence) continue;
      if (BLOCKQUOTE_RE.test(text)) continue;

      yield { line, text };
    }
  }

  private formatTopCaptureArea(area: TopCaptureArea): string {
    if (area.startLine >= area.endLine) {
      return `empty, start ${area.startLine + 1}, end before ${area.endLine + 1}`;
    }

    return `${area.startLine + 1}-${area.endLine}`;
  }

  private formatNullableYesNo(value: boolean | null): string {
    if (value === null) return "none";
    return value ? "yes" : "no";
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}

class DailyCheckboxFocusSettingTab extends PluginSettingTab {
  plugin: DailyCheckboxFocusPlugin;

  constructor(app: App, plugin: DailyCheckboxFocusPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Create missing top checkbox")
      .setDesc("If no empty checkbox exists before the first heading, insert one in the top capture area.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.createMissingTopCheckbox).onChange(async (value) => {
          this.plugin.settings.createMissingTopCheckbox = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Focus on open")
      .setDesc("Automatically focus the top capture checkbox when opening daily notes.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.focusOnOpen).onChange(async (value) => {
          this.plugin.settings.focusOnOpen = value;
          await this.plugin.saveSettings();
        })
      );
  }
}
