import {
  compile, hasErrors, parse, standardLibrary,
  type ArchitectureModel, type Diagnostic, type SyntaxTree,
} from "@sysarch/core";
import { renderArchitecture } from "@sysarch/render-svg";

export interface Analysis {
  source: string;
  tree: SyntaxTree;
  model: ArchitectureModel;
  /** Diagnostics from parser and resolver, in source order. */
  diagnostics: Diagnostic[];
  /** Missing on errors — the preview then keeps showing the last valid state. */
  svg?: string;
}

/** Source → syntax tree, semantic model, diagnostics and SVG. Pure function, no DOM. */
export function analyze(source: string, theme?: string): Analysis {
  const library = standardLibrary();
  const { value: model, diagnostics } = compile(source, library);
  const analysis: Analysis = { source, tree: parse(source).value, model, diagnostics };
  if (!hasErrors(diagnostics)) analysis.svg = renderArchitecture(model, theme);
  return analysis;
}
