/** Persisted state of the divider: editor width in percent of the workspace, and collapsed. */
export interface SplitState {
  width: number;
  collapsed: boolean;
}

export interface SplitOptions {
  /** Element with the two columns; carries `--sa-editor-width` and `sa-editor-collapsed`. */
  container: HTMLElement;
  /** The divider between editor and preview; gets the separator role and the handlers. */
  splitter: HTMLElement;
  /** Start state; the width is clamped to `MIN`…`MAX`. */
  state?: Partial<SplitState>;
  /** Called after every change — for persisting the state. */
  onChange?: (state: SplitState) => void;
}

/** Percentage bounds of the editor column while dragging. */
const MIN = 15;
const MAX = 85;
const DEFAULT_WIDTH = 42;
/** Step for the arrow keys on the focused divider. */
const STEP = 2;

const clamp = (percent: number) => Math.min(MAX, Math.max(MIN, percent));

/**
 * Divider between the editor and the preview: drag to resize, double-click or `toggle()` to
 * hide the editor. Purely DOM — the columns themselves come from the CSS of the host
 * (web app and Obsidian plugin each bring their own).
 */
export class SplitPane {
  private readonly container: HTMLElement;
  private readonly splitter: HTMLElement;
  private readonly onChange: ((state: SplitState) => void) | undefined;
  private widthPercent: number;
  private hidden: boolean;

  constructor(options: SplitOptions) {
    this.container = options.container;
    this.splitter = options.splitter;
    this.onChange = options.onChange;
    this.widthPercent = clamp(options.state?.width ?? DEFAULT_WIDTH);
    this.hidden = options.state?.collapsed ?? false;

    this.splitter.setAttribute("role", "separator");
    this.splitter.setAttribute("aria-orientation", "vertical");
    this.splitter.setAttribute("aria-label", "Editor width");
    this.splitter.tabIndex = 0;
    this.splitter.addEventListener("pointerdown", this.onPointerDown);
    this.splitter.addEventListener("dblclick", this.onDoubleClick);
    this.splitter.addEventListener("keydown", this.onKeyDown);
    this.apply();
  }

  /** Editor width in percent of the workspace. */
  get width(): number {
    return this.widthPercent;
  }

  get collapsed(): boolean {
    return this.hidden;
  }

  get state(): SplitState {
    return { width: this.widthPercent, collapsed: this.hidden };
  }

  /** Sets the width (in percent, clamped); an invisible editor becomes visible again. */
  setWidth(percent: number) {
    this.widthPercent = clamp(percent);
    this.hidden = false;
    this.apply();
    this.onChange?.(this.state);
  }

  /** Shows or hides the editor; without an argument it switches. */
  toggle(collapsed = !this.hidden) {
    if (collapsed === this.hidden) return;
    this.hidden = collapsed;
    this.apply();
    this.onChange?.(this.state);
  }

  destroy() {
    this.splitter.removeEventListener("pointerdown", this.onPointerDown);
    this.splitter.removeEventListener("dblclick", this.onDoubleClick);
    this.splitter.removeEventListener("keydown", this.onKeyDown);
  }

  private apply() {
    this.container.style.setProperty("--sa-editor-width", `${this.widthPercent}%`);
    this.container.classList.toggle("sa-editor-collapsed", this.hidden);
    this.splitter.setAttribute("aria-valuenow", String(this.hidden ? 0 : Math.round(this.widthPercent)));
    this.splitter.setAttribute("aria-valuemin", String(MIN));
    this.splitter.setAttribute("aria-valuemax", String(MAX));
    this.splitter.title = this.hidden ? "Show the editor (double-click)" : "Drag to resize, double-click to hide the editor";
  }

  private readonly onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    this.splitter.setPointerCapture(event.pointerId);
    this.container.classList.add("sa-splitting");
    let moved = false;
    const move = (m: PointerEvent) => {
      const rect = this.container.getBoundingClientRect();
      if (rect.width === 0) return;
      moved = true;
      this.widthPercent = clamp(((m.clientX - rect.left) / rect.width) * 100);
      this.hidden = false;
      this.apply();
    };
    const up = () => {
      this.splitter.removeEventListener("pointermove", move);
      this.splitter.removeEventListener("pointerup", up);
      this.splitter.removeEventListener("pointercancel", up);
      this.container.classList.remove("sa-splitting");
      if (moved) this.onChange?.(this.state);
    };
    this.splitter.addEventListener("pointermove", move);
    this.splitter.addEventListener("pointerup", up);
    this.splitter.addEventListener("pointercancel", up);
  };

  private readonly onDoubleClick = () => this.toggle();

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      this.setWidth(this.widthPercent + (event.key === "ArrowLeft" ? -STEP : STEP));
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      this.toggle();
    }
  };
}
