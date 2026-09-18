import type { ParseResult } from "../diagnostics/index.js";
import { loadLibrary, type Library } from "../resolve/library.js";
import { AUTOMOTIVE_ARCHLIB, ICONS } from "./generated.js";

let standard: ParseResult<Library> | undefined;

/** Standard library (`library/automotive.archlib` + `library/icons/`), embedded at build time. */
export function standardLibrary(): Library {
  return loadStandardLibrary().value;
}

/** Like `standardLibrary()`, but with the diagnostics of the library itself. */
export function loadStandardLibrary(): ParseResult<Library> {
  standard ??= loadLibrary(AUTOMOTIVE_ARCHLIB, ICONS);
  return standard;
}
