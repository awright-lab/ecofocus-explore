import { getDatabase, MissingDatabaseConnectionError } from "@netlify/database";
import type { Handler } from "@netlify/functions";
import type { ImportedDatasetField } from "../../shared/types/dashboard";

const jsonHeaders = {
  "Content-Type": "application/json"
};

function errorResponse(statusCode: number, error: string, details?: string[]) {
  return {
    statusCode,
    headers: jsonHeaders,
    body: JSON.stringify({ error, details })
  };
}

function numberParam(value: string | undefined, fallback: number, max: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, max);
}

function jsonRecord(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, String(entry)]));
}

function jsonStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry));
}

interface ImportedDatasetFieldRow {
  field_id: string;
  label: string;
  source_column: string;
  variable_label: string | null;
  value_labels: unknown;
  source_format: string | null;
  field_type: ImportedDatasetField["type"];
  non_empty_count: number;
  distinct_count: number;
  sample_values: unknown;
  modeling_role: ImportedDatasetField["modelingRole"];
  eligible_for_filter: boolean;
  eligible_for_segment: boolean;
  eligible_for_banner: boolean;
}

function fieldFromRow(row: ImportedDatasetFieldRow): ImportedDatasetField {
  return {
    id: row.field_id,
    label: row.label,
    sourceColumn: row.source_column,
    variableLabel: row.variable_label ?? undefined,
    valueLabels: jsonRecord(row.value_labels),
    sourceFormat: row.source_format ?? undefined,
    type: row.field_type,
    nonEmptyCount: row.non_empty_count,
    distinctCount: row.distinct_count,
    sampleValues: jsonStringArray(row.sample_values),
    modelingRole: row.modeling_role,
    eligibleForFilter: row.eligible_for_filter,
    eligibleForSegment: row.eligible_for_segment,
    eligibleForBanner: row.eligible_for_banner
  };
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return errorResponse(405, "Method not allowed. Use GET.");
  }

  const datasetId = event.queryStringParameters?.datasetId?.trim();
  if (!datasetId) return errorResponse(400, "Missing imported dataset id.");

  const offset = numberParam(event.queryStringParameters?.offset, 0, 100000);
  const limit = numberParam(event.queryStringParameters?.limit, 120, 500);
  const search = event.queryStringParameters?.search?.trim() ?? "";

  try {
    const { pool } = getDatabase();
    const params: Array<string | number> = [datasetId];
    const searchClause = search
      ? `and (
          label ilike $2
          or source_column ilike $2
          or coalesce(variable_label, '') ilike $2
          or coalesce(source_format, '') ilike $2
        )`
      : "";
    if (search) params.push(`%${search}%`);

    const countResult = await pool.query<{ count: string }>(
      `select count(*)::text as count
       from imported_dataset_fields
       where dataset_id = $1 ${searchClause}`,
      params
    );

    const fieldParams = [...params, limit, offset];
    const limitParam = fieldParams.length - 1;
    const offsetParam = fieldParams.length;
    const fieldResult = await pool.query<ImportedDatasetFieldRow>(
      `select
        field_id,
        label,
        source_column,
        variable_label,
        value_labels,
        source_format,
        field_type,
        non_empty_count,
        distinct_count,
        sample_values,
        modeling_role,
        eligible_for_filter,
        eligible_for_segment,
        eligible_for_banner
       from imported_dataset_fields
       where dataset_id = $1 ${searchClause}
       order by field_id asc
       limit $${limitParam} offset $${offsetParam}`,
      fieldParams
    );

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({
        datasetId,
        fields: fieldResult.rows.map(fieldFromRow),
        total: Number.parseInt(countResult.rows[0]?.count ?? "0", 10),
        offset,
        limit
      })
    };
  } catch (error) {
    if (error instanceof MissingDatabaseConnectionError) {
      return errorResponse(503, "Netlify Database is not connected for imported dataset fields.", [
        "Connect Netlify Database and re-import the dataset so fields can be read server-side."
      ]);
    }

    return errorResponse(500, "Imported dataset field lookup failed.", [error instanceof Error ? error.message : "Unknown error"]);
  }
};
