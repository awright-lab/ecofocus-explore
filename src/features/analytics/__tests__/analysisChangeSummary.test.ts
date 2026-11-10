import { expect, it } from "vitest";
import { analysisChangeSummary, orderChangeEntries } from "../analysisChangeSummary";
import { changeReviewCell, changeReviewColumn } from "../analysisChangeReview";
import { changeSummaryFixture, zeroBaseChangeFixture } from "./changeSummaryFixture";
import { importDatasetBuffer } from "../../data/datasetImportModel";
import { runImportedDatasetQuery } from "../../data/importedDatasetAnalytics";
it("counts real engine changes, keeps an identical entry and ranks unrounded differences without source writes", async () => {
 const { before, after, dataset } = await changeSummaryFixture(), original = structuredClone({ before, after, dataset }), view = analysisChangeSummary(before, after);
 expect(view.review.deltaUnavailable).toBeNull(); expect(view.counts).toEqual({ valueChanges: 3, baseChanges: 0, proposedOnly: 0, currentOnly: 0, unavailable: 0, identical: 1 });
 expect(Object.fromEntries(view.entries.map(e => [e.row.label, e.difference]))).toEqual({ A: -4, B: 2, C: 0, D: 2 });
 const ranked = orderChangeEntries(view.entries, true); expect(ranked.map(e => e.row.label)).toEqual(["A", "B", "D", "C"]); expect(view.entries.map(e => e.row.label)).toEqual(before.table.map(r => r.label));
 expect(view.entries.filter(e => e.identical).map(e => e.row.label)).toEqual(["C"]); expect({ before, after, dataset }).toEqual(original);
 for (const entry of view.entries) { expect(entry.before).toEqual(changeReviewCell(before, entry.row.beforeId, view.column?.beforeId)); expect(entry.after).toEqual(changeReviewCell(after, entry.row.afterId, view.column?.afterId)); }
 expect([...changeReviewColumn(before, view.column?.beforeId).values()]).toHaveLength(4);
});
it("does not hide a base-only change or turn an absent category into zero", async () => {
 const { before, after } = await changeSummaryFixture(), column = after.columns[0].id;
 const c = after.table.find(r => r.label === "C")!; c.bases[column] += 1; after.table = after.table.filter(r => r.label !== "D");
 const view = analysisChangeSummary(before, after); expect(view.counts.baseChanges).toBe(1); expect(view.counts.currentOnly).toBe(1); expect(view.entries.find(e => e.row.label === "C")).toMatchObject({ identical: false, difference: 0 });
 expect(view.entries.find(e => e.row.label === "D")).toMatchObject({ identical: false, difference: null, after: { value: null, base: null, status: "Not present in this result" } });
});
it.each(["missing base", "zero rate base", "incompatible metric", "weight", "source"])("retains unavailable or incomparable entries for %s", async kind => {
 const { before, after } = await changeSummaryFixture(), row = after.table[0], col = after.columns[0].id;
 if (kind === "missing base") delete row.bases[col];
 if (kind === "zero rate base") { after.metric.id = "percent_selected"; after.metric.valueFormat = "percent"; after.query.metric = "percent_selected"; row.bases[col] = 0; }
 if (kind === "incompatible metric") after.metric.valueFormat = "percent";
 if (kind === "weight") after.query.weight = "weightvar";
 if (kind === "source" && after.query.sourceIdentity?.kind === "imported") after.query.sourceIdentity.datasetImportedAt += "-replacement";
 const view = analysisChangeSummary(before, after); if (kind === "missing base") expect(view.entries.find(e => e.row.afterId === row.optionId)?.identical).toBe(false); else expect(view.entries.every(e => !e.identical)).toBe(true); expect(view.entries.some(e => e.difference === null)).toBe(true);
 if (kind === "missing base") expect(view.counts.unavailable).toBe(1); else expect(view.review.deltaUnavailable).not.toBeNull();
});
it("retains same-label raw categories and changed generated IDs as separate aligned entries", async () => {
 const { before, after } = await changeSummaryFixture(); after.table.forEach((r, i) => { r.optionId = "changed-" + i; r.label = "Same label"; }); const view = analysisChangeSummary(before, after);
 expect(view.entries).toHaveLength(4); expect(new Set(view.entries.map(e => e.row.key)).size).toBe(4); expect(view.counts.valueChanges).toBe(3); expect(orderChangeEntries(view.entries, true)[0].difference).toBe(-4);
});
it("withholds all summary entries for ambiguous raw identities", async () => {
 const { before, after } = await changeSummaryFixture(); after.table[1].sourceCategoryKey = after.table[0].sourceCategoryKey; const view = analysisChangeSummary(before, after);
 expect(view.review.issue).not.toBeNull(); expect(view.entries).toEqual([]);
});
it("ranks finite scientific-scale differences without using rounded display text", async () => {
 const { dataset } = await changeSummaryFixture(); dataset.rows = [{ Answer: "A", Keep: "Y", Amount: "0.000001" }, { Answer: "A", Keep: "N", Amount: "0.000003" }, { Answer: "B", Keep: "Y", Amount: "0.000001" }, { Answer: "B", Keep: "N", Amount: "0.000004" }]; dataset.rowCount = 4;
 const config = { dataset, field: dataset.fields[0], measureField: dataset.fields[2], metric: "average" as const, chartType: "table" as const };
 const before = runImportedDatasetQuery({ ...config, filter: { field: dataset.fields[1], value: "Y" } }), after = runImportedDatasetQuery({ ...config, filter: { field: dataset.fields[1], value: "N" } }); const view = analysisChangeSummary(before, after);
 expect(view.review.deltaUnavailable).toBeNull(); expect(orderChangeEntries(view.entries, true)[0].row.label).toBe("B"); expect(view.counts.identical).toBe(0);
});
it("keeps overflowing arithmetic unranked even when the separate numeric values are finite", async () => {
 const { dataset } = await changeSummaryFixture(); dataset.rows = [{ Answer: "A", Keep: "Y", Amount: "-1e308" }, { Answer: "A", Keep: "N", Amount: "1e308" }]; dataset.rowCount = 2;
 const config = { dataset, field: dataset.fields[0], measureField: dataset.fields[2], metric: "average" as const, chartType: "table" as const };
 const before = runImportedDatasetQuery({ ...config, filter: { field: dataset.fields[1], value: "Y" } }), after = runImportedDatasetQuery({ ...config, filter: { field: dataset.fields[1], value: "N" } }); const view = analysisChangeSummary(before, after);
 expect(view.review.deltaUnavailable).toBeNull(); expect(view.entries[0]).toMatchObject({ difference: null, identical: false }); expect(view.counts.valueChanges).toBe(1); expect(view.counts.unavailable).toBe(1);
});
it("rechecks same-reference values and metadata rather than keeping an earlier summary", async () => {
 const { before, after } = await changeSummaryFixture(); expect(analysisChangeSummary(before, after).counts.identical).toBe(1); after.table.find(r => r.label === "C")!.values[after.columns[0].id] += 1;
 expect(analysisChangeSummary(before, after).counts.identical).toBe(0); after.query.weight = "weightvar"; expect(analysisChangeSummary(before, after).review.deltaUnavailable).not.toBeNull();
});

it.each(["average", "percent_selected"] as const)("counts known %s bases changing from100 to zero despite unavailable numeric output", async metric => {
 const { before, after, dataset } = await zeroBaseChangeFixture(metric), original = structuredClone({ before, after, dataset }), view = analysisChangeSummary(before, after), entry = view.entries.find(e => e.row.label === "A")!;
 expect(view.review.deltaUnavailable).toBeNull(); expect(entry.before.base).toBe(100); expect(entry.after).toMatchObject({ base: 0, value: null, status: "Unavailable" }); expect(view.counts.baseChanges).toBe(1); expect(view.counts.valueChanges).toBe(0); expect(entry.identical).toBe(false); expect(entry.difference).toBeNull(); expect({ before, after, dataset }).toEqual(original);
});
it.each(["average", "percent_selected"] as const)("counts a known %s base change even if the cached numeric value is missing", async metric => {
 const { before, after } = await zeroBaseChangeFixture(metric), row = after.table.find(r => r.label === "A")!, col = after.columns[0].id; row.bases[col] = 50; delete row.values[col]; const original = structuredClone({ before, after }), view = analysisChangeSummary(before, after);
 expect(view.counts.baseChanges).toBe(1); expect(view.counts.unavailable).toBe(1); expect(view.counts.valueChanges).toBe(0); expect(view.entries.find(e => e.row.label === "A")?.identical).toBe(false); expect({ before, after }).toEqual(original);
});
it.each(["average", "percent_selected"] as const)("does not compare inherited or unknown %s bases", async metric => {
 const { before, after } = await zeroBaseChangeFixture(metric), row = after.table.find(r => r.label === "A")!, col = after.columns[0].id; row.bases = Object.create({ [col]: 50 }); delete row.values[col]; const view = analysisChangeSummary(before, after);
 expect(view.counts.baseChanges).toBe(0); expect(view.entries.find(e => e.row.label === "A")?.after.base).toBeNull(); expect(view.entries.find(e => e.row.label === "A")?.identical).toBe(false);
});
it.each(["average", "percent_selected"] as const)("still withholds %s base comparisons for incompatible weighting", async metric => {
 const { before, after } = await zeroBaseChangeFixture(metric); after.query.weight = "weightvar"; const view = analysisChangeSummary(before, after);
 expect(view.review.deltaUnavailable).not.toBeNull(); expect(view.counts.baseChanges).toBe(0); expect(view.entries.every(e => !e.identical)).toBe(true);
});
