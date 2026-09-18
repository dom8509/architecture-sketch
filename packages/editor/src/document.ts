import {
  compile, hasErrors, parse, projectView, standardLibrary,
  type ArchitectureModel, type Diagnostic, type SyntaxTree,
} from "@sysarch/core";
import { renderArchitecture } from "@sysarch/render-svg";

export interface Analysis {
  source: string;
  tree: SyntaxTree;
  /** The whole model — every view, for completion and quick fixes. */
  model: ArchitectureModel;
  /** The model that was rendered: `model` reduced to `view`, or `model` itself. */
  rendered: ArchitectureModel;
  /** The view that was rendered; missing if the document declares none or it is unknown. */
  view?: string;
  /** Diagnostics from parser and resolver, in source order. */
  diagnostics: Diagnostic[];
  /** Missing on errors — the preview then keeps showing the last valid state. */
  svg?: string;
}

/**
 * Source → syntax tree, semantic model, diagnostics and SVG. Pure function, no DOM.
 * `view` picks one of the declared views; without it the whole architecture is rendered.
 */
export function analyze(source: string, theme?: string, view?: string): Analysis {
  const library = standardLibrary();
  const { value: model, diagnostics } = compile(source, library);
  const shown = view !== undefined && model.views.some((v) => v.id === view) ? view : undefined;
  const rendered = shown === undefined ? model : projectView(model, shown);
  const analysis: Analysis = {
    source, tree: parse(source).value, model, rendered, ...(shown && { view: shown }), diagnostics,
  };
  if (!hasErrors(diagnostics)) analysis.svg = renderArchitecture(rendered, theme);
  return analysis;
}
