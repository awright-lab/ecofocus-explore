import { expect, it } from "vitest";
import { importDatasetBuffer } from "../../data/datasetImportModel";
import { initialDashboard } from "../../document/documentSeeds";
import { combinedMultiResponse, resolveMultiResponseContext, summarizeMultiResponsePatterns, type MultiResponseContext } from "../multiResponseModel";
import { runMultiResponseJob } from "../multiResponseJob";

async function fixture(values: string[][], optionCount = 2): Promise<MultiResponseContext> {
  const headers = ["ID", ...Array.from({ length: optionCount }, (_, i) => `Answer_${i + 1}`), "Group"];
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const csv = [headers, ...values.map((row, index) => [String(index + 1), ...row, index % 2 ? "Y" : "X"])].map(row => row.map(quote).join(",")).join("\n");
  const { dataset } = await importDatasetBuffer(new TextEncoder().encode(csv).buffer, "synthetic_multiple_responses.csv");
  if (!dataset) throw Error("Synthetic import failed");
  const draft = structuredClone(initialDashboard); draft.importedDatasets = [dataset]; draft.savedAudiences = [];
  return { draft, studies: [dataset], plan: { reportId: draft.id, datasetId: dataset.id, importedAt: dataset.importedAt, idFieldId: dataset.fields[0].id, audienceId: "", options: dataset.fields.slice(1, optionCount + 1).map(field => ({ fieldId: field.id, selected: "1", notSelected: "0" })) } };
}
function run(context: MultiResponseContext) { return runMultiResponseJob(context, { signal: new AbortController().signal }); }

it("counts people once in unions and overlaps while excluding incomplete responses from the common base", async () => {
  const input = await fixture([["1", "1"], ["1", "1"], ["1", "0"], ["0", "1"], ["0", "0"], ["", "1"], ["other", "0"]]), before = structuredClone(input);
  const result = await run(input);
  expect(result.result.base).toBe(5); expect(result.result.optionCounts).toEqual([3, 3]);
  expect(result.result.overlapCounts).toEqual([[3, 2], [2, 3]]);
  expect(result.result.selectedCountDistribution).toEqual([1, 2, 2]);
  expect(combinedMultiResponse(result.result, [0, 1])).toEqual({ any: 4, all: 2, none: 1, base: 5 });
  expect(combinedMultiResponse(result.result, [0])).toEqual({ any: 3, all: 3, none: 2, base: 5 });
  expect(result.coverage).toEqual({ total: 7, audienceIncluded: 7, audienceExcluded: 0, audienceUnknown: 0, complete: 5, incomplete: 2, fields: [{ id: input.plan.options[0].fieldId, blank: 1, unmapped: 1 }, { id: input.plan.options[1].fieldId, blank: 0, unmapped: 0 }] });
  expect(result.sourceStillCurrent()).toBe(true); expect(input).toEqual(before);
});

it("supports explicit text codes, preserves case and trims input whitespace without coercing numeric spellings", async () => {
  const input = await fixture([[" yes ", "yes"], ["no", "no"], ["YES", "no"], ["yes", "NO"]]);
  input.plan.options.forEach(option => { option.selected = "yes"; option.notSelected = "no"; });
  const result = await run(input); expect(result.result.base).toBe(2); expect(result.result.optionCounts).toEqual([1, 1]);
  expect(result.coverage.incomplete).toBe(2);
  const numeric = await fixture([["1.0", "1"], ["1", "0"]]);
  expect((await run(numeric)).result.base).toBe(1);
});

it("reports all-not-selected people without inventing a denominator for empty selections", async () => {
  const result = await run(await fixture([["0", "0"], ["0", "0"]]));
  expect(result.result.optionCounts).toEqual([0, 0]); expect(combinedMultiResponse(result.result, [0, 1])).toEqual({ any: 0, all: 0, none: 2, base: 2 });
  expect(() => combinedMultiResponse(result.result, [])).toThrow("Choose at least one");
  expect(() => combinedMultiResponse(result.result, [0, 0])).toThrow(); expect(() => combinedMultiResponse(result.result, [2])).toThrow();
});

it.each(["duplicate ID", "blank ID", "unsupported raw", "partial rows", "partial fields", "duplicate field", "duplicate column", "remote", "replaced import", "same codes", "blank code", "duplicate option", "ID as option", "missing field", "too many options", "wrong report"])("refuses %s without changing source data", async kind => {
  const input = await fixture([["1", "1"], ["0", "0"]]), dataset = input.studies[0], id = dataset.fields[0].sourceColumn;
  if (kind === "duplicate ID") dataset.rows[1][id] = " 1 ";
  if (kind === "blank ID") dataset.rows[1][id] = " ";
  if (kind === "unsupported raw") dataset.rows[0][dataset.fields[1].sourceColumn] = 1 as never;
  if (kind === "partial rows") dataset.rowCount++;
  if (kind === "partial fields") dataset.fieldCount++;
  if (kind === "duplicate field") dataset.fields[1].id = dataset.fields[0].id;
  if (kind === "duplicate column") dataset.fields[1].sourceColumn = id;
  if (kind === "remote") dataset.remote = { provider: "netlify" } as never;
  if (kind === "replaced import") dataset.importedAt = "2020-01-01T00:00:00Z";
  if (kind === "same codes") input.plan.options[0].selected = "0";
  if (kind === "blank code") input.plan.options[0].selected = " ";
  if (kind === "duplicate option") input.plan.options[1].fieldId = input.plan.options[0].fieldId;
  if (kind === "ID as option") input.plan.options[0].fieldId = input.plan.idFieldId;
  if (kind === "missing field") input.plan.options[0].fieldId = "missing";
  if (kind === "too many options") input.plan.options = Array.from({ length: 13 }, (_, i) => ({ fieldId: `unknown-${i}`, selected: "1", notSelected: "0" }));
  if (kind === "wrong report") input.plan.reportId = "other";
  const before = structuredClone(input); await expect(run(input)).rejects.toThrow(); expect(input).toEqual(before);
});

it("distinguishes audience exclusions and unknown membership from incomplete response cases", async () => {
  const input = await fixture([["1", "1"], ["1", "0"], ["", "1"], ["0", "0"]]), dataset = input.studies[0], group = dataset.fields.at(-1)!;
  dataset.rows[3][group.sourceColumn] = "";
  input.draft.savedAudiences = [{ version: 1, id: "audience", label: "X", datasetId: dataset.id, importedAt: dataset.importedAt, expression: { kind: "category", fieldId: group.id, sourceColumn: group.sourceColumn, values: ["X"], exclude: false } }];
  input.plan.audienceId = "audience";
  const result = await run(input);
  expect(result.coverage).toMatchObject({ audienceIncluded: 2, audienceExcluded: 1, audienceUnknown: 1, complete: 1, incomplete: 1 });
  expect(result.result.optionCounts).toEqual([1, 1]);
  dataset.rows[1][dataset.fields[0].sourceColumn] = "1";
  await expect(run(input)).rejects.toThrow("unique across the complete import");
});

it.each(["raw response", "ID", "raw mapping", "audience", "import", "plan"])("invalidates completed results after changed %s", async kind => {
  const input = await fixture([["1", "1"], ["0", "0"]]), dataset = input.studies[0], result = await run(input);
  if (kind === "raw response") dataset.rows[0][dataset.fields[1].sourceColumn] = "0";
  if (kind === "ID") dataset.rows[0][dataset.fields[0].sourceColumn] = "changed";
  if (kind === "raw mapping") dataset.fields[1].sourceColumn = "different";
  if (kind === "audience") input.plan.audienceId = "missing";
  if (kind === "import") dataset.importedAt = "2020-01-01T00:00:00Z";
  if (kind === "plan") input.plan.options[0].selected = "yes";
  expect(result.sourceStillCurrent()).toBe(false);
});

it("rejects source drift during cancellable preparation", async () => {
  const input = await fixture(Array.from({ length: 1001 }, () => ["1", "0"]));
  await expect(runMultiResponseJob(input, { signal: new AbortController().signal, onProgress: done => { if (done === 500) input.studies[0].rows[0][input.studies[0].fields[1].sourceColumn] = "0"; } })).rejects.toThrow("changed during analysis");
});

it("cancels between row batches without changing studies or reports", async () => {
  const input = await fixture(Array.from({ length: 1001 }, () => ["1", "0"])), before = structuredClone(input), controller = new AbortController(), progress: number[] = [];
  await expect(runMultiResponseJob(input, { signal: controller.signal, onProgress: done => { progress.push(done); controller.abort(); } })).rejects.toMatchObject({ name: "AbortError" });
  expect(progress).toEqual([500]); expect(input).toEqual(before);
  await expect(runMultiResponseJob(input, { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
});

it("matches independently constructed respondent sets for every subset of three responses", async () => {
  const values = Array.from({ length: 1000 }, (_, i) => [i % 3 ? "1" : "0", i % 5 ? "0" : "1", i % 7 ? "1" : "0"]);
  const input = await fixture(values, 3), result = await run(input);
  const sets = [0, 1, 2].map(column => new Set(values.flatMap((row, index) => row[column] === "1" ? [index] : [])));
  expect(result.result.optionCounts).toEqual(sets.map(set => set.size));
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) expect(result.result.overlapCounts[a][b]).toBe([...sets[a]].filter(id => sets[b].has(id)).length);
  for (let selection = 1; selection < 8; selection++) {
    const columns = [0, 1, 2].filter(index => selection & 1 << index), any = new Set(columns.flatMap(index => [...sets[index]]));
    const all = [...sets[columns[0]]].filter(id => columns.every(index => sets[index].has(id)));
    expect(combinedMultiResponse(result.result, columns)).toMatchObject({ any: any.size, all: all.length, none: 1000 - any.size });
  }
});

it("handles the 50,000-row and twelve-response boundary with exact totals", async () => {
  const input = await fixture([Array(12).fill("0")], 12), dataset = input.studies[0];
  dataset.rows = Array.from({ length: 50000 }, (_, i) => Object.fromEntries(dataset.fields.map((field, j) => [field.sourceColumn, j === 0 ? String(i + 1) : j <= 12 ? String(i >> (j - 1) & 1) : "X"])));
  dataset.rowCount = dataset.rows.length;
  const result = await run(input);
  expect(result.result.base).toBe(50000); expect(result.result.optionCounts[0]).toBe(25000); expect(result.result.overlapCounts[0][1]).toBe(12500);
  expect(result.result.selectedCountDistribution.reduce((sum, n) => sum + n, 0)).toBe(50000);
  dataset.rowCount++; await expect(run(input)).rejects.toThrow();
});

it("refuses empty complete-case populations and malformed pattern structures", async () => {
  await expect(run(await fixture([["", "1"], ["1", "unknown"]]))).rejects.toThrow("No complete audience respondents");
  expect(() => summarizeMultiResponsePatterns(new Uint32Array(4), 1)).toThrow();
  expect(() => summarizeMultiResponsePatterns(new Uint32Array(3), 2)).toThrow();
  const input = await fixture([["1", "0"]]); input.plan.options[0].selected = "x".repeat(129); expect(() => resolveMultiResponseContext(input)).toThrow();
});
