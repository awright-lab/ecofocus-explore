import type { AnalyticsQueryResponse, ChartType, Metric } from "../../../shared/types/analytics";
import type { ImportedDatasetField, ImportedDatasetRecord } from "../../../shared/types/dashboard";
import { assertJsonSize, quotedJsonLength } from "../../../shared/jsonSizeBudget";
import { assertImportedQueryResponse } from "./importedQueryResponse";
import { importedSourceIdentity, runImportedDatasetQuery, type ImportedDatasetQueryConfig } from "./importedDatasetAnalytics";

export const localAnalysisLimits = { threshold: 5000, rows: 50000, totalFields: 200, fields: 4, cells: 5000, metadataBytes: 2 * 1024 * 1024, sourceBytes: 20 * 1024 * 1024, resultChars: 4 * 1024 * 1024 } as const;
export type LocalAnalysisHeader = Pick<ImportedDatasetRecord, "id" | "title" | "sourceType" | "fileName" | "fileType" | "importedAt" | "rowCount" | "fieldCount" | "sourceRef">;
export interface LocalAnalysisRequest { source: LocalAnalysisHeader; fields: ImportedDatasetField[]; values: string[][]; group: number; measure: number | null; banner: number | null; filter: { field: number; value: string } | null; metric: Metric; chartType: ChartType; allRespondents: boolean }
const encoder = new TextEncoder();
export function localAnalysisMetadata(value: unknown): string {
  assertJsonSize(value, { maxChars: localAnalysisLimits.metadataBytes, maxNodes: 100000, maxDepth: 24 });
  const text = JSON.stringify(value); if (encoder.encode(text).length > localAnalysisLimits.metadataBytes) throw Error("Background creation metadata exceeds 2 MiB. Choose this-tab calculation or a smaller setup."); return text;
}
function dense(value: unknown, maximum: number): value is unknown[] { return Array.isArray(value) && value.length <= maximum && Object.getOwnPropertyNames(value).length === value.length + 1 && Array.from({ length: value.length }, (_, i) => Object.hasOwn(value, i)).every(Boolean); }
export function localAnalysisConfig(request: LocalAnalysisRequest, includeRows = true): ImportedDatasetQueryConfig {
  const { source } = request;
  localAnalysisMetadata({ ...request, values: undefined });
  if (!source || source.sourceType !== "local_file" || typeof source.id !== "string" || !source.id || typeof source.title !== "string" || !Number.isSafeInteger(source.rowCount) || source.rowCount < 1 || source.rowCount > localAnalysisLimits.rows || !Number.isSafeInteger(source.fieldCount) || source.fieldCount < 1 || source.fieldCount > localAnalysisLimits.totalFields || !dense(request.fields, 4) || !request.fields.length || !dense(request.values, localAnalysisLimits.rows) || request.values.length !== source.rowCount) throw Error("Background creation requires complete local-file rows and selected fields within its limits.");
  if (source.sourceRef && source.sourceRef.kind !== "imported_file") throw Error("Background creation will not reinterpret a remote or live source as a local file.");
  if (request.fields.some(f => !f || typeof f.id !== "string" || !f.id || typeof f.sourceColumn !== "string" || typeof f.label !== "string" || typeof f.type !== "string" || f.valueLabels !== undefined && (!f.valueLabels || typeof f.valueLabels !== "object" || Array.isArray(f.valueLabels) || Object.values(f.valueLabels).some(v => typeof v !== "string")))) throw Error("Background creation field metadata is malformed.");
  const index = (n: unknown) => Number.isInteger(n) && (n as number) >= 0 && (n as number) < request.fields.length;
  if (!index(request.group) || request.measure !== null && !index(request.measure) || request.banner !== null && !index(request.banner) || request.filter !== null && (!index(request.filter.field) || typeof request.filter.value !== "string" || request.filter.value.length > 20000) || typeof request.allRespondents !== "boolean") throw Error("Background creation roles are invalid.");
  if (!["count", "percent_selected", "column_percent", "average", "sum"].includes(request.metric) || !["table", "vertical_bar", "horizontal_bar", "grouped_bar", "stacked_bar", "line_chart", "donut", "heatmap", "dot_plot"].includes(request.chartType)) throw Error("This background calculation is unsupported.");
  const fields = request.fields.filter((_, i) => !request.allRespondents || i !== request.group);
  if (new Set(fields.map(f => f.id)).size !== fields.length || new Set(fields.map(f => f.sourceColumn)).size !== fields.length) throw Error("Background creation physical fields must be unambiguous.");
  const dataset: ImportedDatasetRecord = { ...source, fields, rows: [], previewRows: [], modelingStatus: "initial_model", notes: [] };
  const config: ImportedDatasetQueryConfig = { dataset, field: request.fields[request.group], measureField: request.measure === null ? null : request.fields[request.measure], bannerField: request.banner === null ? null : request.fields[request.banner], filter: request.filter ? { field: request.fields[request.filter.field], value: request.filter.value } : null, metric: request.metric, chartType: request.chartType, ...(request.allRespondents ? { groupingScope: "all_respondents" as const } : {}) };
  if (!includeRows) return config;
  const categories = request.fields.map(f => new Set(Object.keys(f.valueLabels ?? {})));
  const keyCost = fields.reduce((sum, f) => sum + quotedJsonLength(f.sourceColumn) + 2, 2); let bytes = 0, expanded = 0;
  for (const values of request.values) {
    if (!dense(values, request.fields.length) || values.length !== request.fields.length || values.some(v => typeof v !== "string" || v.length > 20000)) throw Error("Background source values are incomplete or oversized.");
    const text = JSON.stringify(values); bytes += encoder.encode(text).length + 1; expanded += keyCost + text.length;
    if (bytes > localAnalysisLimits.sourceBytes || expanded > localAnalysisLimits.sourceBytes) throw Error("Background selected values or expanded row keys exceed 20 MiB. Nothing was sampled or dropped.");
    values.forEach((v, i) => { if (v.trim()) categories[i].add(v.trim()); });
    dataset.rows.push(Object.fromEntries(request.fields.flatMap((f, i) => request.allRespondents && i === request.group ? [] : [[f.sourceColumn, values[i]]])));
  }
  const groups = request.allRespondents ? 1 : Math.max(1, categories[request.group].size), columns = request.banner === null ? 1 : Math.max(1, categories[request.banner].size + 1);
  if (groups * columns > localAnalysisLimits.cells) throw Error("Background creation can exceed 5,000 cells. Choose this-tab calculation or a smaller comparison; no cells were sampled.");
  return config;
}
export function calculateLocalAnalysis(request: LocalAnalysisRequest): AnalyticsQueryResponse {
  const config = localAnalysisConfig(request), result = runImportedDatasetQuery(config);
  if (result.table.length * result.columns.length > localAnalysisLimits.cells) throw Error("The complete result exceeds 5,000 cells.");
  assertJsonSize(result, { maxChars: localAnalysisLimits.resultChars, maxNodes: 150000, maxDepth: 32 }); assertImportedQueryResponse(result, config); return result;
}
export function assertLocalAnalysisResult(result: unknown, request: LocalAnalysisRequest): asserts result is AnalyticsQueryResponse {
  assertJsonSize(result, { maxChars: localAnalysisLimits.resultChars, maxNodes: 150000, maxDepth: 32 });
  const config = localAnalysisConfig(request, false); assertImportedQueryResponse(result, config);
  const expected = localAnalysisMetadata(importedSourceIdentity(config));
  if (localAnalysisMetadata(result.query.sourceIdentity) !== expected || localAnalysisMetadata(result.metadataRefs.source) !== expected || localAnalysisMetadata(result.query.sourceRef) !== localAnalysisMetadata(config.dataset.sourceRef)) throw Error("Background creation returned mismatched source identity. No analysis was inserted.");
}
