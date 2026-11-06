import type { CellFormulaSpec, CellFormulaOperand } from "../../../shared/types/calculatedMetric";
import type { AnalyticsQueryResponse, AnalyticsTableRow } from "../../../shared/types/analytics";
import type { DashboardDraft, DashboardPage, DashboardTile, SavedDerivedDefinition } from "../../../shared/types/dashboard";
import { analysisSettingsMatch } from "../../../shared/analytics/queryFreshness";
import { resultIdentityIssue } from "../../../shared/analytics/resultIdentities";
import { analyticalCell } from "../../../shared/analytics/resultCells";
import { withSafeInference } from "../../../shared/analytics/inferenceSafety";
import { audienceDefinitionIssue } from "../audiences/audienceModel";
import { evaluateCellFormula, parseCellFormula } from "./formulaArithmetic";

export interface CellFormulaConfig { rowId?: string; comparedRowId?: string; columnId?: string; formula?: Pick<CellFormulaSpec, "expression" | "label"> & { binding?: string } }
export function canonicalFormulaValue(value: unknown): string {
  function sort(item: unknown): unknown { if (Array.isArray(item)) return item.map(sort); if (item && typeof item === "object") return Object.fromEntries(Object.entries(item).filter(([, entry]) => entry !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, sort(entry)])); return item; }
  return JSON.stringify(sort(value));
}
export function cellFormulaSourceToken(tile: DashboardTile): string { return canonicalFormulaValue({ id: tile.id, query: tile.query, result: tile.result, derived: tile.derivedOutput }); }
function descriptor(operand: CellFormulaOperand) { return { id: operand.id, label: operand.label, sourceCategoryKey: operand.sourceCategoryKey }; }
function binding(result: AnalyticsQueryResponse, input: CellFormulaSpec["input"]): string {
  const { chartType: _chart, ...query } = result.query;
  return canonicalFormulaValue({ query, source: result.metadataRefs.source, metric: input.metric, a: descriptor(input.a), b: descriptor(input.b), column: input.column });
}
function finiteInput(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 1e12; }
function validBase(base: unknown): base is number { return typeof base === "number" && Number.isSafeInteger(base) && base > 0 && base <= 1e12; }
export function assertFormulaSpec(value: CellFormulaSpec): void {
  if (!value || value.version !== 1 || typeof value.label !== "string" || !value.label.trim() || value.label.length > 80 || typeof value.binding !== "string" || !value.binding || value.binding.length > 131072) throw Error("The recorded calculated metric is incomplete or unsupported.");
  parseCellFormula(value.expression);
  const input = value.input;
  if (!input || !validBase(input.base) || !input.column || typeof input.column.id !== "string" || !input.column.id || typeof input.column.label !== "string" || input.column.sourceCategoryKey !== undefined && typeof input.column.sourceCategoryKey !== "string" || !input.metric || !["count", "percent_selected"].includes(input.metric.id) || typeof input.metric.label !== "string" || !["number", "percent"].includes(input.metric.valueFormat)) throw Error("The recorded formula input base or metric is invalid.");
  for (const item of [input.a, input.b]) {
    if (!item || typeof item.id !== "string" || !item.id || typeof item.label !== "string" || typeof item.sourceCategoryKey !== "string" || !finiteInput(item.value)) throw Error("The recorded formula operands are invalid.");
    try { const category = JSON.parse(item.sourceCategoryKey); if (category === null || typeof category === "object") throw Error(); } catch { throw Error("The recorded formula answer identity is invalid."); }
    if (item.value < 0 || input.metric.id === "count" && (!Number.isSafeInteger(item.value) || item.value > input.base) || input.metric.id === "percent_selected" && item.value > 100) throw Error("The recorded formula input does not match its response base.");
  }
  if (input.a.id === input.b.id || input.a.sourceCategoryKey === input.b.sourceCategoryKey) throw Error("Choose two different unambiguous answer cells.");
  if (input.a.value + input.b.value > (input.metric.id === "count" ? input.base : 100) + 1e-10) throw Error("The selected categories exceed their common response universe. Overlapping or incompatible response bases are unsupported.");
  evaluateCellFormula(value.expression, input.a.value, input.b.value);
}
export function makeCellFormulaSpec(tile: DashboardTile, config: CellFormulaConfig): CellFormulaSpec {
  const result = tile.result, source = result.query.sourceIdentity;
  if (result.table.length * result.columns.length > 5000) throw Error("Choose a source with at most 5,000 displayed cells for this bounded formula workflow.");
  if (tile.derivedOutput || source?.kind !== "imported" || source.queryKind !== "categorical" || source.sourceRef?.kind !== "imported_file" || source.sourceRef.provider !== "local_file" || !source.datasetImportedAt || !Number.isFinite(Date.parse(source.datasetImportedAt))) throw Error("Choose an original categorical result from a complete local-file study with recorded import context.");
  if (!analysisSettingsMatch(tile.query, result.query)) throw Error("Refresh the source first: edited analysis settings do not match its displayed result.");
  if (result.weighting.applied || result.weighting.id !== null || result.query.weight !== null || result.query.authoredVariableSet || result.query.comparisonMode === "wave" || source.intersectionAudience !== undefined || source.measureFieldId) throw Error("Formula cells must share one unweighted categorical response universe. Weighted, authored, numeric-measure, wave and temporary linked results are unsupported.");
  if (source.audience !== undefined && audienceDefinitionIssue(source.audience)) throw Error("The recorded source audience is invalid. Review and rerun the original analysis before calculating.");
  if ([result.query.sourceRef, source.sourceRef].some(ref => !ref || ref.kind !== "imported_file" || ref.provider !== "local_file" || ref.datasetId !== source.datasetId)) throw Error("The recorded study references disagree. Refresh the original source first.");
  if (!["count", "percent_selected"].includes(result.metric.id) || result.metric.id !== result.query.metric || canonicalFormulaValue(source) !== canonicalFormulaValue(result.metadataRefs.source)) throw Error("Use recorded response counts or full-precision response percentages with consistent source context.");
  const identityIssue = resultIdentityIssue(result); if (identityIssue) throw Error(identityIssue);
  const column = result.columns.find(item => item.id === config.columnId);
  if (!column) throw Error("Choose an available source column explicitly.");
  const a = result.table.find(row => row.optionId === config.rowId), b = result.table.find(row => row.optionId === config.comparedRowId);
  if (!a || !b || a.optionId === b.optionId) throw Error("Choose two different source answers explicitly.");
  const base = a.bases[column.id]; if (!validBase(base) || b.bases[column.id] !== base) throw Error("These cells have incompatible response bases. A shared column and equal positive response universe are required; no minimum or pooled sample size is invented.");
  function operand(row: AnalyticsTableRow): CellFormulaOperand {
    const cell = analyticalCell(result, row, column!.id); if (cell.status !== "available") throw Error("An input is missing, invalid or requires a source refresh; it was not replaced with zero.");
    const columnIndex = result.columns.findIndex(item => item.id === column!.id), series = result.series.filter(item => item.id === row.optionId);
    if (series.length !== 1 || series[0].label !== row.label || series[0].values[columnIndex] !== cell.value || series[0].bases[columnIndex] !== base) throw Error("The source table and series disagree. Refresh the original analysis before calculating.");
    let value = cell.value;
    if (result.metric.id === "percent_selected") {
      const recorded = result.calculationInputs, raw = recorded?.rows[row.optionId];
      const pair = raw?.cells[column!.id];
      if (recorded?.version !== 1 || recorded.method !== "local_unweighted_v1" || !analysisSettingsMatch(recorded.query, result.query) || recorded.columns[column!.id] !== column!.label || raw?.label !== row.label || !pair || pair.denominator !== base || !Number.isSafeInteger(pair.numerator) || pair.numerator < 0 || pair.numerator > base) throw Error("Refresh this percentage source to record compatible full-precision numerator/denominator inputs.");
      value = pair.numerator / pair.denominator * 100;
      const tolerance = 1e-10 * Math.max(1, Math.abs(value));
      if (Math.abs(value - cell.value) > tolerance && Math.abs(Math.round(value * 10) / 10 - cell.value) > tolerance) throw Error("The recorded percentage and its numerator/denominator disagree. Refresh the source.");
    }
    return { id: row.optionId, label: row.label, sourceCategoryKey: row.sourceCategoryKey ?? "", value };
  }
  const input = { a: operand(a), b: operand(b), column: structuredClone(column), metric: structuredClone(result.metric), base };
  const next: CellFormulaSpec = { version: 1, expression: config.formula?.expression ?? "", label: config.formula?.label.trim() ?? "", binding: binding(result, input), input };
  assertFormulaSpec(next);
  if (config.formula?.binding && config.formula.binding !== next.binding) throw Error("The saved formula's source, answer or column meaning changed. Review current bindings in Calculated metrics before creating a new definition.");
  return next;
}
export function cellFormulaValue(spec: CellFormulaSpec) { assertFormulaSpec(spec); return evaluateCellFormula(spec.expression, spec.input.a.value, spec.input.b.value); }
export function cellFormulaNotes(spec: CellFormulaSpec): string[] {
  return [`Calculated metric: ${spec.label}. Formula ${spec.expression} (A and B are recorded ${spec.input.metric.label.toLowerCase()} values).`, `A = ${spec.input.a.label}: ${spec.input.a.value}; B = ${spec.input.b.label}: ${spec.input.b.value}; column ${spec.input.column.label}.`, `Source response universe n=${spec.input.base}; this is not a pooled sample or the formula's algebraic denominator.`, "Binary64 arithmetic on unrounded inputs. No significance test, confidence interval or causal interpretation was calculated."];
}
export function buildCellFormulaResponse(tile: DashboardTile, config: CellFormulaConfig): AnalyticsQueryResponse {
  const spec = makeCellFormulaSpec(tile, config), value = cellFormulaValue(spec), column = spec.input.column, rowId = "calculated_cell";
  return withSafeInference({ ...tile.result, calculationInputs: undefined, labels: [column.label], columns: [column], table: [{ optionId: rowId, sourceCategoryKey: JSON.stringify(`formula:${spec.binding}:${spec.expression}`), label: spec.label, values: { [column.id]: value }, bases: { [column.id]: spec.input.base }, presentation: { rowKind: "net", emphasis: "summary" } }], series: [{ id: rowId, label: spec.label, values: [value], bases: [spec.input.base] }], metric: { id: "calculated", label: `Calculated metric: ${spec.label}`, valueFormat: "number" }, annotations: [], statistics: { confidenceLevel: tile.result.statistics.confidenceLevel, significanceMethod: "none", significanceExecutionPlan: { status: "not_applicable", candidateMethod: "none", queryShapeSupported: false, providerCanExecute: false, executionInputContract: null, reasonCodes: ["future_method"], unmetPrerequisites: [] }, significanceExecutionInput: null, significanceExecutionReport: null, significance: { status: "unsupported", method: "none", readiness: { status: "unsupported", method: "none", comparisonBasis: "none", reasonCodes: ["future_method"] }, comparisonBasis: "none", reasonCodes: ["future_method"], details: [], hasPlaceholders: false } }, warnings: ["Calculated arithmetic metric. Source inference does not transfer to this result."], notes: [...cellFormulaNotes(spec), ...tile.result.notes] });
}
export function buildCellFormulaMetadata(tile: DashboardTile, config: CellFormulaConfig): NonNullable<DashboardTile["derivedOutput"]> {
  const spec = makeCellFormulaSpec(tile, config);
  return { kind: "cell_formula", formula: spec, sourceTileId: tile.id, sourceTitle: tile.title || tile.name, rowId: spec.input.a.id, rowLabel: spec.input.a.label, comparedRowId: spec.input.b.id, comparedRowLabel: spec.input.b.label, columnId: spec.input.column.id, columnLabel: spec.input.column.label, valueLabel: String(cellFormulaValue(spec)), baseLabel: `Source response universe n=${spec.input.base}`, rowCount: 2 };
}
export function formulaCacheIssue(tile: DashboardTile): string | null {
  if (tile.derivedOutput?.kind !== "cell_formula") return tile.result?.metric?.id === "calculated" || tile.derivedOutput?.formula !== undefined ? "The calculated result is missing its valid formula metadata. Recreate it from the original source." : null;
  try {
    const metadata = tile.derivedOutput, spec = metadata.formula!; assertFormulaSpec(spec);
    if (binding(tile.result, spec.input) !== spec.binding || metadata.rowId !== spec.input.a.id || metadata.comparedRowId !== spec.input.b.id || metadata.columnId !== spec.input.column.id || metadata.rowLabel !== spec.input.a.label || metadata.comparedRowLabel !== spec.input.b.label || metadata.columnLabel !== spec.input.column.label) throw Error("Formula metadata and recorded operand bindings disagree.");
    const expected = cellFormulaValue(spec), row = tile.result.table[0], series = tile.result.series[0], column = spec.input.column;
    if (metadata.valueLabel !== String(expected) || metadata.baseLabel !== `Source response universe n=${spec.input.base}` || metadata.rowCount !== 2 || tile.result.calculationInputs !== undefined || canonicalFormulaValue(tile.result.notes.slice(0, 4)) !== canonicalFormulaValue(cellFormulaNotes(spec)) || tile.result.statistics.significance.status !== "unsupported" || tile.result.statistics.significance.method !== "none" || tile.result.statistics.significance.details.length || tile.result.statistics.significanceExecutionInput !== null || tile.result.statistics.significanceExecutionReport !== null || tile.result.weighting.applied || tile.result.query.weight !== null) throw Error("The formula's value label, method, base or inference context was altered. Recreate it from its source.");
    if (row?.sourceCategoryKey !== JSON.stringify(`formula:${spec.binding}:${spec.expression}`)) throw Error("The calculated row identity does not match its formula.");
    if (tile.result.columns.length !== 1 || canonicalFormulaValue(tile.result.columns[0]) !== canonicalFormulaValue(column) || tile.result.table.length !== 1 || !row || row.optionId !== "calculated_cell" || row.label !== spec.label || row.values[column.id] !== expected || row.bases[column.id] !== spec.input.base || tile.result.series.length !== 1 || !series || series.id !== row.optionId || series.label !== spec.label || series.values.length !== 1 || series.values[0] !== expected || series.bases.length !== 1 || series.bases[0] !== spec.input.base || tile.result.metric.label !== `Calculated metric: ${spec.label}` || tile.result.metric.id !== "calculated" || tile.result.metric.valueFormat !== "number" || tile.result.annotations.length || tile.result.statistics.significanceMethod !== "none") throw Error("The stored formula value, base, label or inference disagrees with its recorded inputs. Recreate it from the source.");
    return null;
  } catch (problem) { return problem instanceof Error && !(problem instanceof TypeError) ? problem.message : "The recorded formula structure is invalid. Preserve its backup and recreate it from the original source."; }
}
export function formulaSourceIssue(output: NonNullable<DashboardTile["derivedOutput"]>, source: DashboardTile | undefined): string | null {
  if (output.kind !== "cell_formula") return null;
  if (!source) return "The formula source is missing. Include or restore its source page before exporting or refreshing.";
  try {
    const spec = makeCellFormulaSpec(source, { rowId: output.rowId, comparedRowId: output.comparedRowId, columnId: output.columnId, formula: output.formula });
    if (canonicalFormulaValue(spec) !== canonicalFormulaValue(output.formula)) return "The formula's recorded source values or bases changed. Preview and refresh the metric before exporting.";
    return null;
  } catch (problem) { return problem instanceof Error ? problem.message : "Review the formula source."; }
}
export function assertSavedCellFormulas(pages: DashboardPage[], definitions: SavedDerivedDefinition[] | undefined, designLibrary?: DashboardDraft["designLibrary"]): void {
  for (const page of pages) for (const tile of page.tiles) { const issue = formulaCacheIssue(tile); if (issue) throw Error(`Saved calculated metric: ${issue} The original saved data is preserved.`); }
  if (definitions !== undefined && !Array.isArray(definitions)) throw Error("The saved calculation library is invalid.");
  for (const definition of definitions ?? []) {
    if (definition.outputKind !== "cell_formula") { if (definition.spec?.formula !== undefined || definition.metricKind === "cell_formula") throw Error("The saved formula kind and metadata disagree."); continue; }
    assertFormulaSpec(definition.spec?.formula!);
    if (definition.spec.rowId !== definition.spec.formula!.input.a.id || definition.spec.comparedRowId !== definition.spec.formula!.input.b.id || definition.spec.columnId !== definition.spec.formula!.input.column.id) throw Error("The saved formula definition has inconsistent operand identities.");
    const query = definition.query;
    const recorded = { query, metadataRefs: { dataset: query.dataset, question: query.question, breakBy: query.breakBy, source: query.sourceIdentity } } as AnalyticsQueryResponse;
    if (binding(recorded, definition.spec.formula!.input) !== definition.spec.formula!.binding) throw Error("The saved formula's query context and operand bindings disagree.");
  }
  for (const collection of [designLibrary?.compositionBlocks, designLibrary?.compositionStarters]) if (Array.isArray(collection)) for (const block of collection) if (Array.isArray(block.items)) for (const item of block.items) if (item.kind === "tile") { const issue = formulaCacheIssue(item.tile); if (issue) throw Error(`Saved layout calculated metric: ${issue}`); }
}
