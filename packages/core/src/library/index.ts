import type { ParseResult } from "../diagnostics/index.js";
import { loadLibrary, type Library } from "../resolve/library.js";
import { AUTOMOTIVE_ARCHLIB, ICONS } from "./generated.js";

let standard: ParseResult<Library> | undefined;

/** Standardbibliothek (`library/automotive.archlib` + `library/icons/`), zur Build-Zeit eingebettet. */
export function standardLibrary(): Library {
  return loadStandardLibrary().value;
}

/** Wie `standardLibrary()`, aber mit den Diagnosen der Bibliothek selbst. */
export function loadStandardLibrary(): ParseResult<Library> {
  standard ??= loadLibrary(AUTOMOTIVE_ARCHLIB, ICONS);
  return standard;
}
