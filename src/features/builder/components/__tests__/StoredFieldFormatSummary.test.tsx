// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { StoredFieldFormatSummary } from "../StoredFieldFormatSummary";
import * as model from "../../../data/localRowsInspection";
import { importDatasetBuffer } from "../../../data/datasetImportModel";
let root: Root, host: HTMLDivElement, outside: HTMLButtonElement;
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); host = document.createElement("div"); outside = document.createElement("button"); outside.textContent = "Outside"; document.body.append(host, outside); root = createRoot(host); });
afterEach(async () => { vi.restoreAllMocks(); await act(async () => root.unmount()); host.remove(); outside.remove(); vi.unstubAllGlobals(); });
const button = (label: string) => Array.from(host.querySelectorAll("button")).find(b => b.textContent === label || b.getAttribute("aria-label") === label)!;
const immediate = () => Promise.resolve();
async function fixture() {
  const imported = await importDatasetBuffer(new TextEncoder().encode("A,B\n0,yes\n").buffer, "format-summary-synthetic.csv"), d = imported.dataset!;
  d.rows = [{ A: "0" }, { A: "$12.50" }, { A: "5%" }, { A: "bad" }, { A: "1e-9999" }, { A: "" }, { A: " \r\n" }, {}]; d.rowCount = d.rows.length;
  const before = JSON.stringify(d), snapshot = await model.captureLocalRows(d.id, () => d, { yieldControl: immediate });
  return { d, before, props: { snapshot, field: "A", unavailable: false, onInspect: vi.fn() } };
}
async function click(label: string) { await act(async () => { const b = button(label); b.focus(); b.click(); }); }
async function until(check: () => boolean) { for (let i = 0; i < 300 && !check(); i++) await act(async () => new Promise(r => setTimeout(r, 5))); expect(check(), host.textContent ?? "").toBe(true); }
it("reviews all snapshot rows, reconciles four groups, and routes explicit modes without editing source", async () => {
  const f = await fixture(); await act(async () => root.render(<StoredFieldFormatSummary {...f.props}/>));
  expect(button("Inspect parsed finite numbers").getAttribute("aria-disabled")).toBe("true"); await click("Inspect parsed finite numbers"); expect(f.props.onInspect).not.toHaveBeenCalled();
  await click("Review field value formats"); await until(() => host.textContent?.includes("Format review complete") ?? false);
  expect(Array.from(host.querySelectorAll("dd span")).map(n => n.textContent)).toEqual(["3", "2", "2", "1"]); expect(host.textContent).toContain("Total snapshot rows: 8. Empty strings within the blank group: 1.");
  for (const [label, mode] of [["parsed finite numbers", "number"], ["nonblank rejected values", "not-number"], ["blank or whitespace strings", "blank"], ["missing properties", "missing"]]) { await click(`Inspect ${label}`); expect(f.props.onInspect).toHaveBeenLastCalledWith(mode); }
  expect(JSON.stringify(f.d)).toBe(f.before); f.d.rows[0].A = "Later"; await click("Review field value formats"); await until(() => host.textContent?.includes("Format review complete") ?? false); expect(host.querySelector("dd span")!.textContent).toBe("3");
});
it("invalidates prior totals on changed field, refreshed snapshot and unavailable context", async () => {
  const f = await fixture(); await act(async () => root.render(<StoredFieldFormatSummary {...f.props}/>)); await click("Review field value formats"); await until(() => host.textContent?.includes("Format review complete") ?? false);
  for (const props of [{ ...f.props, field: "B" }, { ...f.props, unavailable: true }, { ...f.props, snapshot: { ...f.props.snapshot } }]) { await act(async () => root.render(<StoredFieldFormatSummary {...props}/>)); expect(host.querySelector("dd span")!.textContent).toBe("Not reviewed"); await click("Inspect parsed finite numbers"); expect(f.props.onInspect).not.toHaveBeenCalled(); }
  await act(async () => root.render(<StoredFieldFormatSummary {...f.props}/>)); expect(host.querySelector("dd span")!.textContent).toBe("Not reviewed");
});
it.each(["cancel", "field", "snapshot", "unavailable", "unmount"] as const)("withholds late totals after %s and preserves source", async kind => {
  const f = await fixture(); let resolve: ((v: model.StoredFieldFormatCounts) => void) | undefined, signal: AbortSignal | undefined;
  vi.spyOn(model, "summarizeStoredFieldFormats").mockImplementation((_s, _f, options) => { signal = options?.signal; return new Promise(r => { resolve = r; }); });
  await act(async () => root.render(<StoredFieldFormatSummary {...f.props}/>)); await click("Review field value formats"); expect(resolve).toBeDefined();
  if (kind === "cancel") await click("Cancel field format review"); else await act(async () => root.render(kind === "unmount" ? null : <StoredFieldFormatSummary {...f.props} {...(kind === "field" ? { field: "B" } : kind === "snapshot" ? { snapshot: { ...f.props.snapshot } } : { unavailable: true })}/>));
  expect(signal?.aborted).toBe(true); await act(async () => resolve!({ number: 8, "not-number": 0, blank: 0, missing: 0, empty: 0, total: 8 })); expect(host.textContent).not.toContain("Format review complete"); expect(JSON.stringify(f.d)).toBe(f.before);
});
it.each(["inside", "outside", "blur"] as const)("keeps persistent Cancel focus ownership after natural completion for %s", async owner => {
  const f = await fixture(); let resolve: ((v: model.StoredFieldFormatCounts) => void) | undefined;
  vi.spyOn(model, "summarizeStoredFieldFormats").mockImplementation(() => new Promise(r => { resolve = r; })); await act(async () => root.render(<StoredFieldFormatSummary {...f.props}/>)); await click("Review field value formats"); const cancel = button("Cancel field format review"); cancel.focus(); if (owner === "outside") outside.focus(); if (owner === "blur") cancel.blur(); const active = document.activeElement;
  await act(async () => resolve!({ number: 3, "not-number": 2, blank: 2, missing: 1, empty: 1, total: 8 })); expect(document.activeElement).toBe(active); expect(cancel.isConnected).toBe(true); expect(cancel.getAttribute("aria-disabled")).toBe("true");
});
it("refuses duplicate starts before rerender and offers retry after failure", async () => {
  const f = await fixture(); let reject: ((e: Error) => void) | undefined; const spy = vi.spyOn(model, "summarizeStoredFieldFormats").mockImplementationOnce(() => new Promise((_r, fail) => { reject = fail; }));
  await act(async () => root.render(<StoredFieldFormatSummary {...f.props}/>)); await act(async () => { button("Review field value formats").click(); button("Review field value formats").click(); }); expect(spy).toHaveBeenCalledTimes(1); await act(async () => reject!(Error("synthetic read refusal"))); expect(host.textContent).toContain("synthetic read refusal"); expect(host.querySelector("dd span")!.textContent).toBe("Not reviewed");
  await click("Review field value formats"); await until(() => host.textContent?.includes("Format review complete") ?? false); expect(spy).toHaveBeenCalledTimes(2); expect(JSON.stringify(f.d)).toBe(f.before);
});
