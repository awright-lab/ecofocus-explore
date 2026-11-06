import type { AudienceExpression, SavedImportedAudience } from "../../../shared/types/audience";
import type { DashboardDraft, ImportedDatasetField, ImportedDatasetRecord } from "../../../shared/types/dashboard";
import { audienceSourceIssue, compileAudience } from "../audiences/audienceModel";

export const maximumMultiResponseRows = 50000;
export const maximumMultiResponseOptions = 12;
export interface MultiResponseOption { fieldId: string; selected: string; notSelected: string }
export interface MultiResponsePlan { reportId: string; datasetId: string; importedAt: string; idFieldId: string; options: MultiResponseOption[]; audienceId: string }
export interface MultiResponseContext { draft: DashboardDraft; studies: ImportedDatasetRecord[]; plan: MultiResponsePlan }
export interface ResolvedMultiResponse {
  dataset: ImportedDatasetRecord; idField: ImportedDatasetField;
  options: Array<MultiResponseOption & { field: ImportedDatasetField }>;
  audience?: SavedImportedAudience; membership: (row: Record<string, string>) => boolean | null; binding: string;
}
export interface MultiResponseProjection { id: string; values: string[]; membership: boolean | null }
export interface MultiResponseCoverage {
  total: number; audienceIncluded: number; audienceExcluded: number; audienceUnknown: number; complete: number; incomplete: number;
  fields: Array<{ id: string; blank: number; unmapped: number }>;
}
export interface MultiResponseResult {
  base: number; optionCounts: number[]; overlapCounts: number[][]; selectedCountDistribution: number[];
  patterns: Array<{ mask: number; count: number }>;
}

export function resolveMultiResponseContext({ draft, studies, plan }: MultiResponseContext): ResolvedMultiResponse {
  if (draft.id !== plan.reportId) throw Error("The report changed. Start this exploration in the current report.");
  const matches = studies.filter(study => study.id === plan.datasetId);
  if (matches.length !== 1) throw Error("Choose one unambiguous imported study.");
  const dataset = matches[0], issue = audienceSourceIssue(dataset);
  if (issue) throw Error(issue);
  if (dataset.remote || dataset.sourceType !== "local_file") throw Error("Multiple-response exploration requires a complete local-file study. Remote services are not queried.");
  if (!Number.isSafeInteger(dataset.rowCount) || dataset.rowCount < 1 || dataset.rowCount > maximumMultiResponseRows) throw Error("Choose a complete study containing 1–50,000 source rows.");
  if (plan.importedAt !== dataset.importedAt || !Number.isFinite(Date.parse(plan.importedAt))) throw Error("This study was replaced. Explicitly review the current import and reset the mappings.");
  if (dataset.fields.length !== dataset.fieldCount || new Set(dataset.fields.map(field => field.id)).size !== dataset.fields.length || new Set(dataset.fields.map(field => field.sourceColumn)).size !== dataset.fields.length || dataset.fields.some(field => !field.id.trim() || !field.sourceColumn.trim())) throw Error("Complete, unambiguous field identities and raw column mappings are required.");
  function field(id: string) { const match = dataset.fields.filter(item => item.id === id); if (match.length !== 1) throw Error("Choose available fields explicitly; missing fields are not replaced automatically."); return match[0]; }
  const idField = field(plan.idFieldId);
  if (plan.options.length < 2 || plan.options.length > maximumMultiResponseOptions || new Set(plan.options.map(option => option.fieldId)).size !== plan.options.length || plan.options.some(option => option.fieldId === idField.id)) throw Error("Choose 2–12 different response indicator fields, excluding the respondent ID field.");
  const options = plan.options.map(option => {
    if (![option.selected, option.notSelected].every(code => typeof code === "string" && code.trim() === code && code.length > 0 && code.length <= 128) || option.selected === option.notSelected) throw Error("Enter two different nonblank exact codes for each response: selected and not selected (up to 128 characters). Blank and all other codes remain unknown.");
    return { fieldId: option.fieldId, selected: option.selected, notSelected: option.notSelected, field: field(option.fieldId) };
  });
  const audiences = (draft.savedAudiences ?? []).filter(audience => audience.id === plan.audienceId);
  if (plan.audienceId && audiences.length !== 1) throw Error("The selected audience is missing or ambiguous. Choose it explicitly.");
  const audience = plan.audienceId ? audiences[0] : undefined, membership = audience ? compileAudience(audience, dataset) : () => true;
  const referenced = new Set([idField.id, ...options.map(option => option.fieldId)]);
  function visit(expression: AudienceExpression) { if (expression.kind === "group") expression.children.forEach(visit); else referenced.add(expression.fieldId); }
  if (audience) visit(audience.expression);
  const binding = JSON.stringify({ plan, study: { id: dataset.id, importedAt: dataset.importedAt, title: dataset.title, sourceType: dataset.sourceType, sourceRef: dataset.sourceRef, fileName: dataset.fileName, rowCount: dataset.rowCount, fieldCount: dataset.fieldCount }, fields: dataset.fields.filter(item => referenced.has(item.id)), audience });
  return { dataset, idField, options, audience, membership, binding };
}

export function projectMultiResponseRow(context: ResolvedMultiResponse, index: number): MultiResponseProjection {
  const row = context.dataset.rows[index];
  if (!row || typeof row !== "object" || Array.isArray(row)) throw Error("The study contains an unsupported source row. Review its import.");
  function value(field: ImportedDatasetField, limit: number) {
    const raw = Object.hasOwn(row, field.sourceColumn) ? row[field.sourceColumn] : "";
    if (typeof raw !== "string" || raw.length > limit) throw Error(`A selected field has an unsupported value at source row ${index + 1}. ID values support up to 256 characters and response codes up to 128.`);
    return raw;
  }
  return { id: value(context.idField, 256), values: context.options.map(option => value(option.field, 128)), membership: context.membership(row) };
}

export function multiResponseSourceMatches(input: MultiResponseContext, binding: string, projection: MultiResponseProjection[]): boolean {
  try {
    const context = resolveMultiResponseContext(input);
    if (context.binding !== binding || context.dataset.rows.length !== projection.length) return false;
    for (let i = 0; i < projection.length; i++) {
      const current = projectMultiResponseRow(context, i), before = projection[i];
      if (current.id !== before.id || current.membership !== before.membership || current.values.some((value, index) => value !== before.values[index])) return false;
    }
    return true;
  } catch { return false; }
}

export function initialMultiResponseCoverage(context: ResolvedMultiResponse): MultiResponseCoverage {
  return { total: context.dataset.rows.length, audienceIncluded: 0, audienceExcluded: 0, audienceUnknown: 0, complete: 0, incomplete: 0, fields: context.options.map(option => ({ id: option.fieldId, blank: 0, unmapped: 0 })) };
}

export function collectMultiResponseRow(context: ResolvedMultiResponse, row: MultiResponseProjection, index: number, ids: Set<string>, coverage: MultiResponseCoverage): number | null {
  const id = row.id.trim();
  if (!id || ids.has(id)) throw Error(`Respondent IDs must be nonblank and unique across the complete import (source row ${index + 1}). Repeated IDs were not counted as different people or silently deduplicated.`);
  ids.add(id);
  if (row.membership !== true) { if (row.membership === null) coverage.audienceUnknown++; else coverage.audienceExcluded++; return null; }
  coverage.audienceIncluded++;
  let mask = 0, complete = true;
  context.options.forEach((option, i) => {
    const value = row.values[i].trim();
    if (!value) { coverage.fields[i].blank++; complete = false; }
    else if (value === option.selected) mask |= 1 << i;
    else if (value !== option.notSelected) { coverage.fields[i].unmapped++; complete = false; }
  });
  if (!complete) { coverage.incomplete++; return null; }
  coverage.complete++; return mask;
}

function countBits(mask: number) { let count = 0; while (mask) { count += mask & 1; mask >>>= 1; } return count; }
export function summarizeMultiResponsePatterns(frequencies: Uint32Array, options: number): MultiResponseResult {
  if (!Number.isInteger(options) || options < 2 || options > maximumMultiResponseOptions || frequencies.length !== 2 ** options) throw Error("The response pattern structure is invalid.");
  const result: MultiResponseResult = { base: 0, optionCounts: Array(options).fill(0), overlapCounts: Array.from({ length: options }, () => Array(options).fill(0)), selectedCountDistribution: Array(options + 1).fill(0), patterns: [] };
  frequencies.forEach((count, mask) => {
    if (!count) return;
    result.base += count; result.patterns.push({ mask, count }); result.selectedCountDistribution[countBits(mask)] += count;
    for (let a = 0; a < options; a++) if (mask & 1 << a) {
      result.optionCounts[a] += count;
      for (let b = 0; b < options; b++) if (mask & 1 << b) result.overlapCounts[a][b] += count;
    }
  });
  if (result.base < 1 || result.base > maximumMultiResponseRows) throw Error("No complete audience respondents remain, or the supported population limit was exceeded. Missing responses were not treated as not selected.");
  result.patterns.sort((a, b) => b.count - a.count || a.mask - b.mask); return result;
}

export function combinedMultiResponse(result: MultiResponseResult, indexes: number[]) {
  if (!indexes.length || new Set(indexes).size !== indexes.length || indexes.some(index => !Number.isInteger(index) || index < 0 || index >= result.optionCounts.length)) throw Error("Choose at least one different available response for the combination.");
  const selected = indexes.reduce((mask, index) => mask | 1 << index, 0);
  let any = 0, all = 0;
  for (const pattern of result.patterns) { if (pattern.mask & selected) any += pattern.count; if ((pattern.mask & selected) === selected) all += pattern.count; }
  return { any, all, none: result.base - any, base: result.base };
}

export function multiResponseCodeExamples(dataset: ImportedDatasetRecord, field: ImportedDatasetField) {
  const values = new Set<string>();
  for (const row of dataset.rows) {
    const value = Object.hasOwn(row, field.sourceColumn) ? row[field.sourceColumn] : "";
    if (typeof value === "string" && value.trim() && value.length <= 128) values.add(value.trim());
    if (values.size > 50) break;
  }
  return { values: [...values].slice(0, 50).sort((a, b) => a.localeCompare(b)), truncated: values.size > 50 };
}
