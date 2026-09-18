import { scopeSvg } from "./scope.js";

let instances = 0;

/** Preview: inline SVG with zoom (mouse wheel) and pan (drag); double click fits to the area. */
export class Preview {
  readonly element: HTMLElement;
  private readonly canvas: HTMLElement;
  private svg: string | undefined;
  private readonly prefix = `sa${++instances}`;
  private scale = 1;
  private x = 0;
  private y = 0;
  private fitted = true;
  /** Upper bound when fitting; the presentation view may scale up. */
  maxFitScale = 1;
  private readonly resize: ResizeObserver;

  constructor(parent: HTMLElement) {
    this.element = parent.appendChild(document.createElement("div"));
    this.element.className = "sa-preview";
    this.canvas = this.element.appendChild(document.createElement("div"));
    this.canvas.className = "sa-preview-canvas";

    this.element.addEventListener("wheel", (e) => {
      e.preventDefault();
      const rect = this.element.getBoundingClientRect();
      this.zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * 0.002));
    }, { passive: false });

    this.element.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      const start = { px: e.clientX, py: e.clientY, x: this.x, y: this.y };
      this.element.setPointerCapture(e.pointerId);
      this.element.classList.add("sa-panning");
      const move = (m: PointerEvent) => {
        this.x = start.x + m.clientX - start.px;
        this.y = start.y + m.clientY - start.py;
        this.fitted = false;
        this.apply();
      };
      const up = () => {
        this.element.removeEventListener("pointermove", move);
        this.element.removeEventListener("pointerup", up);
        this.element.removeEventListener("pointercancel", up);
        this.element.classList.remove("sa-panning");
      };
      this.element.addEventListener("pointermove", move);
      this.element.addEventListener("pointerup", up);
      this.element.addEventListener("pointercancel", up);
    });
    this.element.addEventListener("dblclick", () => this.fit());

    this.resize = new ResizeObserver(() => {
      if (this.fitted) this.fit();
    });
    this.resize.observe(this.element);
  }

  /** Shows a new SVG; without one the last valid state stays and is marked as stale. */
  show(svg: string | undefined) {
    this.element.classList.toggle("sa-stale", svg === undefined && this.svg !== undefined);
    if (svg === undefined || svg === this.svg) return;
    const first = this.svg === undefined;
    this.svg = svg;
    this.canvas.innerHTML = scopeSvg(svg, this.prefix);
    if (first || this.fitted) this.fit();
  }

  /** Scales the diagram to the area (at most `maxFitScale`) and centers it. */
  fit() {
    const size = this.size();
    const { clientWidth: w, clientHeight: h } = this.element;
    if (!size || w === 0 || h === 0) return;
    const margin = 24;
    this.scale = Math.min(this.maxFitScale, (w - 2 * margin) / size.width, (h - 2 * margin) / size.height);
    this.x = (w - size.width * this.scale) / 2;
    this.y = (h - size.height * this.scale) / 2;
    this.fitted = true;
    this.apply();
  }

  zoomAt(px: number, py: number, factor: number) {
    const scale = Math.min(8, Math.max(0.05, this.scale * factor));
    this.x = px - ((px - this.x) * scale) / this.scale;
    this.y = py - ((py - this.y) * scale) / this.scale;
    this.scale = scale;
    this.fitted = false;
    this.apply();
  }

  destroy() {
    this.resize.disconnect();
    this.element.remove();
  }

  private size() {
    const svg = this.canvas.querySelector("svg");
    if (!svg) return undefined;
    return { width: svg.width.baseVal.value, height: svg.height.baseVal.value };
  }

  private apply() {
    this.canvas.style.transform = `translate(${this.x}px, ${this.y}px) scale(${this.scale})`;
  }
}
