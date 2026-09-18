import type { View } from "@sysarch/core";

/**
 * Selector for the views of a document (`view <id>`). It stays hidden as long as the source
 * declares none, so a diagram without views looks exactly as before.
 */
export class ViewSelect {
  readonly element: HTMLSelectElement;
  private ids = "";
  private emitted: string | undefined;

  constructor(parent: HTMLElement, private readonly onChange: (view: string | undefined) => void) {
    this.element = parent.appendChild(document.createElement("select"));
    this.element.className = "sa-view-select";
    this.element.title = "Level of abstraction";
    this.element.hidden = true;
    this.element.addEventListener("change", () => this.emit());
  }

  /** The selected view, or `undefined` for the whole architecture. */
  get value(): string | undefined {
    return this.element.value || undefined;
  }

  /** Takes over a new list of views; an existing selection survives as long as it exists. */
  sync(views: readonly View[]) {
    const ids = views.map((v) => v.id).join(",");
    if (ids === this.ids) return;
    this.ids = ids;
    const selected = this.element.value;
    this.element.replaceChildren(new Option("everything", ""));
    for (const view of views) this.element.add(new Option(view.label, view.id));
    this.element.value = views.some((v) => v.id === selected) ? selected : "";
    this.element.hidden = views.length === 0;
    this.emit();
  }

  /** Reports the selection only when it really changed — `sync` runs on every keystroke. */
  private emit() {
    if (this.value === this.emitted) return;
    this.emitted = this.value;
    this.onChange(this.value);
  }
}
