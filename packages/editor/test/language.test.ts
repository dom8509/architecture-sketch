import { CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { analyze, classify, sysarchCompletion } from "../src/index.js";

describe("classify", () => {
  it("unterscheidet Schlüsselwörter, Werte, Namen, Templates, Pins und Kommentare", () => {
    const source = `// Kopf\narchitecture "A" {\n    component pin: mcu { pin can size }\n    pin.size -> x\n}`;
    const classes = classify(source).map((r) => `${source.slice(r.start, r.end)}:${r.class}`);
    expect(classes).toEqual([
      "// Kopf:comment", "architecture:keyword", `"A":string`, "{:punctuation",
      "component:keyword", "pin:definition", "::punctuation", "mcu:template", "{:punctuation",
      "pin:keyword", "can:value", "size:keyword", "}:punctuation",
      ".:punctuation", "size:pin", "->:operator", "}:punctuation",
    ]);
  });
});

describe("Autocomplete", () => {
  const source = [
    `define local_part { label "L" }`,
    `architecture "A" {`,
    `    component trx: can_transceiver`,
    `    component mcu: `,
    `    component x { pin  }`,
    `    trx.`,
    `    trx -> mcu { type e }`,
    `    theme `,
    `}`,
  ].join("\n");
  const analysis = analyze(source);
  const complete = sysarchCompletion(() => analysis);
  const at = (marker: string, offset = marker.length) => {
    const state = EditorState.create({ doc: source });
    return complete(new CompletionContext(state, source.indexOf(marker) + offset, true)) as CompletionResult | null;
  };
  const labels = (r: CompletionResult | null) => r?.options.map((o) => o.label) ?? [];

  it("Template-Namen nach `:` inklusive lokaler defines", () => {
    const names = labels(at("component mcu: "));
    expect(names).toContain("microcontroller");
    expect(names).toContain("local_part");
  });

  it("Pin-Namen nach `komponente.`", () => {
    expect(labels(at("trx."))).toEqual(analysis.model.components.get("trx")!.pins.map((p) => p.name));
  });

  it("Signalarten nach `pin` und `type`, Themes nach `theme`", () => {
    expect(labels(at("pin  }", 4))).toContain("can");
    const type = at("type e");
    expect(type?.from).toBe(source.indexOf("type e") + 5);
    expect(labels(type)).toContain("ethernet");
    expect(labels(at("theme "))).toContain("automotive-dark");
  });

  it("sonst keine Vorschläge", () => {
    expect(at("architecture")).toBeNull();
  });
});
