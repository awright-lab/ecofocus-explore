import {
  assertSnowflakeSqlIsReadOnly,
  buildSnowflakeSqlPlan,
  createSnowflakeAnalyticsProvider,
  SnowflakeProviderError,
  snowflakeSdkQueryExecutor,
  type SnowflakeQueryExecutor
} from "./snowflakeProvider";
import { getSnowflakeReadiness, requireSnowflakeConfig, type SnowflakeConfig } from "./snowflakeConfig";
import { datasets } from "../../metadata/ecofocus2025";
import type { AnalyticsQueryRequest } from "../../types/analytics";

export type SnowflakeVerificationStepStatus = "passed" | "failed" | "skipped";

export type SnowflakeVerificationStepId =
  | "configuration"
  | "read_only_guard"
  | "connection_context"
  | "table_access"
  | "table_shape"
  | "supported_query_plan"
  | "provider_smoke_query";

export interface SnowflakeVerificationStep {
  id: SnowflakeVerificationStepId;
  label: string;
  status: SnowflakeVerificationStepStatus;
  summary: string;
  reasons: string[];
  details?: Record<string, unknown>;
}

export interface SnowflakeVerificationReport {
  provider: "snowflake";
  status: "passed" | "failed";
  nonProductionOnly: true;
  checkedAt: string;
  target?: {
    account: string;
    warehouse: string;
    database: string;
    schema: string;
    role: string;
    analyticsTable: string;
  };
  steps: SnowflakeVerificationStep[];
  supportedLiveShapes: string[];
  limitations: string[];
}

const supportedLiveShapes = [
  "table-first single-select and multi-binary analytical queries",
  "summary and metadata-backed banner cuts",
  "dimension filters and multiple metadata-backed question filters",
  "summary-level and metadata-backed breakout wave comparisons across metadata-aligned datasets",
  "explicit authored variable-set rows with non-overlapping known source options"
];

const limitations = [
  "verification is read-only and non-production oriented",
  "verification does not prove production row-level correctness",
  "wave breakout support requires aligned question, breakout, filter, and weight metadata across selected datasets",
  "authored variable-set live support is limited to explicit non-overlapping source-option composition",
  "duplicate filters for the same question remain unsupported",
  "wave significance execution remains deferred"
];

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function enforceSafeIdentifier(value: string, label: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_$]*$/.test(value)) {
    throw new SnowflakeProviderError("snowflake_config_error", `Unsafe Snowflake ${label}: ${value}.`, ["unsafe_identifier"], {
      label,
      value
    });
  }
}

function tableIdentifier(config: SnowflakeConfig) {
  [
    ["database", config.database],
    ["schema", config.schema],
    ["analytics table", config.analyticsTable]
  ].forEach(([label, value]) => enforceSafeIdentifier(value, label));

  return [config.database, config.schema, config.analyticsTable].map(quoteIdentifier).join(".");
}

function sourceIdentifier(sourceColumn: string) {
  return sourceColumn
    .split(".")
    .map((part) => {
      enforceSafeIdentifier(part, "source column");
      return part;
    })
    .join(".");
}

function passedStep(id: SnowflakeVerificationStepId, label: string, summary: string, details?: Record<string, unknown>): SnowflakeVerificationStep {
  return {
    id,
    label,
    status: "passed",
    summary,
    reasons: [],
    details
  };
}

function failedStep(
  id: SnowflakeVerificationStepId,
  label: string,
  summary: string,
  reasons: string[],
  details?: Record<string, unknown>
): SnowflakeVerificationStep {
  return {
    id,
    label,
    status: "failed",
    summary,
    reasons,
    details
  };
}

function skippedStep(id: SnowflakeVerificationStepId, label: string, summary: string, reasons: string[]): SnowflakeVerificationStep {
  return {
    id,
    label,
    status: "skipped",
    summary,
    reasons
  };
}

function providerErrorDetails(error: unknown) {
  if (error instanceof SnowflakeProviderError) {
    return {
      summary: error.message,
      reasons: error.reasons.length > 0 ? error.reasons : [error.code],
      details: {
        code: error.code,
        ...error.details
      }
    };
  }

  return {
    summary: error instanceof Error ? error.message : "Unknown Snowflake verification failure.",
    reasons: ["verification_failed"],
    details: undefined
  };
}

function expectedSnowflakeProviderColumns() {
  const columns = new Set<string>(["survey_wave"]);

  datasets.forEach((dataset) => {
    dataset.dimensions.forEach((dimension) => {
      if (dimension.sourceColumn !== "__summary") columns.add(dimension.sourceColumn);
    });
    dataset.weights.forEach((weight) => columns.add(weight.sourceColumn));
    dataset.questions.forEach((question) => {
      if (question.type !== "multi_binary_set" || !question.sourceVariables?.length) {
        columns.add(question.sourceColumn);
      }
      question.sourceVariables?.forEach((sourceVariable) => columns.add(sourceVariable));
    });
  });

  return Array.from(columns).sort();
}

async function runVerificationQuery(
  executor: SnowflakeQueryExecutor,
  config: SnowflakeConfig,
  sqlText: string
) {
  assertSnowflakeSqlIsReadOnly(sqlText);
  return executor.execute(sqlText, config);
}

function defaultProviderSmokeQuery(): AnalyticsQueryRequest {
  return {
    dataset: "ecofocus_2025",
    question: "Q_PACKAGING_TRUST",
    breakBy: "SUMMARY",
    filters: [],
    weight: "weightvar",
    metric: "column_percent",
    chartType: "vertical_bar",
    confidenceLevel: 0.95,
    comparisonMode: "none",
    comparisonDatasets: []
  };
}

function reportStatus(steps: SnowflakeVerificationStep[]) {
  return steps.some((step) => step.status === "failed") ? "failed" as const : "passed" as const;
}

export async function verifySnowflakeIntegration(
  executor: SnowflakeQueryExecutor = snowflakeSdkQueryExecutor,
  env: Record<string, string | undefined> = process.env
): Promise<SnowflakeVerificationReport> {
  const steps: SnowflakeVerificationStep[] = [];
  const readiness = getSnowflakeReadiness(env);

  if (!readiness.configured || !readiness.config) {
    steps.push(
      failedStep("configuration", "Configuration", "Snowflake configuration is incomplete.", readiness.missingEnvVars, {
        missingEnvVars: readiness.missingEnvVars
      })
    );
    steps.push(skippedStep("read_only_guard", "Read-only guard", "Skipped because configuration failed.", ["missing_configuration"]));
    steps.push(skippedStep("connection_context", "Connection context", "Skipped because configuration failed.", ["missing_configuration"]));
    steps.push(skippedStep("table_access", "Table access", "Skipped because configuration failed.", ["missing_configuration"]));
    steps.push(skippedStep("table_shape", "Table shape", "Skipped because configuration failed.", ["missing_configuration"]));
    steps.push(skippedStep("supported_query_plan", "Supported query plan", "Skipped because configuration failed.", ["missing_configuration"]));
    steps.push(skippedStep("provider_smoke_query", "Provider smoke query", "Skipped because configuration failed.", ["missing_configuration"]));

    return {
      provider: "snowflake",
      status: "failed",
      nonProductionOnly: true,
      checkedAt: new Date().toISOString(),
      steps,
      supportedLiveShapes,
      limitations
    };
  }

  let config: SnowflakeConfig;
  try {
    config = requireSnowflakeConfig(env);
    steps.push(
      passedStep("configuration", "Configuration", "Snowflake configuration is present.", {
        warehouse: config.warehouse,
        database: config.database,
        schema: config.schema,
        role: config.role,
        analyticsTable: config.analyticsTable,
        queryTimeoutMs: config.queryTimeoutMs
      })
    );
  } catch (error) {
    const normalized = providerErrorDetails(error);
    steps.push(failedStep("configuration", "Configuration", normalized.summary, normalized.reasons, normalized.details));
    return {
      provider: "snowflake",
      status: "failed",
      nonProductionOnly: true,
      checkedAt: new Date().toISOString(),
      steps,
      supportedLiveShapes,
      limitations
    };
  }

  const target = {
    account: config.account,
    warehouse: config.warehouse,
    database: config.database,
    schema: config.schema,
    role: config.role,
    analyticsTable: config.analyticsTable
  };

  try {
    assertSnowflakeSqlIsReadOnly("SELECT 1 AS read_only_guard_check");
    steps.push(passedStep("read_only_guard", "Read-only guard", "Read-only SQL guard accepts bounded SELECT checks."));
  } catch (error) {
    const normalized = providerErrorDetails(error);
    steps.push(failedStep("read_only_guard", "Read-only guard", normalized.summary, normalized.reasons, normalized.details));
  }

  try {
    const rows = await runVerificationQuery(
      executor,
      config,
      "SELECT CURRENT_ROLE() AS role_name, CURRENT_WAREHOUSE() AS warehouse_name, CURRENT_DATABASE() AS database_name, CURRENT_SCHEMA() AS schema_name"
    );
    steps.push(
      passedStep("connection_context", "Connection context", "Snowflake connection context query succeeded.", {
        rows: rows.slice(0, 1)
      })
    );
  } catch (error) {
    const normalized = providerErrorDetails(error);
    steps.push(failedStep("connection_context", "Connection context", normalized.summary, normalized.reasons, normalized.details));
  }

  try {
    const rows = await runVerificationQuery(executor, config, `SELECT 1 AS table_accessible FROM ${tableIdentifier(config)} LIMIT 1`);
    steps.push(
      passedStep("table_access", "Table access", "Configured analytics table/view is accessible.", {
        rowsReturned: rows.length
      })
    );
  } catch (error) {
    const normalized = providerErrorDetails(error);
    steps.push(failedStep("table_access", "Table access", normalized.summary, normalized.reasons, normalized.details));
  }

  try {
    const expectedColumns = expectedSnowflakeProviderColumns();
    await runVerificationQuery(
      executor,
      config,
      `SELECT ${expectedColumns.map(sourceIdentifier).join(", ")} FROM ${tableIdentifier(config)} LIMIT 1`
    );
    steps.push(
      passedStep("table_shape", "Table shape", "Configured analytics table/view exposes the metadata-backed provider columns.", {
        expectedColumns
      })
    );
  } catch (error) {
    const normalized = providerErrorDetails(error);
    steps.push(failedStep("table_shape", "Table shape", normalized.summary, normalized.reasons, normalized.details));
  }

  try {
    const smokeQuery = defaultProviderSmokeQuery();
    const sqlPlan = buildSnowflakeSqlPlan(smokeQuery, config);
    steps.push(
      passedStep("supported_query_plan", "Supported query plan", "Default supported analytics query can be planned safely.", {
        summary: sqlPlan.summary
      })
    );
  } catch (error) {
    const normalized = providerErrorDetails(error);
    steps.push(failedStep("supported_query_plan", "Supported query plan", normalized.summary, normalized.reasons, normalized.details));
  }

  try {
    const provider = createSnowflakeAnalyticsProvider(executor, env);
    const response = await provider.runQuery(defaultProviderSmokeQuery());
    steps.push(
      passedStep("provider_smoke_query", "Provider smoke query", "Default supported analytics query executed and normalized.", {
        rows: response.table.length,
        columns: response.columns.length,
        warnings: response.warnings
      })
    );
  } catch (error) {
    const normalized = providerErrorDetails(error);
    steps.push(failedStep("provider_smoke_query", "Provider smoke query", normalized.summary, normalized.reasons, normalized.details));
  }

  return {
    provider: "snowflake",
    status: reportStatus(steps),
    nonProductionOnly: true,
    checkedAt: new Date().toISOString(),
    target,
    steps,
    supportedLiveShapes,
    limitations
  };
}
