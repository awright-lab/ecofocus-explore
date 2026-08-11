import type {
  LiveDatasetFieldDescriptor,
  LiveDatasetSourceInspectionReport,
  LiveDatasetSourceInspectionRequest
} from "../../types/dataSource";
import { getSnowflakeReadiness, requireSnowflakeConfig, type SnowflakeConfig } from "./snowflakeConfig";
import {
  assertSnowflakeSqlIsReadOnly,
  SnowflakeProviderError,
  snowflakeSdkQueryExecutor,
  type SnowflakeQueryExecutor,
  type SnowflakeResultRow
} from "./snowflakeProvider";

interface SnowflakeObjectPath {
  database: string;
  schema: string;
  objectName: string;
}

const identifierPattern = /^[A-Za-z_][A-Za-z0-9_$]*$/;

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function sqlString(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

function readRowValue(row: SnowflakeResultRow, key: string) {
  const match = Object.keys(row).find((rowKey) => rowKey.toLowerCase() === key.toLowerCase());
  return match ? row[match] : undefined;
}

function readString(row: SnowflakeResultRow, key: string, fallback = "") {
  const value = readRowValue(row, key);
  return value === null || value === undefined ? fallback : String(value);
}

function report(
  request: LiveDatasetSourceInspectionRequest,
  status: LiveDatasetSourceInspectionReport["status"],
  statusLabel: string,
  diagnostics: string[],
  nextStep: string,
  fields: LiveDatasetFieldDescriptor[] = []
): LiveDatasetSourceInspectionReport {
  return {
    provider: request.provider,
    connectionId: request.connectionId,
    sourceRefId: request.sourceRefId,
    objectPath: request.objectPath,
    objectType: request.objectType,
    status,
    statusLabel,
    inspectedAt: new Date().toISOString(),
    fields,
    diagnostics,
    nextStep
  };
}

function normalizeFieldId(rawName: string, index: number) {
  const normalized = rawName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || `field_${index + 1}`;
}

function titleCaseIdentifier(rawName: string) {
  return rawName
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function mapSnowflakeType(sourceType: string): LiveDatasetFieldDescriptor["type"] {
  const normalized = sourceType.toUpperCase();

  if (/(NUMBER|DECIMAL|NUMERIC|INT|FLOAT|DOUBLE|REAL)/.test(normalized)) return "number";
  if (/(DATE|TIME|TIMESTAMP)/.test(normalized)) return "date";
  if (/(BOOLEAN)/.test(normalized)) return "boolean";
  if (/(CHAR|TEXT|STRING|VARCHAR)/.test(normalized)) return "text";

  return "unknown";
}

export function validateSnowflakeObjectPath(objectPath: string, config: SnowflakeConfig): SnowflakeObjectPath {
  const parts = objectPath.split(".").map((part) => part.trim()).filter(Boolean);

  if (parts.length < 1 || parts.length > 3) {
    throw new SnowflakeProviderError("snowflake_config_error", "Snowflake source inspection supports table, schema.table, or database.schema.table paths.", [
      "unsupported_object_path"
    ], {
      objectPath
    });
  }

  parts.forEach((part) => {
    if (!identifierPattern.test(part)) {
      throw new SnowflakeProviderError("snowflake_config_error", `Unsafe Snowflake source path segment: ${part}.`, ["unsafe_identifier"], {
        objectPath,
        segment: part
      });
    }
  });

  if (parts.length === 1) {
    return {
      database: config.database,
      schema: config.schema,
      objectName: parts[0]
    };
  }

  if (parts.length === 2) {
    return {
      database: config.database,
      schema: parts[0],
      objectName: parts[1]
    };
  }

  return {
    database: parts[0],
    schema: parts[1],
    objectName: parts[2]
  };
}

export function buildSnowflakeSourceInspectionSql(request: LiveDatasetSourceInspectionRequest, config: SnowflakeConfig) {
  const target = validateSnowflakeObjectPath(request.objectPath, config);
  const limit = Math.max(1, Math.min(Math.round(request.limit ?? 200), 500));

  const sqlText = [
    "SELECT column_name, data_type, is_nullable, ordinal_position",
    `FROM ${quoteIdentifier(target.database)}.information_schema.columns`,
    `WHERE table_schema = ${sqlString(target.schema.toUpperCase())}`,
    `AND table_name = ${sqlString(target.objectName.toUpperCase())}`,
    "ORDER BY ordinal_position",
    `LIMIT ${limit}`
  ].join(" ");

  assertSnowflakeSqlIsReadOnly(sqlText);

  return {
    sqlText,
    target,
    limit
  };
}

function normalizeInspectionRows(rows: SnowflakeResultRow[]): LiveDatasetFieldDescriptor[] {
  return rows.map((row, index) => {
    const rawName = readString(row, "column_name", `FIELD_${index + 1}`);
    const sourceType = readString(row, "data_type", "UNKNOWN");
    const nullable = readString(row, "is_nullable").toUpperCase() === "YES";

    return {
      id: normalizeFieldId(rawName, index),
      rawName,
      label: titleCaseIdentifier(rawName),
      type: mapSnowflakeType(sourceType),
      nullable,
      sourceType
    };
  });
}

export async function inspectSnowflakeSource(
  request: LiveDatasetSourceInspectionRequest,
  executor: SnowflakeQueryExecutor = snowflakeSdkQueryExecutor,
  env: Record<string, string | undefined> = process.env
): Promise<LiveDatasetSourceInspectionReport> {
  if (request.objectType === "query") {
    return report(
      request,
      "unsupported",
      "Query inspection pending",
      ["Freeform SQL/query source inspection is not supported yet."],
      "Map a Snowflake table or view first; query-source inspection needs a separate SQL parsing and safety pass."
    );
  }

  if (request.objectType !== "table" && request.objectType !== "view") {
    return report(
      request,
      "unsupported",
      "Unsupported source type",
      [`${request.objectType} sources are not inspectable yet.`],
      "Use a table or view source for the first live schema inspection path."
    );
  }

  const readiness = getSnowflakeReadiness(env);
  if (!readiness.configured) {
    return report(
      request,
      "failed",
      "Missing server environment",
      [`Missing Snowflake environment variables: ${readiness.missingEnvVars.join(", ")}.`],
      "Add Snowflake credentials and read-only warehouse settings to Netlify environment variables, then inspect the source again."
    );
  }

  try {
    const config = requireSnowflakeConfig(env);
    const plan = buildSnowflakeSourceInspectionSql(request, config);
    const rows = await executor.execute(plan.sqlText, config);
    const fields = normalizeInspectionRows(rows);

    if (fields.length === 0) {
      return report(
        request,
        "failed",
        "No fields found",
        [`Snowflake returned no columns for ${plan.target.database}.${plan.target.schema}.${plan.target.objectName}.`],
        "Confirm the table/view path and role privileges, then inspect the source again."
      );
    }

    return report(
      request,
      "inspected",
      "Fields inspected",
      [`${fields.length.toLocaleString()} fields were read from Snowflake information_schema.columns.`],
      "Map analytical roles for these fields before enabling live query creation.",
      fields
    );
  } catch (error) {
    if (error instanceof SnowflakeProviderError) {
      return report(
        request,
        "failed",
        "Inspection failed",
        error.reasons.length ? [error.message, ...error.reasons] : [error.message],
        "Check the mapped object path, Snowflake role privileges, and read-only source settings."
      );
    }

    return report(
      request,
      "failed",
      "Inspection failed",
      [error instanceof Error ? error.message : "Unknown Snowflake inspection failure."],
      "Check Netlify function logs, Snowflake connectivity, and the mapped source path."
    );
  }
}
