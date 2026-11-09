import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { importDatasetBuffer } from "../../data/datasetImportModel";
import { exportPreparationCheckpointFile, importPreparationCheckpointFile, inspectPreparationCheckpointFile, restorePreparationCheckpoint, savePreparationCheckpoint } from "../preparationCheckpoint";
import { previewPreparation } from "../preparationModel";
class MemoryStorage implements Storage {
  values = new Map<string, string>(); get length() { return this.values.size; }
  clear() { this.values.clear(); } key(i: number) { return [...this.values.keys()][i] ?? null; }
  getItem(key: string) { return this.values.get(key) ?? null; } setItem(key: string, raw: string) { this.values.set(key, raw); } removeItem(key: string) { this.values.delete(key); }
}
beforeEach(() => vi.stubGlobal("crypto", webcrypto)); afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function fixture() {
  const { dataset } = await importDatasetBuffer(new TextEncoder().encode("Region,Other\nNorth,original respondent\nSOUTH,original respondent\n").buffer, "synthetic-checkpoint-file.csv"); const source = dataset!, storage = new MemoryStorage(), report = "portable-report";
  const editor = { sourceId: source.id, title: "Portable unfinished recipe", history: [{ id: "lower-1", fieldId: source.fields[0].id, sourceColumn: "Region", kind: "lowercase" as const, from: [], to: "" }], cursor: 1, fieldId: source.fields[0].id, kind: "recode" as const, from: ["north"], to: "Private synthetic target" };
  const key = await savePreparationCheckpoint(storage, report, editor, () => [source]); return { source, editor, storage, report, key, text: exportPreparationCheckpointFile(storage, report, key) };
}
it("exports, inspects, imports and restores exact recipe content in separate storage while preserving source and workspace data", async () => {
  const f = await fixture(), target = new MemoryStorage(), before = structuredClone(f.source); target.setItem("workspace", "original workspace bytes"); const info = inspectPreparationCheckpointFile(f.text, f.report);
  expect(info.title).toBe(f.editor.title); expect(info.sourceId).toBe(f.source.id); expect(info.editorText).toContain("Private synthetic target"); expect(f.text).not.toContain("original respondent");
  const imported = importPreparationCheckpointFile(target, f.report, f.text); expect(imported.alreadyPresent).toBe(false); expect(imported.key).not.toBe(f.key); expect(JSON.parse(target.getItem(imported.key)!)).toEqual({ ...JSON.parse(f.storage.getItem(f.key)!), id: imported.key.slice(-36) });
  const restored = await restorePreparationCheckpoint(target, f.report, imported.key, () => [structuredClone(f.source)]); expect(restored).toEqual(f.editor); const preview = await previewPreparation(f.source, restored.history.slice(0, restored.cursor), restored.title); expect(preview.dataset.rows.map(row => row.Region)).toEqual(["north", "south"]); expect(preview.recipe.steps).toHaveLength(1); expect(f.source).toEqual(before); expect(target.getItem("workspace")).toBe("original workspace bytes"); expect(f.storage.length).toBe(1);
});
it("does not use another slot or write an exact existing copy, even at the eight-record limit", async () => {
  const f = await fixture(); for (let i = 1; i < 8; i++) await savePreparationCheckpoint(f.storage, f.report, { ...f.editor, title: `Checkpoint ${i}` }, () => [f.source]); const before = new Map(f.storage.values), write = vi.spyOn(f.storage, "setItem");
  expect(importPreparationCheckpointFile(f.storage, f.report, f.text).alreadyPresent).toBe(true); expect(write).not.toHaveBeenCalled(); expect(f.storage.values).toEqual(before);
});
it("refuses a ninth checkpoint without eviction or changing the file", async () => {
  const f = await fixture(), target = new MemoryStorage(); for (let i = 0; i < 8; i++) await savePreparationCheckpoint(target, f.report, { ...f.editor, title: `Existing ${i}` }, () => [f.source]); const before = new Map(target.values), text = f.text;
  expect(() => importPreparationCheckpointFile(target, f.report, text)).toThrow("eight recovery checkpoints"); expect(target.values).toEqual(before); expect(f.text).toBe(text);
});
it("refuses different content under an existing identity without replacing either copy", async () => {
  const f = await fixture(), file = JSON.parse(f.text), c = JSON.parse(file.raw); c.editor.to = "Different file target"; file.raw = JSON.stringify(c); const text = JSON.stringify(file), before = new Map(f.storage.values);
  expect(() => importPreparationCheckpointFile(f.storage, f.report, text)).toThrow("different contents"); expect(f.storage.values).toEqual(before); expect(JSON.parse(JSON.parse(text).raw).editor.to).toBe("Different file target");
});
it.each(["tag", "version", "extra", "raw", "key", "oversized"])("refuses unsupported %s before writing", async mode => {
  const f = await fixture(), value = JSON.parse(f.text), target = new MemoryStorage();
  if (mode === "tag") value.format = "Other backup"; else if (mode === "version") value.version = 99; else if (mode === "extra") value.extra = "preserve outside browser"; else if (mode === "raw") value.raw = "broken JSON"; else if (mode === "key") value.key = "workspace";
  const text = mode === "oversized" ? "x".repeat(196609) : JSON.stringify(value); expect(() => inspectPreparationCheckpointFile(text, f.report)).toThrow(); expect(() => importPreparationCheckpointFile(target, f.report, text)).toThrow(); expect(target.length).toBe(0);
});
it("refuses cross-report imports and damaged stored exports", async () => {
  const f = await fixture(), target = new MemoryStorage(); expect(() => importPreparationCheckpointFile(target, "another-report", f.text)).toThrow(); expect(target.length).toBe(0); f.storage.setItem(f.key, "damaged record"); expect(() => exportPreparationCheckpointFile(f.storage, f.report, f.key)).toThrow(); expect(f.storage.getItem(f.key)).toBe("damaged record");
});
it("keeps imported recipes unusable until the exact original is available and refuses a changed source", async () => {
  const f = await fixture(), target = new MemoryStorage(); const imported = importPreparationCheckpointFile(target, f.report, f.text); await expect(restorePreparationCheckpoint(target, f.report, imported.key, () => [])).rejects.toThrow("missing or ambiguous"); f.source.rows[0].Region = "Replacement"; await expect(restorePreparationCheckpoint(target, f.report, imported.key, () => [f.source])).rejects.toThrow("original study changed"); expect(JSON.parse(target.getItem(imported.key)!).editor).toEqual(f.editor);
});
it("preserves older records on quota failure and safely reuses an uncertain imported copy on retry", async () => {
  const f = await fixture(), target = new MemoryStorage(); target.setItem("workspace", "original bytes"); vi.spyOn(target, "setItem").mockImplementationOnce(() => { throw Error("Synthetic quota failure"); }); expect(() => importPreparationCheckpointFile(target, f.report, f.text)).toThrow("quota"); expect(target.length).toBe(1);
  const get = target.getItem.bind(target); let failRead = true; vi.spyOn(target, "getItem").mockImplementation(key => { if (failRead && key !== "workspace" && target.values.has(key)) { failRead = false; throw Error("Synthetic read acknowledgement failure"); } return get(key); }); expect(() => importPreparationCheckpointFile(target, f.report, f.text)).toThrow("acknowledgement"); const copyKey = [...target.values.keys()].find(key => key !== "workspace")!; expect(JSON.parse(target.values.get(copyKey)!).editor).toEqual(f.editor); expect(importPreparationCheckpointFile(target, f.report, f.text)).toEqual({ key: copyKey, alreadyPresent: true }); expect(target.length).toBe(2); expect(target.getItem("workspace")).toBe("original bytes");
});
it("retains both differently edited files when their imports interleave before the first write", async () => {
  const f = await fixture(), target = new MemoryStorage(), b = JSON.parse(f.text), c = JSON.parse(b.raw); c.editor.to = "Version B concurrent target"; b.raw = JSON.stringify(c); const textB = JSON.stringify(b), set = target.setItem.bind(target); let importedB: ReturnType<typeof importPreparationCheckpointFile> | undefined;
  vi.spyOn(target, "setItem").mockImplementationOnce((key, raw) => { importedB = importPreparationCheckpointFile(target, f.report, textB); set(key, raw); });
  const importedA = importPreparationCheckpointFile(target, f.report, f.text); expect(importedB).toBeDefined(); expect(importedA.key).not.toBe(importedB!.key); expect(target.length).toBe(2); expect(JSON.parse(target.getItem(importedA.key)!).editor.to).toBe(f.editor.to); expect(JSON.parse(target.getItem(importedB!.key)!).editor.to).toBe("Version B concurrent target"); expect(f.storage.getItem(f.key)).toBe(JSON.parse(f.text).raw);
});
