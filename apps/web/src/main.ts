import { THEMES, type View } from "@sysarch/core";
import { SplitPane, SysarchEditor, type SplitState } from "@sysarch/editor";
import { PNG_SCALES, svgToPng, type PngScale } from "@sysarch/export-png";
import { toReactFlow } from "@sysarch/export-reactflow";
import { architectureScene } from "@sysarch/render-svg";
import { download, openFile, saveFile, type FileHandle } from "./files.ts";
import { decodeSource, encodeSource, sourceFromHash } from "./share.ts";
import "./style.css";

const DRAFT_KEY = "sysarch:draft";
const SPLIT_KEY = "sysarch:split";
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const examples: Record<string, string> = Object.fromEntries(
  Object.entries(import.meta.glob<string>("../../../examples/*.arch", { query: "?raw", import: "default", eager: true }))
    .map(([path, source]): [string, string] => [path.slice(path.lastIndexOf("/") + 1), source])
    .sort(([a], [b]) => a.localeCompare(b)),
);

const NEW_SOURCE = `architecture "New architecture" {
    theme automotive-light
    direction LR

    component battery: battery { label "KL30" }
    component mcu: microcontroller {
        pin power VDD
    }

    battery -> mcu.VDD
}
`;

// ── messages ───────────────────────────────────────────────────

let toastTimer: ReturnType<typeof setTimeout> | undefined;
function toast(message: string) {
  const element = $("toast");
  element.textContent = message;
  element.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove("visible"), 2500);
}

let fileName = "architecture.arch";
let fileHandle: FileHandle | undefined;

async function initialSource(): Promise<string> {
  const encoded = sourceFromHash(location.hash);
  if (encoded) {
    try {
      fileName = "shared.arch";
      return await decodeSource(encoded);
    } catch {
      toast("The link does not contain a readable source");
    }
  }
  const draft = localStorage.getItem(DRAFT_KEY);
  if (draft !== null) return draft;
  fileName = "zonal-ecu.arch";
  return examples["zonal-ecu.arch"] ?? NEW_SOURCE;
}

const editor = new SysarchEditor({
  editor: $("editor"),
  preview: $("preview"),
  diagnostics: $("diagnostics"),
  source: await initialSource(),
});
if (location.hash) history.replaceState(null, "", location.pathname + location.search);
setFileName(fileName);

// save the draft automatically
let draftTimer: ReturnType<typeof setTimeout> | undefined;
editor.onUpdate(({ source, model }) => {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => localStorage.setItem(DRAFT_KEY, source), 300);
  document.title = `${editor.current.model.title || "sysarch"} — sysarch`;
  syncViews(model.views);
});

// ── views ──────────────────────────────────────────────────────

const viewSelect = $<HTMLSelectElement>("view");
let viewIds = "";

/** The selector only appears once the source declares views; the choice survives edits. */
function syncViews(views: readonly View[]) {
  const ids = views.map((v) => v.id).join(",");
  if (ids === viewIds) return;
  viewIds = ids;
  const selected = viewSelect.value;
  viewSelect.replaceChildren(new Option("everything", ""));
  for (const view of views) viewSelect.add(new Option(view.label, view.id));
  viewSelect.value = views.some((v) => v.id === selected) ? selected : "";
  $("view-group").hidden = views.length === 0;
  // only when the selection really changed — `syncViews` runs on every keystroke
  if ((viewSelect.value || undefined) !== editor.current.view) editor.setView(viewSelect.value || undefined);
}
viewSelect.addEventListener("change", () => editor.setView(viewSelect.value || undefined));
syncViews(editor.current.model.views);

// ── file ───────────────────────────────────────────────────────

function setFileName(name: string) {
  fileName = name;
  $("file-name").textContent = name;
}

function load(name: string, source: string, handle?: FileHandle) {
  fileHandle = handle;
  setFileName(name);
  editor.setSource(source);
  editor.preview.fit();
}

$("new").addEventListener("click", () => load("architecture.arch", NEW_SOURCE));

async function open() {
  const file = await openFile($("file-input"));
  if (file) load(file.name, file.text, file.handle);
}
$("open").addEventListener("click", open);

async function save() {
  const handle = await saveFile(fileName, editor.source, fileHandle);
  if (handle === null) return;
  if (handle) {
    fileHandle = handle;
    setFileName(handle.name);
  }
  toast(`Saved: ${fileName}`);
}
$("save").addEventListener("click", save);

const exampleSelect = $<HTMLSelectElement>("example");
for (const name of Object.keys(examples)) exampleSelect.add(new Option(name, name));
exampleSelect.addEventListener("change", () => {
  const name = exampleSelect.value;
  exampleSelect.value = "";
  if (name) load(name, examples[name]!);
});

// ── Theme & Export ─────────────────────────────────────────────

const themeSelect = $<HTMLSelectElement>("theme");
for (const theme of THEMES) themeSelect.add(new Option(theme, theme));
themeSelect.addEventListener("change", () => editor.setTheme(themeSelect.value || undefined));

const exportName = (extension: string) =>
  fileName.replace(/\.[^.]*$/, "") + (editor.current.view ? `-${editor.current.view}` : "") + extension;

$("export-svg").addEventListener("click", () => {
  const svg = editor.svg;
  if (svg === undefined) return toast("No valid diagram to export");
  download(exportName(".svg"), svg, "image/svg+xml");
});

$("copy-svg").addEventListener("click", async () => {
  const svg = editor.svg;
  if (svg === undefined) return toast("No valid diagram to copy");
  await navigator.clipboard.writeText(svg);
  toast("SVG copied to the clipboard");
});

const scaleSelect = $<HTMLSelectElement>("png-scale");
for (const scale of PNG_SCALES) scaleSelect.add(new Option(`${scale}×`, String(scale), scale === 2, scale === 2));

$("export-png").addEventListener("click", async () => {
  const svg = editor.svg;
  if (svg === undefined) return toast("No valid diagram to export");
  try {
    const png = await svgToPng(svg, Number(scaleSelect.value) as PngScale);
    download(exportName(".png"), png, "image/png");
  } catch {
    toast("PNG could not be created");
  }
});

$("export-reactflow").addEventListener("click", () => {
  const { rendered, svg } = editor.current;
  if (svg === undefined) return toast("The source contains errors — React Flow needs a valid model");
  const flow = toReactFlow(rendered, architectureScene(rendered, themeSelect.value || undefined));
  download(exportName(".reactflow.json"), JSON.stringify(flow, null, 2) + "\n", "application/json");
});

$("share").addEventListener("click", async () => {
  const url = `${location.origin}${location.pathname}#src=${await encodeSource(editor.source)}`;
  await navigator.clipboard.writeText(url);
  toast(url.length > 8000 ? "Link copied — it is very long and will not fit everywhere" : "Link copied");
});

// ── presentation ───────────────────────────────────────────────

async function present(on: boolean) {
  document.body.classList.toggle("presenting", on);
  editor.preview.maxFitScale = on ? 4 : 1;
  if (on && !document.fullscreenElement) await document.documentElement.requestFullscreen?.().catch(() => {});
  if (!on && document.fullscreenElement) await document.exitFullscreen().catch(() => {});
  requestAnimationFrame(() => editor.preview.fit());
}
$("present").addEventListener("click", () => present(true));
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement && document.body.classList.contains("presenting")) present(false);
});
$("fit").addEventListener("click", () => editor.preview.fit());

// ── keyboard & splitter ────────────────────────────────────────

document.addEventListener("keydown", (e) => {
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key === "s") {
    e.preventDefault();
    save();
  } else if (mod && e.key === "o") {
    e.preventDefault();
    open();
  } else if (mod && e.key.toLowerCase() === "e") {
    e.preventDefault();
    split.toggle();
  } else if (e.key === "Escape" && document.body.classList.contains("presenting")) {
    present(false);
  }
});

function savedSplit(): Partial<SplitState> {
  try {
    const stored = localStorage.getItem(SPLIT_KEY);
    return stored ? (JSON.parse(stored) as Partial<SplitState>) : {};
  } catch {
    return {};
  }
}

const split = new SplitPane({
  container: $("workspace"),
  splitter: $("splitter"),
  state: savedSplit(),
  onChange: (state) => localStorage.setItem(SPLIT_KEY, JSON.stringify(state)),
});
$("toggle-editor").addEventListener("click", () => split.toggle());
