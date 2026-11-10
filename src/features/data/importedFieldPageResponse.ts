import type { ImportedDatasetField } from "../../../shared/types/dashboard";
import type { NetlifyDatasetFieldListResult } from "./netlifyDatasetStore";

export interface ImportedFieldPageRequest { datasetId: string; offset: number; limit: number; search?: string }
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === "string");
function field(value: unknown): value is ImportedDatasetField {
  if (!record(value)) return false;
  if (!["id", "label", "sourceColumn"].every(key => typeof value[key] === "string") || !value.id || !value.sourceColumn) return false;
  if (!["text", "numeric", "categorical", "date"].includes(value.type as string)
    || !["raw_variable", "candidate_dimension", "candidate_measure", "candidate_date"].includes(value.modelingRole as string)) return false;
  if (!count(value.nonEmptyCount) || !count(value.distinctCount) || value.distinctCount > value.nonEmptyCount || !strings(value.sampleValues)) return false;
  if (!["eligibleForFilter", "eligibleForSegment", "eligibleForBanner"].every(key => typeof value[key] === "boolean")) return false;
  if (["variableLabel", "sourceFormat"].some(key => value[key] !== undefined && typeof value[key] !== "string")) return false;
  return value.valueLabels === undefined || (record(value.valueLabels) && Object.values(value.valueLabels).every(label => typeof label === "string"));
}

export function assertImportedFieldPageRequest(request: ImportedFieldPageRequest): void {
  if (typeof request.datasetId !== "string" || !request.datasetId.trim() || !count(request.offset) || request.offset > 100000
    || !count(request.limit) || request.limit < 1 || request.limit > 500 || (request.search !== undefined && typeof request.search !== "string")) {
    throw new Error("The imported field page request is invalid. Reopen the study and try again.");
  }
}

export function readImportedFieldPage(value: unknown, request: ImportedFieldPageRequest): NetlifyDatasetFieldListResult {
  if (!record(value) || value.datasetId !== request.datasetId || value.offset !== request.offset || value.limit !== request.limit
    || !count(value.total) || !Array.isArray(value.fields) || !value.fields.every(field)
    || value.fields.length !== Math.min(request.limit, Math.max(0, value.total - request.offset))
    || new Set(value.fields.map(item => item.id)).size !== value.fields.length
    || new Set(value.fields.map(item => item.sourceColumn)).size !== value.fields.length) {
    throw new Error("The imported field list did not match the requested study and page, or its metadata was incomplete. Retry loading fields.");
  }
  return value as unknown as NetlifyDatasetFieldListResult;
}
