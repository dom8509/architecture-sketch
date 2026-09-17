import {
  compile, hasErrors, parse, standardLibrary,
  type ArchitectureModel, type Diagnostic, type SyntaxTree,
} from "@sysarch/core";
import { renderArchitecture } from "@sysarch/render-svg";

export interface Analysis {
  source: string;
  tree: SyntaxTree;
  model: ArchitectureModel;
  /** Diagnosen aus Parser und Resolver, in Quelltextreihenfolge. */
  diagnostics: Diagnostic[];
  /** Fehlt bei Fehlern — die Vorschau zeigt dann den letzten gültigen Stand. */
  svg?: string;
}

/** Quelltext → Syntaxbaum, Semantic Model, Diagnosen und SVG. Reine Funktion, ohne DOM. */
export function analyze(source: string, theme?: string): Analysis {
  const library = standardLibrary();
  const { value: model, diagnostics } = compile(source, library);
  const analysis: Analysis = { source, tree: parse(source).value, model, diagnostics };
  if (!hasErrors(diagnostics)) analysis.svg = renderArchitecture(model, theme);
  return analysis;
}
