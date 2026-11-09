// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import CheckpointFiles from "../CheckpointFiles";
import { importDatasetBuffer } from "../../data/datasetImportModel";
import { exportPreparationCheckpointFile, inspectPreparationCheckpointFile, savePreparationCheckpoint } from "../preparationCheckpoint";
let root: Root, host: HTMLDivElement, outside: HTMLButtonElement;
let creates: ReturnType<typeof vi.fn<(blob: Blob) => string>>, revoke: ReturnType<typeof vi.fn<(url: string) => void>>;
const urlDescriptors: { key: "createObjectURL" | "revokeObjectURL"; descriptor: PropertyDescriptor | undefined }[] = [];
beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); localStorage.clear(); host = document.createElement("div"); outside = document.createElement("button"); outside.textContent = "Outside"; document.body.append(host, outside); root = createRoot(host);
  creates = vi.fn<(blob: Blob) => string>().mockReturnValue("blob:synthetic-checkpoint"); revoke = vi.fn<(url: string) => void>();
  for (const key of ["createObjectURL", "revokeObjectURL"] as const) { urlDescriptors.push({ key, descriptor: Object.getOwnPropertyDescriptor(URL, key) }); Object.defineProperty(URL, key, { configurable: true, writable: true, value: key === "createObjectURL" ? creates : revoke }); }
});
afterEach(async () => { vi.restoreAllMocks(); await act(async () => root.unmount()); host.remove(); outside.remove(); localStorage.clear(); for (const { key, descriptor } of urlDescriptors.splice(0)) { if (descriptor) Object.defineProperty(URL, key, descriptor); else Reflect.deleteProperty(URL, key); } vi.unstubAllGlobals(); });
function input() { return document.querySelector<HTMLInputElement>('input[type="file"]')!; }
function button(label: string) { const b = Array.from(document.querySelectorAll("button")).find(n => n.textContent === label); if (!b) throw Error(label); return b; }
async function click(label: string) { await act(async () => { const b = button(label); b.focus(); b.click(); }); }
async function choose(file: File) { await act(async () => { Object.defineProperty(input(), "files", { configurable: true, value: [file] }); input().dispatchEvent(new Event("change", { bubbles: true })); }); }
async function until(check: () => boolean) { for (let i = 0; i < 400 && !check(); i++) await act(async () => new Promise(resolve => setTimeout(resolve, 5))); expect(check(), document.body.textContent).toBe(true); }
async function fixture() {
  const { dataset } = await importDatasetBuffer(new TextEncoder().encode("Region,Other\nNorth,kept\nSouth,kept\n").buffer, "file-controls.csv"); const source = dataset!, reportId = "file-controls-report", editor = { sourceId: source.id, title: "File checkpoint A", history: [], cursor: 0, fieldId: source.fields[0].id, kind: "recode" as const, from: ["North"], to: "Unencrypted synthetic target A" };
  const key = await savePreparationCheckpoint(localStorage, reportId, editor, () => [source]), text = exportPreparationCheckpointFile(localStorage, reportId, key), props = { reportId, selectedKey: key, busy: false, onImported: vi.fn<(key: string) => void>() };
  await act(async () => root.render(<CheckpointFiles {...props}/>)); return { source, editor, key, text, props };
}
it("requests an unencrypted exact backup download while preserving stored data and focus", async () => {
  const f = await fixture(), before = localStorage.getItem(f.key), requested: string[] = []; vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function(this: HTMLAnchorElement) { requested.push(this.download); });
  await click("Download selected checkpoint"); expect(creates).toHaveBeenCalledOnce(); const blob = creates.mock.calls[0][0]; const text = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsText(blob); });
  expect(text).toBe(f.text); expect(inspectPreparationCheckpointFile(text, f.props.reportId).editorText).toContain("Unencrypted synthetic target A"); expect(requested[0]).toMatch(/^ecofocus-preparation-checkpoint-.*\.json$/); expect(document.body.textContent).toContain("download requested"); expect(document.body.textContent).toContain("unencrypted"); expect(localStorage.getItem(f.key)).toBe(before); expect(f.props.onImported).not.toHaveBeenCalled(); expect(document.activeElement).toBe(button("Download selected checkpoint"));
});
it("inspects a real File without automatic import, then imports a separate copy only on explicit action", async () => {
  const f = await fixture(), raw = localStorage.getItem(f.key); localStorage.removeItem(f.key); localStorage.setItem("workspace", "original workspace bytes"); await choose(new File([f.text], "checkpoint.json", { type: "application/json" })); await until(() => !!document.querySelector('[aria-label="Checkpoint file inspection"]'));
  expect(localStorage.getItem(f.key)).toBeNull(); expect(f.props.onImported).not.toHaveBeenCalled(); expect(document.querySelector<HTMLTextAreaElement>("textarea")!.value).toContain("Unencrypted synthetic target A"); await click("Import inspected checkpoint"); const importedKey = f.props.onImported.mock.calls[0][0]; expect(importedKey).not.toBe(f.key); expect(JSON.parse(localStorage.getItem(importedKey)!)).toEqual({ ...JSON.parse(raw!), id: importedKey.slice(-36) }); expect(localStorage.getItem(f.key)).toBeNull(); expect(localStorage.getItem("workspace")).toBe("original workspace bytes"); expect(f.props.onImported).toHaveBeenCalledWith(importedKey); await click("Import inspected checkpoint"); expect(document.body.textContent).toContain("already in this browser"); expect(localStorage.length).toBe(2);
});
it("refuses conflicting content after inspection and keeps the existing checkpoint", async () => {
  const f = await fixture(), before = localStorage.getItem(f.key), wrapper = JSON.parse(f.text), c = JSON.parse(wrapper.raw); c.editor.to = "Conflicting file"; wrapper.raw = JSON.stringify(c); await choose(new File([JSON.stringify(wrapper)], "conflict.json")); await until(() => !!document.querySelector("textarea")); await click("Import inspected checkpoint"); expect(document.body.textContent).toContain("different contents"); expect(localStorage.getItem(f.key)).toBe(before); expect(f.props.onImported).not.toHaveBeenCalled();
});
it("refuses oversized files before reading or importing", async () => {
  const f = await fixture(), read = vi.spyOn(FileReader.prototype, "readAsArrayBuffer"), before = localStorage.getItem(f.key); await choose(new File([new Uint8Array(512 * 1024 + 1)], "too-large.json")); expect(read).not.toHaveBeenCalled(); expect(document.body.textContent).toContain("at most 512 KiB"); expect(document.querySelector("textarea")).toBeNull(); expect(localStorage.getItem(f.key)).toBe(before); expect(f.props.onImported).not.toHaveBeenCalled();
});
it.each(["malformed", "invalid-utf8"])("withholds %s without importing", async kind => {
  const f = await fixture(), before = localStorage.getItem(f.key); await choose(new File([kind === "malformed" ? "not JSON" : new Uint8Array([0xc3, 0x28])], "invalid.json")); await until(() => button("Cancel checkpoint file inspection").disabled); expect(document.querySelector("textarea")).toBeNull(); expect(f.props.onImported).not.toHaveBeenCalled(); expect(localStorage.getItem(f.key)).toBe(before);
});
function complete(reader: FileReader, text: string) { Object.defineProperty(reader, "result", { configurable: true, value: new TextEncoder().encode(text).buffer }); reader.onload?.call(reader, new ProgressEvent("load") as ProgressEvent<FileReader>); }
it.each(["owned", "outside", "blur"])("keeps %s focus ownership when file reading completes", async focus => {
  const f = await fixture(), pending: FileReader[] = []; vi.spyOn(FileReader.prototype, "readAsArrayBuffer").mockImplementation(function(this: FileReader) { pending.push(this); }); await choose(new File([f.text], "focus.json")); const cancel = button("Cancel checkpoint file inspection"); cancel.focus(); if (focus === "outside") outside.focus(); else if (focus === "blur") cancel.blur(); await act(async () => complete(pending[0], f.text)); expect(document.activeElement).toBe(focus === "owned" ? input() : focus === "outside" ? outside : document.body); expect(document.querySelector("textarea")).not.toBeNull();
});
it("cancels file A and ignores its late completion after file B is inspected", async () => {
  const f = await fixture(), pending: FileReader[] = []; vi.spyOn(FileReader.prototype, "readAsArrayBuffer").mockImplementation(function(this: FileReader) { pending.push(this); }); await choose(new File([f.text], "A.json")); await click("Cancel checkpoint file inspection"); expect(document.activeElement).toBe(input()); const b = JSON.parse(f.text), c = JSON.parse(b.raw); c.editor.title = "File checkpoint B"; b.raw = JSON.stringify(c); const textB = JSON.stringify(b);
  await choose(new File([textB], "B.json")); await act(async () => complete(pending[1], textB)); expect(document.querySelector("textarea")!.value).toContain("File checkpoint B"); await act(async () => complete(pending[0], f.text)); expect(document.querySelector("textarea")!.value).toContain("File checkpoint B"); expect(f.props.onImported).not.toHaveBeenCalled();
});
it("rejects late file results after the report changes or the component unmounts", async () => {
  const f = await fixture(), pending: FileReader[] = []; vi.spyOn(FileReader.prototype, "readAsArrayBuffer").mockImplementation(function(this: FileReader) { pending.push(this); }); await choose(new File([f.text], "old-report.json")); await act(async () => root.render(<CheckpointFiles {...f.props} reportId="other-report"/>)); await act(async () => complete(pending[0], f.text)); expect(document.querySelector("textarea")).toBeNull(); expect(f.props.onImported).not.toHaveBeenCalled(); await choose(new File([f.text], "unmount.json")); await act(async () => root.unmount()); root = createRoot(host); await act(async () => complete(pending[1], f.text)); expect(document.querySelector("textarea")).toBeNull(); expect(f.props.onImported).not.toHaveBeenCalled();
});
it("keeps the stored checkpoint when download creation is unavailable", async () => {
  const f = await fixture(), before = localStorage.getItem(f.key); creates.mockImplementationOnce(() => { throw Error("Synthetic download unavailable"); }); await click("Download selected checkpoint"); expect(document.body.textContent).toContain("Synthetic download unavailable"); expect(localStorage.getItem(f.key)).toBe(before); expect(f.props.onImported).not.toHaveBeenCalled();
});
it("handles unavailable file reading without importing or changing stored records", async () => {
  const f = await fixture(), before = localStorage.getItem(f.key); vi.stubGlobal("FileReader", class { constructor() { throw Error("Synthetic reader unavailable"); } }); await choose(new File([f.text], "unavailable.json")); expect(document.body.textContent).toContain("file reading is unavailable"); expect(document.querySelector("textarea")).toBeNull(); expect(localStorage.getItem(f.key)).toBe(before); expect(f.props.onImported).not.toHaveBeenCalled();
});
it.each(["cancel", "read-error"])("can choose the same unchanged file again after %s without importing automatically", async reason => {
  const f = await fixture(), before = localStorage.getItem(f.key), file = new File([f.text], "retry-same.json", { type: "application/json" }), node = input();
  // Model the native picker boundary: an unchanged nonempty filename does not emit change.
  // Clearing value also clears FileList, so the handler must capture File first.
  let path = "", files: File[] = [];
  Object.defineProperty(node, "value", { configurable: true, get: () => path, set: (value: string) => { if (value !== "") throw Error("Only clearing a file input is allowed"); path = ""; files = []; } });
  Object.defineProperty(node, "files", { configurable: true, get: () => files });
  const pending: FileReader[] = [], received: Blob[] = [];
  vi.spyOn(FileReader.prototype, "readAsArrayBuffer").mockImplementation(function(this: FileReader, blob: Blob) { pending.push(this); received.push(blob); });
  async function chooseSame() { let changed = false; await act(async () => { const selected = "C:\\fakepath\\retry-same.json"; if (path === selected) return; path = selected; files = [file]; changed = true; node.dispatchEvent(new Event("change", { bubbles: true })); }); return changed; }
  expect(await chooseSame()).toBe(true); expect(received[0]).toBe(file); expect(pending).toHaveLength(1);
  if (reason === "cancel") await click("Cancel checkpoint file inspection");
  else await act(async () => pending[0].onerror?.call(pending[0], new ProgressEvent("error") as ProgressEvent<FileReader>));
  expect(document.querySelector("textarea")).toBeNull(); expect(button("Cancel checkpoint file inspection").disabled).toBe(true);
  expect(await chooseSame()).toBe(true); expect(pending).toHaveLength(2); expect(received[1]).toBe(file); expect(node.value).toBe(""); expect(node.files).toHaveLength(0);
  await act(async () => complete(pending[1], f.text)); expect(document.querySelector<HTMLTextAreaElement>("textarea")!.value).toContain("Unencrypted synthetic target A"); expect(f.props.onImported).not.toHaveBeenCalled(); expect(localStorage.getItem(f.key)).toBe(before);
  await act(async () => complete(pending[0], f.text)); expect(document.querySelector<HTMLTextAreaElement>("textarea")!.value).toContain("Unencrypted synthetic target A"); expect(f.props.onImported).not.toHaveBeenCalled(); expect(localStorage.getItem(f.key)).toBe(before);
});
