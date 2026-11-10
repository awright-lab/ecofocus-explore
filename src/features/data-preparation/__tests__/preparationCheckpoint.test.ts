import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { importDatasetBuffer } from "../../data/datasetImportModel";
import { listPreparationCheckpoints, restorePreparationCheckpoint, savePreparationCheckpoint, type PreparationEditorCheckpoint } from "../preparationCheckpoint";
class MemoryStorage implements Storage {
  values = new Map<string, string>(); get length() { return this.values.size; }
  clear() { this.values.clear(); } key(i: number) { return [...this.values.keys()][i] ?? null; }
  getItem(key: string) { return this.values.get(key) ?? null; } setItem(key: string, raw: string) { this.values.set(key, raw); } removeItem(key: string) { this.values.delete(key); }
}
beforeEach(() => vi.stubGlobal("crypto", webcrypto)); afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function fixture() {
  const { dataset } = await importDatasetBuffer(new TextEncoder().encode("Region,Private\nNorth,respondent-untouched\nSouth,respondent-untouched\n").buffer, "checkpoint-synthetic.csv");
  const e: PreparationEditorCheckpoint = { sourceId: dataset!.id, title: "Unfinished study", history: [{ id: "step-1", fieldId: dataset!.fields[0].id, sourceColumn: "Region", kind: "lowercase", from: [], to: "" }, { id: "step-2", fieldId: dataset!.fields[0].id, sourceColumn: "Region", kind: "uppercase", from: [], to: "" }], cursor: 1, fieldId: dataset!.fields[0].id, kind: "recode", from: ["north"], to: "Combined unfinished" };
  return { source: dataset!, e, storage: new MemoryStorage(), report: "report:one" };
}
it("round-trips history, undo cursor and unapplied choices without storing response rows or changing source/workspace keys", async () => {
  const { source, e, storage, report } = await fixture(), before = structuredClone(source); storage.setItem("workspace", "original workspace");
  const key = await savePreparationCheckpoint(storage, report, e, () => [source]); expect(await restorePreparationCheckpoint(storage, report, key, () => [source])).toEqual(e);
  expect(storage.getItem(key)).not.toContain("respondent-untouched"); expect(storage.getItem(key)).not.toContain('"rows"'); expect(storage.getItem("workspace")).toBe("original workspace"); expect(source).toEqual(before); expect(listPreparationCheckpoints(storage, report).items).toHaveLength(1); expect(listPreparationCheckpoints(storage, "other").items).toEqual([]);
});
it.each(["row", "field", "import-event", "other-metadata"])("refuses changed %s source and retains checkpoint bytes", async change => {
  const { source, e, storage, report } = await fixture(), key = await savePreparationCheckpoint(storage, report, e, () => [source]), raw = storage.getItem(key);
  if (change === "row") source.rows[0].Region = "Changed"; else if (change === "field") source.fields[0].label += " changed"; else if (change === "import-event") source.importedAt = "2026-01-01T00:00:00.000Z"; else source.notes.push("Changed import metadata");
  await expect(restorePreparationCheckpoint(storage, report, key, () => [source])).rejects.toThrow("original study changed"); expect(storage.getItem(key)).toBe(raw);
});
it("refuses missing or duplicate sources, and cross-report keys", async () => {
  const { source, e, storage, report } = await fixture(), key = await savePreparationCheckpoint(storage, report, e, () => [source]);
  await expect(restorePreparationCheckpoint(storage, report, key, () => [])).rejects.toThrow("missing or ambiguous"); await expect(restorePreparationCheckpoint(storage, report, key, () => [source, source])).rejects.toThrow("missing or ambiguous"); await expect(restorePreparationCheckpoint(storage, "other", key, () => [source])).rejects.toThrow("belonging to this report"); expect(storage.length).toBe(1);
});
it("refuses source changes during hash and cancellation before persistence", async () => {
  const { source, e, storage, report } = await fixture(); const pending = savePreparationCheckpoint(storage, report, e, () => [source]); source.rows[0].Region = "Changed during digest";
  await expect(pending).rejects.toThrow("original changed while checkpointing"); expect(storage.length).toBe(0);
  const controller = new AbortController(), canceled = savePreparationCheckpoint(storage, report, e, () => [source], controller.signal); controller.abort(); await expect(canceled).rejects.toThrow("canceled"); expect(storage.length).toBe(0);
});
it("refuses checkpoint changes or cancellation during restoration", async () => {
  const { source, e, storage, report } = await fixture(), key = await savePreparationCheckpoint(storage, report, e, () => [source]), raw = storage.getItem(key)!;
  const pending = restorePreparationCheckpoint(storage, report, key, () => [source]); storage.setItem(key, raw + " "); await expect(pending).rejects.toThrow("changed during restoration");
  const controller = new AbortController(), canceled = restorePreparationCheckpoint(storage, report, key, () => [source], controller.signal); controller.abort(); await expect(canceled).rejects.toThrow("canceled"); expect(storage.getItem(key)).toBe(raw + " ");
});
it.each(["unknown", "cursor", "sparse", "oversized"])("keeps and withholds malformed %s records", async mode => {
  const { source, e, storage, report } = await fixture(), key = await savePreparationCheckpoint(storage, report, e, () => [source]); const c = JSON.parse(storage.getItem(key)!);
  if (mode === "unknown") c.editor.extra = true; else if (mode === "cursor") c.editor.cursor = 31; else if (mode === "sparse") c.editor.history = [null]; else c.editor.to = "x".repeat(70000);
  const raw = JSON.stringify(c); storage.setItem(key, raw); expect(listPreparationCheckpoints(storage, report).items).toEqual([]); expect(listPreparationCheckpoints(storage, report).issue).toContain("unreadable"); await expect(restorePreparationCheckpoint(storage, report, key, () => [source])).rejects.toThrow(); expect(storage.getItem(key)).toBe(raw);
});
it("appends independent copies, refuses collisions and the ninth copy without evicting any record", async () => {
  const { source, e, storage, report } = await fixture(), first = await savePreparationCheckpoint(storage, report, e, () => [source]), raw = storage.getItem(first); const id = first.slice(-36);
  vi.spyOn(crypto, "randomUUID").mockReturnValueOnce(id as `${string}-${string}-${string}-${string}-${string}`); await expect(savePreparationCheckpoint(storage, report, e, () => [source])).rejects.toThrow("already exists");
  for (let i = 1; i < 8; i++) await savePreparationCheckpoint(storage, report, { ...e, to: `Revision ${i}` }, () => [source]);
  await expect(savePreparationCheckpoint(storage, report, e, () => [source])).rejects.toThrow("eight recovery checkpoints"); expect(storage.length).toBe(8); expect(storage.getItem(first)).toBe(raw);
});
it("preserves previous storage on quota failure and does not claim acknowledgement after an uncertain read", async () => {
  const { source, e, storage, report } = await fixture(), key = await savePreparationCheckpoint(storage, report, e, () => [source]), before = new Map(storage.values);
  vi.spyOn(storage, "setItem").mockImplementationOnce(() => { throw new DOMException("Synthetic quota failure", "QuotaExceededError"); }); await expect(savePreparationCheckpoint(storage, report, e, () => [source])).rejects.toThrow("quota"); expect(storage.values).toEqual(before);
  const original = storage.getItem.bind(storage); vi.spyOn(storage, "getItem").mockImplementation(k => { if (!before.has(k) && storage.values.has(k)) throw Error("Uncertain read acknowledgement"); return original(k); }); await expect(savePreparationCheckpoint(storage, report, e, () => [source])).rejects.toThrow("Uncertain"); expect(storage.length).toBe(2); expect(storage.values.get(key)).toBe(before.get(key));
});
it("bounds scan counts and keeps unavailable storage intact", async () => {
  const { storage, report } = await fixture(); Object.defineProperty(storage, "length", { get: () => 20001 }); expect(listPreparationCheckpoints(storage, report).issue).toContain("too many"); expect(storage.values.size).toBe(0);
});
it("refuses oversized but otherwise valid recipes before writing, without truncation", async () => {
  const { source, e, storage, report } = await fixture(); e.history = Array.from({ length: 30 }, (_, i) => ({ id: `large-${i}`, fieldId: source.fields[0].id, sourceColumn: "Region", kind: "recode" as const, from: Array.from({ length: 100 }, (_, j) => `${j}-${"x".repeat(100)}`), to: "Combined" })); e.cursor = 30;
  await expect(savePreparationCheckpoint(storage, report, e, () => [source])).rejects.toThrow("65,536-character"); expect(storage.length).toBe(0); expect(e.history).toHaveLength(30);
});
it("accepts identical source metadata with reordered object keys on reopen", async () => {
  const { source, e, storage, report } = await fixture(), key = await savePreparationCheckpoint(storage, report, e, () => [source]); const reordered = Object.fromEntries(Object.entries(source).reverse()) as typeof source; reordered.rows = source.rows.map(row => Object.fromEntries(Object.entries(row).reverse()));
  expect(await restorePreparationCheckpoint(storage, report, key, () => [reordered])).toEqual(e);
});
