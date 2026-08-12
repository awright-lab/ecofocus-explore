import type {
  LiveDatasetFieldDescriptor,
  LiveDatasetQueryDefinition,
  LiveDatasetQueryExecutionReport,
  LiveDatasetQueryExecutionRequest,
  LiveDatasetQueryExecutionResult,
  LiveDatasetSourceDescriptor
} from "../../types/dataSource";
import { getSnowflakeReadiness, requireSnowflakeConfig, type SnowflakeConfig } from "./snowflakeConfig";
import { validateSnowflakeObjectPath } from "./snowflakeSourceInspection";
import {
  assertSnowflakeSqlIsReadOnly,
  SnowflakeProviderError,
  snowflakeSdkQueryExecutor,
  type SnowflakeQueryExecutor,
  type SnowflakeResultRow
} from "./snowflakeProvider";

const identifierPattern = /^[A-Za-z_][A-Za-z0-9_$]*$/;

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function readRowValue(row: SnowflakeResultRow, key: string) {
  const match = Object.keys(row).find((rowKey) => rowKey.toLowerCase() === key.toLowerCase());
  return match ? row[match] : undefined;
}

function readString(row: SnowflakeResultRow, key: string, fallback = "") {
  const value = readRowValue(row, key);
  return value === null || value === undefined ? fallback : String(value);
}

function readNumber(row: SnowflakeResultRow, key: string) {
  const value = readRowValue(row, key);
  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function slug(value: string, fallback: string) {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return normalized || fallback;
}

function report(
  request: LiveDatasetQueryExecutionRequest,
  status: LiveDatasetQueryExecutionReport["status"],
  statusLabel: string,
  diagnostics: string[],
  nextStep: string,
  result: LiveDatasetQueryExecutionResult | null = null
): LiveDatasetQueryExecutionReport {
  return {
    provider: request.provider,
    connectionId: request.connectionId,
    sourceRefId: request.source.sourceRef.id,
    definitionId: request.definition.id,
    status,
    statusLabel,
    diagnostics,
    nextStep,
    result
  };
}

function findField(source: LiveDatasetSourceDescriptor, fieldId: string) {
  return (source.inspection?.fields ?? []).find((field) => field.id === fieldId);
}

function validateFieldIdentifier(field: LiveDatasetFieldDescriptor) {
  if (!identifierPattern.test(field.rawName)) {
    throw new SnowflakeProviderError("snowflake_config_error", `Unsafe Snowflake field name: ${field.rawName}.`, ["unsafe_identifier"], {
      fieldId: field.id,
      rawName: field.rawName
    });
  }
}

export function validateSnowflakeLiveQueryDefinitionSupport(
  source: LiveDatasetSourceDescriptor,
  definition: LiveDatasetQueryDefinition
): { supported: true; primaryField: LiveDatasetFieldDescriptor } | { supported: false; reason: string; nextStep: string } {
  if (source.sourceRef.provider !== "snowflake") {
    return {
      supported: false,
      reason: `${source.sourceRef.provider} live query execution is not implemented yet.`,
      nextStep: "Use Snowflake for the first live query-definition runner."
    };
  }

  if (source.objectType === "query") {
    return {
      supported: false,
      reason: "Freeform query sources are not executable through this runner yet.",
      nextStep: "Map a Snowflake table or view before running a saved live query definition."
    };
  }

  if (source.objectType !== "table" && source.objectType !== "view") {
    return {
      supported: false,
      reason: `${source.objectType} sources are not supported by this runner.`,
      nextStep: "Use a table or view source for the first live query execution path."
    };
  }

  if (source.status !== "available") {
    return {
      supported: false,
      reason: "The source is not marked available.",
      nextStep: "Verify or update the source mapping before running this definition."
    };
  }

  if (source.inspection?.status !== "inspected") {
    return {
      supported: false,
      reason: "The source needs inspected field metadata before execution.",
      nextStep: "Inspect fields, then model a grouping field before running this definition."
    };
  }

  if (definition.kind !== "categorical") {
    return {
      supported: false,
      reason: "Measure definitions are still saved metadata only.",
      nextStep: "Run a categorical count definition first; measure execution needs a later provider pass."
    };
  }

  if (definition.metric !== "count") {
    return {
      supported: false,
      reason: "Only categorical count definitions execute in the first Snowflake runner.",
      nextStep: "Save or run a count-based categorical definition."
    };
  }

  if (definition.breakoutFieldId) {
    return {
      supported: false,
      reason: "Breakout live definitions are not supported by this first runner.",
      nextStep: "Run a single-field categorical count definition before adding live breakout support."
    };
  }

  const primaryField = findField(source, definition.primaryFieldId);
  if (!primaryField) {
    return {
      supported: false,
      reason: `${definition.primaryFieldLabel} is no longer present in inspected metadata.`,
      nextStep: "Refresh field inspection or save a new definition from the current field list."
    };
  }

  if (primaryField.modelingRole !== "dimension") {
    return {
      supported: false,
      reason: `${primaryField.label} must be modeled as a Group field.`,
      nextStep: "Model the primary field as Group before running this definition."
    };
  }

  try {
    validateFieldIdentifier(primaryField);
  } catch (error) {
    return {
      supported: false,
      reason: error instanceof Error ? error.message : "The primary field name is not safe for SQL generation.",
      nextStep: "Refresh source inspection or rename/remap the field before running this definition."
    };
  }

  return { supported: true, primaryField };
}

export function buildSnowflakeLiveCategoricalDefinitionSql(
  source: LiveDatasetSourceDescriptor,
  definition: LiveDatasetQueryDefinition,
  config: SnowflakeConfig,
  limit = 200
): {
  sqlText: string;
  limit: number;
  target: {
    database: string;
    schema: string;
    objectName: string;
  };
  primaryField: LiveDatasetFieldDescriptor;
} {
  const support = validateSnowflakeLiveQueryDefinitionSupport(source, definition);
  if (!support.supported) {
    throw new SnowflakeProviderError("snowflake_unsupported_query", support.reason, ["unsupported_live_definition"], {
      nextStep: support.nextStep
    });
  }

  const target = validateSnowflakeObjectPath(source.objectPath, config);
  const safeLimit = Math.max(1, Math.min(Math.round(limit), 500));
  const tableIdentifier = [target.database, target.schema, target.objectName].map(quoteIdentifier).join(".");
  const fieldIdentifier = quoteIdentifier(support.primaryField.rawName);

  const sqlText = [
    "SELECT",
    `${fieldIdentifier} AS option_value,`,
    "COUNT(*) AS value",
    `FROM ${tableIdentifier}`,
    `WHERE ${fieldIdentifier} IS NOT NULL`,
    `GROUP BY ${fieldIdentifier}`,
    "ORDER BY value DESC, option_value ASC",
    `LIMIT ${safeLimit}`
  ].join(" ");

  assertSnowflakeSqlIsReadOnly(sqlText);

  return {
    sqlText,
    limit: safeLimit,
    target,
    primaryField: support.primaryField
  };
}

export function normalizeSnowflakeLiveDefinitionRows(
  request: LiveDatasetQueryExecutionRequest,
  rows: SnowflakeResultRow[]
): LiveDatasetQueryExecutionResult {
  const totalBase = rows.reduce((sum, row) => sum + readNumber(row, "value"), 0);
  const normalizedRows = rows.map((row, index) => {
    const label = readString(row, "option_value", "(blank)").trim() || "(blank)";
    const value = readNumber(row, "value");
    return {
      id: `${slug(label, "live_row")}_${index + 1}`,
      label,
      values: { summary: value },
      bases: { summary: totalBase }
    };
  });

  return {
    columns: [{ id: "summary", label: "Total" }],
    rows: normalizedRows,
    metric: {
      id: request.definition.metric,
      label: "Number of rows",
      valueFormat: "number"
    },
    rowCount: normalizedRows.length,
    totalBase,
    truncated: normalizedRows.length >= Math.max(1, Math.min(Math.round(request.limit ?? 200), 500)),
    generatedAt: new Date().toISOString()
  };
}

export async function runSnowflakeLiveQueryDefinition(
  request: LiveDatasetQueryExecutionRequest,
  executor: SnowflakeQueryExecutor = snowflakeSdkQueryExecutor,
  env: Record<string, string | undefined> = process.env
): Promise<LiveDatasetQueryExecutionReport> {
  if (request.provider !== "snowflake") {
    return report(
      request,
      "unsupported",
      "Provider not supported",
      [`${request.provider} live query execution is not implemented yet.`],
      "Use Snowflake for the first saved live query-definition execution path."
    );
  }

  const support = validateSnowflakeLiveQueryDefinitionSupport(request.source, request.definition);
  if (!support.supported) {
    return report(request, "unsupported", "Live definition unsupported", [support.reason], support.nextStep);
  }

  const readiness = getSnowflakeReadiness(env);
  if (!readiness.configured) {
    return report(
      request,
      "failed",
      "Missing server environment",
      [`Missing Snowflake environment variables: ${readiness.missingEnvVars.join(", ")}.`],
      "Add Snowflake credentials and read-only warehouse settings to Netlify environment variables, then run the definition again."
    );
  }

  try {
    const config = requireSnowflakeConfig(env);
    const plan = buildSnowflakeLiveCategoricalDefinitionSql(request.source, request.definition, config, request.limit);
    const rows = await executor.execute(plan.sqlText, config);
    const result = normalizeSnowflakeLiveDefinitionRows(request, rows);
    const diagnostics = [
      `${result.rowCount.toLocaleString()} grouped row${result.rowCount === 1 ? "" : "s"} returned from ${plan.target.database}.${plan.target.schema}.${plan.target.objectName}.`,
      ...(result.truncated ? [`Result was limited to the first ${plan.limit.toLocaleString()} groups.`] : []),
      ...(result.rowCount === 0 ? ["Snowflake returned no non-empty grouped values for this field."] : [])
    ];

    return report(
      request,
      "executed",
      result.rowCount === 0 ? "Live query returned no rows" : "Live query executed",
      diagnostics,
      result.rowCount === 0
        ? "Check the selected field or source table before using this saved definition."
        : "Review the preview, then use the next live-query pass to place this as a canvas tile.",
      result
    );
  } catch (error) {
    if (error instanceof SnowflakeProviderError) {
      return report(
        request,
        "failed",
        "Live query failed",
        error.reasons.length ? [error.message, ...error.reasons] : [error.message],
        "Check the source mapping, modeled field, Snowflake role privileges, and function logs."
      );
    }

    return report(
      request,
      "failed",
      "Live query failed",
      [error instanceof Error ? error.message : "Unknown Snowflake live query failure."],
      "Check Netlify function logs, Snowflake connectivity, and the mapped source path."
    );
  }
}
