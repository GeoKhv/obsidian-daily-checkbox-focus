import { Editor, MarkdownView, Notice, Plugin, TFile } from "obsidian";

const PLUGIN_NAME = "Daily Checkbox Focus";
const PLUGIN_VERSION = "1.0.0";
const AUTO_JUMP_DELAYS_MS = [150, 400, 900, 1600];
const EMPTY_CHECKBOX_RE = /^\s*[-*+]\s+\[[ \t]\][ \t]*$/;
const FENCE_RE = /^\s{0,3}(```+|~~~+)/;
const BLOCKQUOTE_RE = /^\s*>/;

interface FenceState {
  type: string;
  length: number;
}

interface CheckboxTarget {
  line: number;
  ch: number;
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
  private currentSessionId = 0;
  private currentSessionFilePath: string | null = null;
  private autoJumpDoneForSession = false;
  private userEditedSinceOpen = false;
  private pendingTimers: number[] = [];

  async onload(): Promise<void> {
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

    const target = this.findFirstEmptyCheckbox(view.editor);

    if (!target) {
      if (showNotice) new Notice(`${PLUGIN_NAME}: empty checkbox not found`);
      return false;
    }

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
      new Notice(`${PLUGIN_NAME}: jumped to line ${target.line + 1}, ch ${target.ch}`);
    }

    return true;
  }

  private findFirstEmptyCheckbox(editor: Editor): CheckboxTarget | null {
    let fence: FenceState | null = null;

    for (let line = 0; line < editor.lineCount(); line += 1) {
      const text = editor.getLine(line);
      const fenceMatch = text.match(FENCE_RE);

      if (fenceMatch) {
        fence = this.nextFenceState(fence, fenceMatch[1]);
        continue;
      }

      if (fence) continue;
      if (BLOCKQUOTE_RE.test(text)) continue;

      if (EMPTY_CHECKBOX_RE.test(text)) {
        return { line, ch: text.length };
      }
    }

    return null;
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

    const target = this.findFirstEmptyCheckbox(view.editor);
    const firstCheckboxLines = this.getFirstCheckboxLines(view.editor, 60);
    const dailyFileMatch = this.isDailyFilePath(view.file.path);
    const message = [
      `${PLUGIN_NAME} v${PLUGIN_VERSION}`,
      `file: ${view.file.path}`,
      `daily file match: ${dailyFileMatch ? "yes" : "no"}`,
      `open session id: ${this.currentSessionId}`,
      `auto-jump already happened: ${this.autoJumpDoneForSession ? "yes" : "no"}`,
      `user edit detected after open: ${this.userEditedSinceOpen ? "yes" : "no"}`,
      `target: ${target ? `line ${target.line + 1}, ch ${target.ch}` : "not found"}`,
      `first [ ] lines within first 60: ${firstCheckboxLines.length ? firstCheckboxLines.join(" | ") : "none"}`,
    ].join("\n");

    new Notice(message, 12000);
    console.log(`[${PLUGIN_NAME} debug]`, {
      version: PLUGIN_VERSION,
      currentFilePath: view.file.path,
      dailyFileMatch,
      currentSessionId: this.currentSessionId,
      autoJumpDoneForSession: this.autoJumpDoneForSession,
      userEditedSinceOpen: this.userEditedSinceOpen,
      target,
      firstLinesContainingCheckboxWithinFirst60: firstCheckboxLines,
    });
  }

  private getFirstCheckboxLines(editor: Editor, limit: number): string[] {
    const lines: string[] = [];
    const maxLine = Math.min(editor.lineCount(), limit);

    for (let line = 0; line < maxLine; line += 1) {
      const text = editor.getLine(line);

      if (text.includes("[ ]")) {
        lines.push(`${line + 1}: ${JSON.stringify(text)}`);
      }
    }

    return lines;
  }
}
