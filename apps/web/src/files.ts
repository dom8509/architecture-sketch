/** Öffnen/Speichern über die File System Access API, sonst Upload/Download. */

interface FileHandle {
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>;
}

interface PickerOptions {
  suggestedName?: string;
  types?: { description: string; accept: Record<string, string[]> }[];
}

declare global {
  interface Window {
    showOpenFilePicker?: (options?: PickerOptions) => Promise<FileHandle[]>;
    showSaveFilePicker?: (options?: PickerOptions) => Promise<FileHandle>;
  }
}

const TYPES = [{ description: "sysarch-Architektur", accept: { "text/plain": [".arch"] } }];

export interface OpenedFile {
  name: string;
  text: string;
  handle?: FileHandle;
}

export type { FileHandle };

const isAbort = (e: unknown) => e instanceof DOMException && e.name === "AbortError";

export async function openFile(fallback: HTMLInputElement): Promise<OpenedFile | undefined> {
  if (window.showOpenFilePicker) {
    try {
      const [handle] = await window.showOpenFilePicker({ types: TYPES });
      if (!handle) return undefined;
      return { name: handle.name, text: await (await handle.getFile()).text(), handle };
    } catch (e) {
      if (isAbort(e)) return undefined;
      throw e;
    }
  }
  return new Promise((resolve) => {
    fallback.value = "";
    fallback.onchange = async () => {
      const file = fallback.files?.[0];
      resolve(file ? { name: file.name, text: await file.text() } : undefined);
    };
    fallback.click();
  });
}

/** Schreibt in den Handle bzw. fragt nach einem Ziel; ohne API wird heruntergeladen. Liefert den (neuen) Handle. */
export async function saveFile(name: string, text: string, handle?: FileHandle): Promise<FileHandle | undefined | null> {
  try {
    if (!handle && window.showSaveFilePicker) handle = await window.showSaveFilePicker({ suggestedName: name, types: TYPES });
    if (handle) {
      const writable = await handle.createWritable();
      await writable.write(text);
      await writable.close();
      return handle;
    }
  } catch (e) {
    if (isAbort(e)) return null;
    throw e;
  }
  download(name, text, "text/plain");
  return undefined;
}

export function download(name: string, content: string | Blob, type: string) {
  const url = URL.createObjectURL(content instanceof Blob ? content : new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
