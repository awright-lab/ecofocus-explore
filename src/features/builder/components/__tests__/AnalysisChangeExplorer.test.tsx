// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeAll, beforeEach, afterEach, expect, it, vi } from "vitest";
import { importDatasetBuffer } from "../../../data/datasetImportModel";
import { runImportedDatasetQuery } from "../../../data/importedDatasetAnalytics";
import { analysisChangeReview, changeReviewCell } from "../../../analytics/analysisChangeReview";
import { AnalysisChangeExplorer } from "../AnalysisChangeExplorer";
import { AnalysisEditPreview } from "../AnalysisEditPreview";
import type { AnalyticsQueryResponse } from "../../../../../shared/types/analytics";

let before: AnalyticsQueryResponse, after: AnalyticsQueryResponse, host: HTMLDivElement, root: Root;
beforeAll(async () => {
  const lines = ["Answer,Breakout,Keep,Spend"];
  for (let row = 0; row < 80; row++) for (let column = 0; column < 10; column++) for (let repeat = 0; repeat < 2; repeat++) lines.push(`Answer ${String(row).padStart(3, "0")},Group ${column},${repeat === 0 && row !== 79 ? "Yes" : "No"},${row + column}`);
  const imported = await importDatasetBuffer(new TextEncoder().encode(lines.join("\n")).buffer, "synthetic-change-review.csv");
  const dataset = imported.dataset!;
  const config = { dataset, field: dataset.fields[0], bannerField: dataset.fields[1], metric: "count" as const, chartType: "table" as const };
  before = runImportedDatasetQuery(config);
  after = runImportedDatasetQuery({ ...config, filter: { field: dataset.fields[2], value: "Yes" } });
});
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.stubGlobal("fetch", vi.fn().mockRejectedValue(Error("No service in this synthetic test"))); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
const button = (label: string) => Array.from(host.querySelectorAll("button")).find(item => item.textContent === label)!;
async function click(label: string) { await act(async () => button(label).click()); }
async function input(value: string) { const node = host.querySelector('input[type="search"]')!; await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(node, value); node.dispatchEvent(new Event("input", { bubbles: true })); }); }

it("reviews every real result row and column without mutating either source", () => {
  const original = structuredClone({ before, after }), model = analysisChangeReview(before, after);
  expect(model.issue).toBeNull(); expect(model.deltaUnavailable).toBeNull(); expect(model.rows).toHaveLength(80); expect(model.columns).toHaveLength(10);
  const row = model.rows.find(item => item.label === "Answer 060")!, column = model.columns[9];
  expect(changeReviewCell(before, row.beforeId, column.beforeId)).toMatchObject({ value: 2, base: 160 });
  expect(changeReviewCell(after, row.afterId, column.afterId)).toMatchObject({ value: 1, base: 79 });
  expect({ before, after }).toEqual(original); expect(fetch).not.toHaveBeenCalled();
});
it("preserves absent categories instead of treating them as zero", () => {
  const model = analysisChangeReview(before, after), row = model.rows.find(item => item.label === "Answer 079")!;
  expect(row.beforeId).toBeTruthy(); expect(row.afterId).toBeUndefined();
  expect(changeReviewCell(after, row.afterId, model.columns[0].afterId)).toEqual({ value: null, base: null, status: "Not present in this result" });
});
it("matches raw identities after generated IDs change and keeps duplicate display labels distinct", () => {
  const changed = structuredClone(after); changed.table.forEach((row, i) => { row.optionId = `different-${i}`; row.label = "Same display label"; });
  const model = analysisChangeReview(before, changed);
  expect(model.rows).toHaveLength(80); expect(new Set(model.rows.map(row => row.key)).size).toBe(80); expect(model.rows[0].afterId).toBe("different-0");
});
it.each(["study", "version", "grouping", "breakout", "metric", "measure", "weight", "missing import", "metadata"])("does not calculate misleading differences after %s changes", kind => {
  const changed = structuredClone(after), source = changed.query.sourceIdentity;
  if (source?.kind !== "imported") throw Error("Fixture context missing");
  if (kind === "study") source.datasetId += "-replacement";
  if (kind === "version") source.datasetImportedAt = "2020-01-01T00:00:00.000Z";
  if (kind === "grouping") source.primaryFieldId += "-other";
  if (kind === "breakout") source.bannerFieldId += "-other";
  if (kind === "measure") source.measureFieldId = "different-number";
  if (kind === "metric") changed.metric.id = "percent_selected";
  if (kind === "weight") changed.query.weight = "weightvar";
  if (kind === "missing import") delete source.datasetImportedAt;
  if (kind === "metadata" && changed.metadataRefs.source?.kind === "imported") changed.metadataRefs.source.primaryFieldId += "-conflicting";
  expect(analysisChangeReview(before, changed).deltaUnavailable).not.toBeNull();
});
it("keeps different grouping meanings separate even when labels and generated IDs coincide", () => {
  const changed = structuredClone(after); if (changed.query.sourceIdentity?.kind === "imported") changed.query.sourceIdentity.primaryFieldId = "unrelated";
  const model = analysisChangeReview(before, changed);
  expect(model.rows).toHaveLength(159); expect(model.rows.every(row => !(row.beforeId && row.afterId))).toBe(true);
});
it("does not match generated IDs when raw category keys are missing", () => {
  const changed = structuredClone(after); delete changed.table[0].sourceCategoryKey;
  const model = analysisChangeReview(before, changed);
  expect(model.deltaUnavailable).not.toBeNull(); expect(model.rows.every(row => !(row.beforeId && row.afterId))).toBe(true);
});
it("supports exact percentage-point comparisons while withholding missing recorded inputs", async () => {
  const imported = await importDatasetBuffer(new TextEncoder().encode("Answer,Keep\nYes,Y\nYes,N\nNo,N\nNo,N\n").buffer, "synthetic-percent.csv"), dataset = imported.dataset!;
  const current = runImportedDatasetQuery({ dataset, field: dataset.fields[0], metric: "percent_selected", chartType: "table" });
  const proposed = runImportedDatasetQuery({ dataset, field: dataset.fields[0], metric: "percent_selected", chartType: "table", filter: { field: dataset.fields[1], value: "Y" } });
  expect(analysisChangeReview(current, proposed).deltaUnavailable).toBeNull();
  await act(async () => root.render(<AnalysisChangeExplorer before={current} after={proposed} />));
  expect(host.textContent).toContain("+50 percentage points");
  delete proposed.calculationInputs; expect(analysisChangeReview(current, proposed).deltaUnavailable).not.toBeNull();
});
it.each(["generated", "raw"])("rejects ambiguous %s identities", kind => {
  const changed = structuredClone(after); if (kind === "generated") changed.table[1].optionId = changed.table[0].optionId; else changed.table[1].sourceCategoryKey = changed.table[0].sourceCategoryKey;
  expect(analysisChangeReview(before, changed).issue).toBeTruthy();
});
it("withholds unavailable cells and invalid bases without converting them to observations", () => {
  const changed = structuredClone(after); changed.metric.id = "percent_selected"; const row = changed.table[0], column = changed.columns[0]; row.bases[column.id] = 0; row.values[column.id] = 0;
  expect(changeReviewCell(changed, row.optionId, column.id).value).toBeNull(); row.bases[column.id] = 0.5;
  expect(changeReviewCell(changed, row.optionId, column.id).base).toBeNull();
});
it("searches beyond the old sample and pages every answer, with access to the tenth column", async () => {
  await act(async () => root.render(<AnalysisChangeExplorer before={before} after={after} />));
  expect(host.textContent).toContain("1–25 of 80"); await click("Next answers"); expect(host.textContent).toContain("26–50 of 80");
  await input("Answer 060"); expect(host.textContent).toContain("1–1 of 1");
  const select = host.querySelector("select")!; expect(select.options).toHaveLength(10);
  await act(async () => { select.value = select.options[9].value; select.dispatchEvent(new Event("change", { bubbles: true })); });
  const comparison = host.querySelectorAll("table")[1]; expect(comparison.textContent).toContain("Answer 060"); expect(comparison.textContent).toContain("n=160"); expect(comparison.textContent).toContain("n=79"); expect(comparison.textContent).toContain("-1");
  await input("no such answer"); expect(host.textContent).toContain("0–0 of 0");
});
it("shows changed filter settings and descriptive limitations, not a significance claim", async () => {
  await act(async () => root.render(<AnalysisChangeExplorer before={before} after={after} />));
  expect(host.textContent).toContain("Filter (changed)"); expect(host.textContent).toContain("Keep is Yes"); expect(host.textContent).toContain("not statistical significance"); expect(host.textContent).toContain("changing an audience changes the population");
});
it("opens complete review on demand and keeps dismissal and keyboard scope", async () => {
  const dismiss = vi.fn(); await act(async () => root.render(<AnalysisEditPreview before={before} after={after} onDismiss={dismiss} />));
  expect(host.querySelectorAll("table")).toHaveLength(2); await click("Review settings and all results"); expect(document.querySelector('[aria-label="Complete analysis change review"]')).not.toBeNull();
  await act(async () => document.querySelector('[role="dialog"] input')!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
  expect(dismiss).not.toHaveBeenCalled(); expect(document.querySelector('[role="dialog"]')).toBeNull(); expect(document.activeElement).toBe(button("Review settings and all results")); expect(host.querySelector('[data-canvas-keyboard-scope="controls"]')).not.toBeNull();
});
