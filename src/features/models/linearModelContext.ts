import type { DashboardDraft, ImportedDatasetField, ImportedDatasetRecord } from "../../../shared/types/dashboard";
import type { AudienceExpression, SavedImportedAudience } from "../../../shared/types/audience";
import { audienceSourceIssue, compileAudience } from "../audiences/audienceModel";
import { isLikelyImportedIdentifierField } from "../data/importedDatasetAnalytics";
import { parseImportedNumber } from "../data/importedNumericValue";
import { maximumModelRows, maximumModelPredictors, maximumModelMagnitude, type NumericModelCase } from "./linearModelMath";

export interface LinearModelPlan { reportId: string; datasetId: string; importedAt: string; outcomeId: string; predictorIds: string[]; audienceId: string; seed: number }
export interface ModelSourceContext { draft: DashboardDraft; studies: ImportedDatasetRecord[]; plan: LinearModelPlan }
export interface ResolvedLinearModel {
  dataset: ImportedDatasetRecord; outcome: ImportedDatasetField; predictors: ImportedDatasetField[]; audience?: SavedImportedAudience;
  membership: (row: Record<string, string>) => boolean | null;
  binding: string;
}
export interface ModelCoverage { total: number; included: number; excluded: number; unknownAudience: number; complete: number; incomplete: number; fields: Array<{ id: string; blank: number; invalid: number }> }
export interface ModelInputProjection { membership: boolean | null; values: string[] }
export function eligibleModelFields(dataset: ImportedDatasetRecord | undefined) {
  return (dataset?.fields ?? []).filter(field => field.type === "numeric" && !isLikelyImportedIdentifierField(field));
}
export function resolveLinearModelContext({ draft, studies, plan }: ModelSourceContext): ResolvedLinearModel {
  if (plan.reportId !== draft.id) throw Error("The report changed. Start a new model in the current report.");
  const matches = studies.filter(study => study.id === plan.datasetId);
  if (matches.length !== 1) throw Error("Choose one unambiguous imported study.");
  const dataset = matches[0], issue = audienceSourceIssue(dataset);
  if (issue) throw Error(issue);
  if (dataset.remote || dataset.sourceType !== "local_file") throw Error("Model exploration currently requires a complete local-file study; remote services are not executed.");
  if (dataset.rowCount > maximumModelRows) throw Error("This model workflow supports at most 25,000 source rows.");
  if (!Number.isFinite(Date.parse(plan.importedAt)) || plan.importedAt !== dataset.importedAt) throw Error("This study was replaced. Explicitly review the current import before fitting again.");
  if (new Set(dataset.fields.map(field => field.id)).size !== dataset.fields.length || new Set(dataset.fields.map(field => field.sourceColumn)).size !== dataset.fields.length || dataset.fields.some(field => !field.id.trim() || !field.sourceColumn.trim())) throw Error("The study has conflicting field identities or raw column mappings.");
  if (!Number.isSafeInteger(plan.seed) || plan.seed < 1 || plan.seed > 0xffffffff) throw Error("Choose an integer split seed from 1 to 4294967295.");
  if (!plan.predictorIds.length || plan.predictorIds.length > maximumModelPredictors || new Set(plan.predictorIds).size !== plan.predictorIds.length || plan.predictorIds.includes(plan.outcomeId)) throw Error("Choose one to six different predictors, excluding the outcome itself.");
  const eligible = eligibleModelFields(dataset);
  function field(id: string) { const match = eligible.filter(item => item.id === id); if (match.length !== 1) throw Error("Choose available numeric measurements; identifier and system columns are excluded."); return match[0]; }
  const outcome = field(plan.outcomeId), predictors = plan.predictorIds.map(field);
  const audienceMatches = (draft.savedAudiences ?? []).filter(item => item.id === plan.audienceId);
  if (plan.audienceId && audienceMatches.length !== 1) throw Error("The chosen audience is missing or ambiguous. Choose it explicitly.");
  const audience = plan.audienceId ? audienceMatches[0] : undefined;
  const membership = audience ? compileAudience(audience, dataset) : () => true;
  const referenced = new Set([outcome.id, ...plan.predictorIds]);
  function visit(expression: AudienceExpression) { if (expression.kind === "group") expression.children.forEach(visit); else referenced.add(expression.fieldId); }
  if (audience) visit(audience.expression);
  const binding = JSON.stringify({ plan, study: { id: dataset.id, importedAt: dataset.importedAt, title: dataset.title, sourceType: dataset.sourceType, sourceRef: dataset.sourceRef, fileName: dataset.fileName, rowCount: dataset.rowCount, fieldCount: dataset.fieldCount }, fields: dataset.fields.filter(item => referenced.has(item.id)), audience });
  return { dataset, outcome, predictors, audience, membership, binding };
}
export function initialModelCoverage(context: ResolvedLinearModel): ModelCoverage {
  return { total: context.dataset.rows.length, included: 0, excluded: 0, unknownAudience: 0, complete: 0, incomplete: 0, fields: [context.outcome, ...context.predictors].map(field => ({ id: field.id, blank: 0, invalid: 0 })) };
}
export function projectModelRow(context: ResolvedLinearModel, index: number): ModelInputProjection {
  const row = context.dataset.rows[index];
  if (!row || typeof row !== "object" || Array.isArray(row)) throw Error("The study contains an unsupported row. Review its import before modelling.");
  const membership = context.membership(row);
  const values = membership === true ? [context.outcome, ...context.predictors].map(field => {
    const value = Object.hasOwn(row, field.sourceColumn) ? row[field.sourceColumn] : "";
    if (typeof value !== "string") throw Error("Selected raw fields contain unsupported values. Review their import before modelling.");
    return value;
  }) : [];
  return { membership, values };
}
export function collectModelRow(projection: ModelInputProjection, index: number, coverage: ModelCoverage): NumericModelCase | null {
  if (projection.membership !== true) { if (projection.membership === null) coverage.unknownAudience++; else coverage.excluded++; return null; }
  coverage.included++;
  const numbers = projection.values.map((raw, column) => {
    if (!raw.trim()) { coverage.fields[column].blank++; return null; }
    const value = parseImportedNumber(raw);
    if (value === null) { coverage.fields[column].invalid++; return null; }
    if (Math.abs(value) > maximumModelMagnitude) throw Error("A selected value exceeds the supported absolute magnitude of 1e12. Review its units; it was not silently discarded.");
    return value;
  });
  if (numbers.some(value => value === null)) { coverage.incomplete++; return null; }
  coverage.complete++;
  return { row: index + 1, outcome: numbers[0]!, predictors: numbers.slice(1) as number[] };
}
export function modelSourceMatches(current: ModelSourceContext, capturedBinding: string, projection: ModelInputProjection[]): boolean {
  try {
    const context = resolveLinearModelContext(current);
    if (context.binding !== capturedBinding || context.dataset.rows.length !== projection.length) return false;
    for (let index = 0; index < projection.length; index++) {
      const latest = projectModelRow(context, index), old = projection[index];
      if (latest.membership !== old.membership || latest.values.length !== old.values.length || latest.values.some((value, column) => value !== old.values[column])) return false;
    }
    return true;
  } catch { return false; }
}
