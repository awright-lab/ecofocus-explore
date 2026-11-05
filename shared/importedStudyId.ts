let sequence = 0;

/** Fresh identity for a new import, never for updating an existing study. */
export function createImportedStudyId(fileName: string): string {
  const name = fileName.replace(/\.[^.]+$/, "").trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "field";
  sequence += 1;
  // UUID separates browser tabs/server processes. The counter also separates
  // same-clock-tick imports where an older runtime lacks randomUUID.
  const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `dataset_${name}_${Date.now().toString(36)}_${sequence.toString(36)}_${random}`;
}
