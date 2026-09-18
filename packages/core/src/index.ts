export * from "./types.js";
export * from "./ast/index.js";
export * from "./diagnostics/index.js";
export { lex, type LexResult, type Token, type TokenType } from "./lexer/index.js";
export { parse } from "./parser/index.js";
export { format } from "./format/index.js";
export { applyEdits, codeActions, type CodeAction, type TextEdit } from "./edit/index.js";
export {
  resolve,
  type ArchitectureModel, type Component, type ComponentId, type Connection, type Endpoint,
  type GridSpec, type Group, type GroupId, type Pin, type PinAddress, type View,
} from "./resolve/index.js";
export { projectView, Visibility } from "./resolve/views.js";
export { labelStem, stackIdentical } from "./resolve/stack.js";
export { loadLibrary, resolveDefines, type IconDef, type Library, type TemplateDef, type TemplatePin } from "./resolve/library.js";
export { convertIcon, IconError } from "./library/icons.js";
export { loadStandardLibrary, standardLibrary } from "./library/index.js";

import type { ParseResult } from "./diagnostics/index.js";
import { standardLibrary } from "./library/index.js";
import { parse } from "./parser/index.js";
import { resolve, type ArchitectureModel } from "./resolve/index.js";
import type { Library } from "./resolve/library.js";

/** Parse and resolve in one step; diagnostics of both stages in source order. */
export function compile(source: string, library: Library = standardLibrary()): ParseResult<ArchitectureModel> {
  const parsed = parse(source);
  const resolved = resolve(parsed.value, library);
  const diagnostics = [...parsed.diagnostics, ...resolved.diagnostics].sort(
    (a, b) => a.span.start - b.span.start || a.code.localeCompare(b.code),
  );
  return { value: resolved.value, diagnostics };
}
