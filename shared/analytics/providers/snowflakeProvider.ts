import snowflake from "snowflake-sdk";
import type { AnalyticsProvider } from "./types";
import { getSnowflakeReadiness, requireSnowflakeConfig, type SnowflakeConfig } from "./snowflakeConfig";
import { buildSignificanceExecutionPlan, buildSignificanceReadiness, createAnalyticsQueryPlan } from "../queryPlan";
import { runColumnComparisonSignificanceAdapter, runWaveComparisonSignificanceAdapter } from "../significanceExecution";
import {
  getDatasetMetadata,
  getDimensionMetadata,
  getMetricMetadata,
  getQuestionMetadata,
  getWeightMetadata
} from "../../metadata/ecofocus2025";
import type {
  AnalyticsAnnotation,
  AnalyticsAuthoredVariableSetRow,
  AnalyticsColumnComparisonExecutionInput,
  AnalyticsQueryRequest,
  AnalyticsQueryResponse,
  AnalyticsSeries,
  AnalyticsSignificanceExecutionReport,
  AnalyticsSignificanceReadiness,
  AnalyticsSignificanceResult,
  AnalyticsTableColumn,
  AnalyticsTableRow,
  AnalyticsWaveComparisonExecutionInput,
  ConfidenceLevel,
  DatasetId,
  DimensionId
} from "../../types/analytics";

export interface SnowflakeResultRow {
  [key: string]: unknown;
}

export interface SnowflakeSqlPlan {
  sqlText: string;
  supported: true;
  summary: string;
}

export interface SnowflakeQuerySupport {
  supported: boolean;
  summary: string;
  reasons: string[];
}

export type SnowflakeProviderErrorCode =
  | "snowflake_config_error"
  | "snowflake_unsupported_query"
  | "snowflake_unsafe_sql"
  | "snowflake_execution_timeout"
  | "snowflake_execution_failed"
  | "snowflake_normalization_failed";

export class SnowflakeProviderError extends Error {
  code: SnowflakeProviderErrorCode;
  reasons: string[];
  details?: Record<string, unknown>;

  constructor(code: SnowflakeProviderErrorCode, message: string, reasons: string[] = [], details?: Record<string, unknown>) {
    super(message);
    this.name = "SnowflakeProviderError";
    this.code = code;
    this.reasons = reasons;
    this.details = details;
  }
}

export interface SnowflakeQueryExecutor {
  execute(sqlText: string, config: SnowflakeConfig): Promise<SnowflakeResultRow[]>;
}

const liveSnowflakeSignificanceCapabilities = {
  columnComparison: true,
  waveComparison: true,
  statisticalEngine: true
};

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function sqlString(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

function sourceIdentifier(sourceColumn: string) {
  if (sourceColumn === "__summary") return "'summary'";
  return sourceColumn
    .split(".")
    .map((part) => {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(part)) {
        throw new SnowflakeProviderError("snowflake_config_error", `Unsupported Snowflake source column: ${sourceColumn}.`, [
          "unsafe_identifier"
        ]);
      }
      return part;
    })
    .join(".");
}

function tableIdentifier(config: SnowflakeConfig) {
  return [config.database, config.schema, config.analyticsTable].map(quoteIdentifier).join(".");
}

function enforceSafeSnowflakeIdentifier(value: string, label: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_$]*$/.test(value)) {
    throw new SnowflakeProviderError("snowflake_config_error", `Unsafe Snowflake ${label}: ${value}.`, ["unsafe_identifier"], {
      label,
      value
    });
  }
}

function validateSnowflakeConfigSafety(config: SnowflakeConfig) {
  [
    ["database", config.database],
    ["schema", config.schema],
    ["analytics table", config.analyticsTable],
    ["warehouse", config.warehouse],
    ["role", config.role]
  ].forEach(([label, value]) => enforceSafeSnowflakeIdentifier(value, label));
}

function normalizedQuery(query: AnalyticsQueryRequest): AnalyticsQueryRequest {
  return {
    ...query,
    confidenceLevel: query.confidenceLevel ?? 0.95,
    comparisonMode: query.comparisonMode ?? "none",
    comparisonDatasets: query.comparisonDatasets ?? []
  };
}

function waveDatasetIds(query: AnalyticsQueryRequest) {
  return [query.dataset, ...(query.comparisonDatasets ?? [])];
}

function arraysEqual(left: string[] = [], right: string[] = []) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function questionMetadataAligned(query: AnalyticsQueryRequest, datasetId: DatasetId) {
  const primaryQuestion = getQuestionMetadata(query.dataset, query.question);
  const comparisonQuestion = getQuestionMetadata(datasetId, query.question);

  if (!primaryQuestion || !comparisonQuestion) return false;

  return (
    primaryQuestion.type === comparisonQuestion.type
    && primaryQuestion.sourceColumn === comparisonQuestion.sourceColumn
    && arraysEqual(primaryQuestion.sourceVariables, comparisonQuestion.sourceVariables)
    && arraysEqual(
      primaryQuestion.options.map((option) => option.id),
      comparisonQuestion.options.map((option) => option.id)
    )
  );
}

function filterMetadataAligned(query: AnalyticsQueryRequest, datasetId: DatasetId) {
  return query.filters.every((filter) => {
    const primaryDimension = getDimensionMetadata(query.dataset, filter.field as DimensionId);
    const comparisonDimension = getDimensionMetadata(datasetId, filter.field as DimensionId);

    if (primaryDimension || comparisonDimension) {
      return Boolean(
        primaryDimension
        && comparisonDimension
        && primaryDimension.sourceColumn === comparisonDimension.sourceColumn
        && arraysEqual(
          primaryDimension.values.map((value) => value.id),
          comparisonDimension.values.map((value) => value.id)
        )
      );
    }

    const primaryQuestion = getQuestionMetadata(query.dataset, filter.field as AnalyticsQueryRequest["question"]);
    const comparisonQuestion = getQuestionMetadata(datasetId, filter.field as AnalyticsQueryRequest["question"]);

    if (!primaryQuestion || !comparisonQuestion) return false;

    return (
      primaryQuestion.type === comparisonQuestion.type
      && primaryQuestion.sourceColumn === comparisonQuestion.sourceColumn
      && arraysEqual(primaryQuestion.sourceVariables, comparisonQuestion.sourceVariables)
      && arraysEqual(
        primaryQuestion.options.map((option) => option.id),
        comparisonQuestion.options.map((option) => option.id)
      )
    );
  });
}

function breakoutMetadataAligned(query: AnalyticsQueryRequest, datasetId: DatasetId) {
  if (query.breakBy === "SUMMARY") return true;

  const primaryDimension = getDimensionMetadata(query.dataset, query.breakBy);
  const comparisonDimension = getDimensionMetadata(datasetId, query.breakBy);

  return Boolean(
    primaryDimension
    && comparisonDimension
    && primaryDimension.role === "banner"
    && comparisonDimension.role === "banner"
    && primaryDimension.sourceColumn === comparisonDimension.sourceColumn
    && arraysEqual(
      primaryDimension.values.map((value) => value.id),
      comparisonDimension.values.map((value) => value.id)
    )
  );
}

function weightMetadataAligned(query: AnalyticsQueryRequest, datasetId: DatasetId) {
  if (!query.weight) return true;

  const primaryWeight = getWeightMetadata(query.dataset, query.weight);
  const comparisonWeight = getWeightMetadata(datasetId, query.weight);

  return Boolean(primaryWeight && comparisonWeight && primaryWeight.sourceColumn === comparisonWeight.sourceColumn);
}

function visibleAuthoredRows(query: AnalyticsQueryRequest): AnalyticsAuthoredVariableSetRow[] {
  return (query.authoredVariableSet?.rows ?? [])
    .filter((row) => row.visible)
    .slice()
    .sort((a, b) => a.rowOrder - b.rowOrder);
}

function authoredVariableSetSupportReasons(query: AnalyticsQueryRequest) {
  const authored = query.authoredVariableSet;
  if (!authored) return [];

  const question = getQuestionMetadata(query.dataset, query.question);
  const allowedOptionIds = new Set(question?.options.map((option) => option.id) ?? []);
  const visibleRows = visibleAuthoredRows(query);
  const reasons: string[] = [];
  const visibleUsage = new Map<string, string[]>();

  if (authored.rowMode !== "authored") {
    reasons.push("authored_variable_set_mode_not_live");
  }

  if (visibleRows.length === 0) {
    reasons.push("authored_variable_set_visible_rows_missing");
  }

  authored.rows.forEach((row) => {
    if (!["option", "net", "topbox", "bottombox"].includes(row.kind)) {
      reasons.push("authored_variable_set_row_kind_not_live");
    }

    if (row.sourceOptionIds.length === 0) {
      reasons.push("authored_variable_set_empty_row_not_live");
    }

    if (row.sourceOptionIds.some((optionId) => !allowedOptionIds.has(optionId))) {
      reasons.push("authored_variable_set_source_option_not_live");
    }

    if (row.visible) {
      row.sourceOptionIds.forEach((optionId) => {
        visibleUsage.set(optionId, [...(visibleUsage.get(optionId) ?? []), row.label]);
      });
    }
  });

  if (Array.from(visibleUsage.values()).some((rowLabels) => rowLabels.length > 1)) {
    reasons.push("authored_variable_set_overlap_not_live");
  }

  return Array.from(new Set(reasons));
}

function duplicateQuestionFilterFields(query: AnalyticsQueryRequest) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  query.filters.forEach((filter) => {
    if (!getQuestionMetadata(query.dataset, filter.field as AnalyticsQueryRequest["question"])) return;
    if (seen.has(filter.field)) duplicates.add(filter.field);
    seen.add(filter.field);
  });

  return Array.from(duplicates);
}

export function getSnowflakeQuerySupport(query: AnalyticsQueryRequest): SnowflakeQuerySupport {
  const dataset = getDatasetMetadata(query.dataset);
  const question = getQuestionMetadata(query.dataset, query.question);
  const metric = getMetricMetadata(query.dataset, query.metric);
  const dimension = getDimensionMetadata(query.dataset, query.breakBy);
  const comparisonMode = query.comparisonMode ?? "none";
  const comparisonDatasets = query.comparisonDatasets ?? [];
  const allWaveDatasets = waveDatasetIds(query);
  const questionFilters = query.filters.filter((filter) => getQuestionMetadata(query.dataset, filter.field as AnalyticsQueryRequest["question"]));
  const reasons: string[] = [];

  if (!dataset || !question || !metric || !dimension || dimension.role !== "banner") {
    reasons.push("metadata_not_supported");
  }

  if (query.weight && !getWeightMetadata(query.dataset, query.weight)) {
    reasons.push("weight_not_live");
  }

  if (comparisonMode === "wave") {
    if (comparisonDatasets.length === 0) {
      reasons.push("wave_comparison_dataset_missing");
    }

    if (new Set(allWaveDatasets).size !== allWaveDatasets.length) {
      reasons.push("duplicate_wave_dataset_not_live");
    }

    if (allWaveDatasets.some((datasetId) => !getDatasetMetadata(datasetId) || !getQuestionMetadata(datasetId, query.question))) {
      reasons.push("wave_question_mapping_not_live");
    }

    if (allWaveDatasets.some((datasetId) => !questionMetadataAligned(query, datasetId))) {
      reasons.push("wave_metadata_alignment_not_live");
    }

    if (allWaveDatasets.some((datasetId) => !breakoutMetadataAligned(query, datasetId))) {
      reasons.push("wave_breakout_alignment_not_live");
    }

    if (allWaveDatasets.some((datasetId) => !filterMetadataAligned(query, datasetId))) {
      reasons.push("wave_filter_mapping_not_live");
    }

    if (query.weight && allWaveDatasets.some((datasetId) => !weightMetadataAligned(query, datasetId))) {
      reasons.push("wave_weight_mapping_not_live");
    }
  }

  if (
    query.filters.some(
      (filter) =>
        !getDimensionMetadata(query.dataset, filter.field as DimensionId)
        && !getQuestionMetadata(query.dataset, filter.field as AnalyticsQueryRequest["question"])
    )
  ) {
    reasons.push("filter_field_not_live");
  }

  if (duplicateQuestionFilterFields(query).length > 0) {
    reasons.push("duplicate_question_filter_not_live");
  }

  if (
    questionFilters.some((filter) => {
      const filterQuestion = getQuestionMetadata(query.dataset, filter.field as AnalyticsQueryRequest["question"]);
      return filterQuestion?.type !== "single_select" && filterQuestion?.type !== "multi_binary_set";
    })
  ) {
    reasons.push("question_filter_type_not_live");
  }

  if (query.metric !== "column_percent" && query.metric !== "percent_selected" && query.metric !== "count") {
    reasons.push("metric_not_live");
  }

  if (question?.type !== "single_select" && question?.type !== "multi_binary_set") {
    reasons.push("question_type_not_live");
  }

  reasons.push(...authoredVariableSetSupportReasons(query));

  return {
    supported: reasons.length === 0,
    summary:
      reasons.length === 0
        ? "Snowflake live execution supports this table-first query shape."
        : `Snowflake live execution does not yet support this query shape: ${reasons.join(", ")}.`,
    reasons
  };
}

export function assertSnowflakeSqlIsReadOnly(sqlText: string) {
  const normalized = sqlText.trim();
  const unsafePattern = /\b(insert|update|delete|merge|drop|alter|create|truncate|copy|put|get|call|grant|revoke|use|begin|commit|rollback)\b/i;

  if (!normalized.toLowerCase().startsWith("select")) {
    throw new SnowflakeProviderError("snowflake_unsafe_sql", "Snowflake provider refused to execute non-SELECT SQL.", ["non_select_sql"]);
  }

  if (normalized.includes(";")) {
    throw new SnowflakeProviderError("snowflake_unsafe_sql", "Snowflake provider refused to execute SQL containing statement separators.", [
      "statement_separator"
    ]);
  }

  if (normalized.includes("--") || normalized.includes("/*") || normalized.includes("*/")) {
    throw new SnowflakeProviderError("snowflake_unsafe_sql", "Snowflake provider refused to execute SQL containing comments.", ["sql_comment"]);
  }

  if (unsafePattern.test(normalized)) {
    throw new SnowflakeProviderError("snowflake_unsafe_sql", "Snowflake provider refused to execute SQL containing unsupported operation keywords.", [
      "unsafe_keyword"
    ]);
  }
}

function columnIdExpression(query: AnalyticsQueryRequest) {
  const dimension = getDimensionMetadata(query.dataset, query.breakBy);
  if (!dimension || query.breakBy === "SUMMARY") return sqlString("summary");
  return `LOWER(TO_VARCHAR(${sourceIdentifier(dimension.sourceColumn)}))`;
}

function columnLabelExpression(query: AnalyticsQueryRequest) {
  const dimension = getDimensionMetadata(query.dataset, query.breakBy);
  if (!dimension || query.breakBy === "SUMMARY") return sqlString("Summary");
  const source = `LOWER(TO_VARCHAR(${sourceIdentifier(dimension.sourceColumn)}))`;
  const cases = dimension.values.map((value) => `WHEN ${sqlString(value.id)} THEN ${sqlString(value.label)}`).join(" ");
  return `CASE ${source} ${cases} ELSE TO_VARCHAR(${sourceIdentifier(dimension.sourceColumn)}) END`;
}

function columnSortExpression(query: AnalyticsQueryRequest) {
  const dimension = getDimensionMetadata(query.dataset, query.breakBy);
  if (!dimension || query.breakBy === "SUMMARY") return "1";
  const source = `LOWER(TO_VARCHAR(${sourceIdentifier(dimension.sourceColumn)}))`;
  const cases = dimension.values.map((value) => `WHEN ${sqlString(value.id)} THEN ${value.sortOrder}`).join(" ");
  return `CASE ${source} ${cases} ELSE 999 END`;
}

function waveBreakoutColumnId(datasetId: DatasetId, valueId: string) {
  return `${datasetId}__${valueId}`;
}

function waveBreakoutColumnLabel(datasetId: DatasetId, valueLabel: string) {
  const dataset = getDatasetMetadata(datasetId);
  return `${dataset?.wave ?? datasetId} - ${valueLabel}`;
}

function waveColumnIdExpression(query: AnalyticsQueryRequest, datasetId: DatasetId) {
  const dimension = getDimensionMetadata(datasetId, query.breakBy);
  if (!dimension || query.breakBy === "SUMMARY") return sqlString(datasetId);

  return `CONCAT(${sqlString(`${datasetId}__`)}, LOWER(TO_VARCHAR(${sourceIdentifier(dimension.sourceColumn)})))`;
}

function waveColumnLabelExpression(query: AnalyticsQueryRequest, datasetId: DatasetId) {
  const dimension = getDimensionMetadata(datasetId, query.breakBy);
  const dataset = getDatasetMetadata(datasetId);
  if (!dimension || query.breakBy === "SUMMARY") return sqlString(dataset?.wave ?? datasetId);

  const source = `LOWER(TO_VARCHAR(${sourceIdentifier(dimension.sourceColumn)}))`;
  const cases = dimension.values.map((value) => `WHEN ${sqlString(value.id)} THEN ${sqlString(value.label)}`).join(" ");
  const valueLabel = `CASE ${source} ${cases} ELSE TO_VARCHAR(${sourceIdentifier(dimension.sourceColumn)}) END`;
  return `CONCAT(${sqlString(`${dataset?.wave ?? datasetId} - `)}, ${valueLabel})`;
}

function waveColumnSortExpression(query: AnalyticsQueryRequest, datasetId: DatasetId, datasetIndex: number) {
  const dimension = getDimensionMetadata(datasetId, query.breakBy);
  if (!dimension || query.breakBy === "SUMMARY") return `${datasetIndex + 1}`;

  const source = `LOWER(TO_VARCHAR(${sourceIdentifier(dimension.sourceColumn)}))`;
  const cases = dimension.values.map((value) => `WHEN ${sqlString(value.id)} THEN ${value.sortOrder}`).join(" ");
  return `${datasetIndex * 1000} + (CASE ${source} ${cases} ELSE 999 END)`;
}

function expectedColumnsForQuery(query: AnalyticsQueryRequest): AnalyticsTableColumn[] {
  const dimension = getDimensionMetadata(query.dataset, query.breakBy);

  if ((query.comparisonMode ?? "none") === "wave") {
    return waveDatasetIds(query).flatMap((datasetId) => {
      if (query.breakBy === "SUMMARY" || !dimension) {
        return [{
          id: datasetId,
          label: getDatasetMetadata(datasetId)?.wave ?? datasetId
        }];
      }

      return dimension.values.map((value) => ({
        id: waveBreakoutColumnId(datasetId, value.id),
        label: waveBreakoutColumnLabel(datasetId, value.label)
      }));
    });
  }

  return dimension?.values.map((value) => ({ id: value.id, label: value.label })) ?? [];
}

function expectedRowsForQuery(query: AnalyticsQueryRequest, question: NonNullable<ReturnType<typeof getQuestionMetadata>>) {
  const authoredRows = visibleAuthoredRows(query);

  if (authoredRows.length > 0) {
    return authoredRows.map((row) => ({
      optionId: row.id,
      label: row.label,
      rowKind: row.kind,
      emphasis: row.emphasis
    }));
  }

  return question.options.map((option) => ({
    optionId: option.id,
    label: option.label,
    rowKind: "option" as const,
    emphasis: "detail" as const
  }));
}

function datasetWhereClause(query: AnalyticsQueryRequest, datasetId: DatasetId = query.dataset) {
  const dataset = getDatasetMetadata(datasetId);
  return `LOWER(TO_VARCHAR(${sourceIdentifier("survey_wave")})) = ${sqlString(dataset?.wave.toLowerCase() ?? datasetId)}`;
}

function questionFilterWhereClause(query: AnalyticsQueryRequest, filter: AnalyticsQueryRequest["filters"][number]) {
  const filterQuestion = getQuestionMetadata(query.dataset, filter.field as AnalyticsQueryRequest["question"]);

  if (!filterQuestion) return null;

  if (filterQuestion.type === "multi_binary_set") {
    const allowedVariables = new Set(filterQuestion.sourceVariables ?? []);
    const selectedVariables = filter.values.filter((value) => allowedVariables.has(value));

    if (selectedVariables.length === 0) return null;

    return `(${selectedVariables.map((value) => truthyMultiBinaryExpression(value)).join(" OR ")})`;
  }

  const values = filter.values.map((value) => sqlString(value.toLowerCase())).join(", ");
  return `LOWER(TO_VARCHAR(${sourceIdentifier(filterQuestion.sourceColumn)})) IN (${values})`;
}

function filtersWhereClause(query: AnalyticsQueryRequest) {
  return query.filters.flatMap((filter) => {
    const dimension = getDimensionMetadata(query.dataset, filter.field as DimensionId);
    if (dimension) {
      const values = filter.values.map((value) => sqlString(value.toLowerCase())).join(", ");
      return [`LOWER(TO_VARCHAR(${sourceIdentifier(dimension.sourceColumn)})) IN (${values})`];
    }

    const questionFilter = questionFilterWhereClause(query, filter);
    return questionFilter ? [questionFilter] : [];
  });
}

function truthyMultiBinaryExpression(sourceColumn: string) {
  const source = sourceIdentifier(sourceColumn);
  return `(TRY_TO_NUMBER(${source}) = 1 OR LOWER(TO_VARCHAR(${source})) IN ('true', 'yes', 'selected'))`;
}

function optionMatchExpression(query: AnalyticsQueryRequest, optionId: string) {
  const question = getQuestionMetadata(query.dataset, query.question);
  if (!question) return "FALSE";

  if (question.type === "multi_binary_set") {
    const variable = question.sourceVariables?.find((sourceVariable) => sourceVariable === optionId) ?? optionId;
    return truthyMultiBinaryExpression(variable);
  }

  return `LOWER(TO_VARCHAR(${sourceIdentifier(question.sourceColumn)})) = ${sqlString(optionId.toLowerCase())}`;
}

function rowDefinitionsForQuery(query: AnalyticsQueryRequest, question: NonNullable<ReturnType<typeof getQuestionMetadata>>) {
  const authoredRows = visibleAuthoredRows(query);

  if (authoredRows.length > 0) {
    return authoredRows.map((row) => ({
      id: row.id,
      label: row.label,
      sourceOptionIds: row.sourceOptionIds,
      sortOrder: row.rowOrder
    }));
  }

  return question.options.map((option) => ({
    id: option.id,
    label: option.label,
    sourceOptionIds: [option.id],
    sortOrder: option.sortOrder
  }));
}

function weightExpression(query: AnalyticsQueryRequest) {
  const weight = getWeightMetadata(query.dataset, query.weight);
  return weight ? `COALESCE(TRY_TO_DOUBLE(${sourceIdentifier(weight.sourceColumn)}), 0)` : "1";
}

function numeratorExpression(query: AnalyticsQueryRequest, sourceOptionIds: string[]) {
  const weight = weightExpression(query);
  return sourceOptionIds.map((optionId) => `SUM(CASE WHEN ${optionMatchExpression(query, optionId)} THEN ${weight} ELSE 0 END)`).join(" + ");
}

function valueExpression(query: AnalyticsQueryRequest, sourceOptionIds: string[]) {
  const numerator = numeratorExpression(query, sourceOptionIds);
  const weight = weightExpression(query);
  const denominator = `NULLIF(SUM(${weight}), 0)`;

  if (query.metric === "count") {
    return `ROUND(${numerator}, 0)`;
  }

  return `LEAST(100, ROUND(100 * (${numerator}) / ${denominator}, 1))`;
}

function baseExpression(query: AnalyticsQueryRequest) {
  return query.weight ? `ROUND(SUM(${weightExpression(query)}), 0)` : "COUNT(*)";
}

function buildSnowflakeStandardSqlPlan(query: AnalyticsQueryRequest, config: SnowflakeConfig, question: NonNullable<ReturnType<typeof getQuestionMetadata>>) {
  const where = [datasetWhereClause(query), ...filtersWhereClause(query)].join(" AND ");
  const columnId = columnIdExpression(query);
  const columnLabel = columnLabelExpression(query);
  const columnSort = columnSortExpression(query);
  const rows = rowDefinitionsForQuery(query, question);

  return rows.map((row) => {
    return [
      "SELECT",
      `${row.sortOrder} AS option_sort,`,
      `${columnSort} AS column_sort,`,
      `${sqlString(row.id)} AS option_id,`,
      `${sqlString(row.label)} AS option_label,`,
      `${columnId} AS column_id,`,
      `${columnLabel} AS column_label,`,
      `${valueExpression(query, row.sourceOptionIds)} AS value,`,
      `${baseExpression(query)} AS base`,
      `FROM ${tableIdentifier(config)}`,
      `WHERE ${where}`,
      "GROUP BY column_id, column_label, column_sort"
    ].join(" ");
  });
}

function buildSnowflakeWaveSqlPlan(query: AnalyticsQueryRequest, config: SnowflakeConfig, question: NonNullable<ReturnType<typeof getQuestionMetadata>>) {
  const rows = rowDefinitionsForQuery(query, question);

  return rows.flatMap((row) =>
    waveDatasetIds(query).map((datasetId, datasetIndex) => {
      const where = [datasetWhereClause(query, datasetId), ...filtersWhereClause(query)].join(" AND ");
      const columnId = waveColumnIdExpression(query, datasetId);
      const columnLabel = waveColumnLabelExpression(query, datasetId);
      const columnSort = waveColumnSortExpression(query, datasetId, datasetIndex);

      return [
        "SELECT",
        `${row.sortOrder} AS option_sort,`,
        `${columnSort} AS column_sort,`,
        `${sqlString(row.id)} AS option_id,`,
        `${sqlString(row.label)} AS option_label,`,
        `${columnId} AS column_id,`,
        `${columnLabel} AS column_label,`,
        `${valueExpression(query, row.sourceOptionIds)} AS value,`,
        `${baseExpression(query)} AS base`,
        `FROM ${tableIdentifier(config)}`,
        `WHERE ${where}`,
        "GROUP BY column_id, column_label, column_sort"
      ].join(" ");
    })
  );
}

export function buildSnowflakeSqlPlan(queryInput: AnalyticsQueryRequest, config: SnowflakeConfig): SnowflakeSqlPlan {
  const query = normalizedQuery(queryInput);
  validateSnowflakeConfigSafety(config);
  const support = getSnowflakeQuerySupport(query);
  const dataset = getDatasetMetadata(query.dataset);
  const question = getQuestionMetadata(query.dataset, query.question);
  const dimension = getDimensionMetadata(query.dataset, query.breakBy);

  if (!support.supported || !dataset || !question || !dimension) {
    throw new SnowflakeProviderError("snowflake_unsupported_query", support.summary, support.reasons, {
      dataset: query.dataset,
      question: query.question,
      breakBy: query.breakBy,
      comparisonMode: query.comparisonMode
    });
  }

  const optionSelects =
    query.comparisonMode === "wave"
      ? buildSnowflakeWaveSqlPlan(query, config, question)
      : buildSnowflakeStandardSqlPlan(query, config, question);

  const sqlText = `${optionSelects.join(" UNION ALL ")} ORDER BY option_sort, column_sort`;
  assertSnowflakeSqlIsReadOnly(sqlText);

  return {
    sqlText,
    supported: true,
    summary:
      query.comparisonMode === "wave"
        ? `Snowflake wave SQL plan for ${dataset.id}/${question.id} across ${waveDatasetIds(query).join(", ")}.`
        : `Snowflake SQL plan for ${dataset.id}/${question.id} by ${dimension.id}.`
  };
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
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function collectBaseWarnings(series: AnalyticsSeries[], minBase: number) {
  const lowBases = series.flatMap((item) => item.bases).filter((base) => base > 0 && base < minBase);

  if (lowBases.length === 0) {
    return [];
  }

  return [`Some cells have a base below ${minBase}; interpret those comparisons cautiously.`];
}

function collectWeightingWarnings(query: AnalyticsQueryRequest, series: AnalyticsSeries[]) {
  const warnings: string[] = [];
  const bases = series.flatMap((item) => item.bases);

  if (query.weight && bases.length > 0 && bases.every((base) => base === 0)) {
    warnings.push("Weighted Snowflake output has zero base across all cells; verify weight availability and filter scope.");
  }

  if (query.weight && query.metric === "count") {
    warnings.push(`Snowflake count metric is normalized as weighted estimated counts because ${query.weight} is applied.`);
  }

  return warnings;
}

function weightingNote(query: AnalyticsQueryRequest, weightLabel: string) {
  if (query.weight && query.metric === "count") {
    return `Count metric uses weighted estimated counts with ${weightLabel}.`;
  }

  if (!query.weight && query.metric === "count") {
    return "Count metric uses unweighted respondent counts.";
  }

  return "";
}

function collectSnowflakeNormalizationWarnings(
  rows: SnowflakeResultRow[],
  expectedOptionIds: string[],
  expectedColumnIds: string[]
) {
  const warnings: string[] = [];
  const expectedOptions = new Set(expectedOptionIds.map((id) => id.toLowerCase()));
  const expectedColumns = new Set(expectedColumnIds.map((id) => id.toLowerCase()));
  const seenCells = new Set<string>();
  const duplicateCells = new Set<string>();
  const unknownOptions = new Set<string>();
  const unknownColumns = new Set<string>();

  if (rows.length === 0) {
    warnings.push("Snowflake returned no rows for this query; the normalized result contains zero-filled expected rows and columns.");
  }

  rows.forEach((row) => {
    const optionId = readString(row, "option_id").toLowerCase();
    const columnId = readString(row, "column_id").toLowerCase();

    if (optionId && !expectedOptions.has(optionId)) unknownOptions.add(optionId);
    if (columnId && !expectedColumns.has(columnId)) unknownColumns.add(columnId);

    if (optionId && columnId) {
      const cellKey = `${optionId}/${columnId}`;
      if (seenCells.has(cellKey)) duplicateCells.add(cellKey);
      seenCells.add(cellKey);
    }
  });

  if (unknownOptions.size > 0) {
    warnings.push(`Snowflake returned unrecognized option ids: ${Array.from(unknownOptions).join(", ")}.`);
  }

  if (unknownColumns.size > 0) {
    warnings.push(`Snowflake returned unrecognized column ids: ${Array.from(unknownColumns).join(", ")}.`);
  }

  if (duplicateCells.size > 0) {
    warnings.push(`Snowflake returned duplicate option/column cells: ${Array.from(duplicateCells).join(", ")}. The first matching cell was used.`);
  }

  return warnings;
}

function columnComparisonExecutionInput(
  query: AnalyticsQueryRequest,
  metric: AnalyticsQueryResponse["metric"],
  columns: AnalyticsQueryResponse["columns"],
  table: AnalyticsQueryResponse["table"]
): AnalyticsColumnComparisonExecutionInput | null {
  if ((query.comparisonMode ?? "none") === "wave" || query.breakBy === "SUMMARY" || columns.length <= 1 || table.length === 0) {
    return null;
  }

  return {
    method: "column_comparison",
    confidenceLevel: query.confidenceLevel,
    metric: {
      id: metric.id,
      valueFormat: metric.valueFormat
    },
    comparisonScope: {
      basis: "breakout",
      rowIds: table.map((row) => row.optionId),
      columnIds: columns.map((column) => column.id)
    },
    columns: columns.map((column) => ({
      id: column.id,
      label: column.label
    })),
    rows: table.map((row) => ({
      id: row.optionId,
      label: row.label,
      cells: columns.map((column) => ({
        columnId: column.id,
        value: row.values[column.id] ?? 0,
        base: row.bases[column.id] ?? 0
      }))
    }))
  };
}

function waveComparisonExecutionInput(
  query: AnalyticsQueryRequest,
  metric: AnalyticsQueryResponse["metric"],
  columns: AnalyticsQueryResponse["columns"],
  table: AnalyticsQueryResponse["table"]
): AnalyticsWaveComparisonExecutionInput | null {
  const comparisonDatasets = query.comparisonDatasets ?? [];
  if (
    (query.comparisonMode ?? "none") !== "wave"
    || comparisonDatasets.length === 0
    || columns.length <= 1
    || table.length === 0
  ) {
    return null;
  }

  const datasetIds = waveDatasetIds(query);

  if (query.breakBy !== "SUMMARY") {
    const dimension = getDimensionMetadata(query.dataset, query.breakBy);
    const breakoutColumns = dimension?.values.map((value) => ({
      id: value.id,
      label: value.label
    })) ?? [];
    const expectedColumnIds = new Set(datasetIds.flatMap((datasetId) => breakoutColumns.map((column) => waveBreakoutColumnId(datasetId, column.id))));

    if (breakoutColumns.length === 0 || columns.some((column) => !expectedColumnIds.has(column.id))) {
      return null;
    }

    return {
      method: "wave_comparison",
      confidenceLevel: query.confidenceLevel,
      metric: {
        id: metric.id,
        valueFormat: metric.valueFormat
      },
      comparisonScope: {
        basis: "wave",
        rowIds: table.map((row) => row.optionId),
        waveIds: datasetIds,
        primaryDatasetId: query.dataset,
        comparisonDatasetIds: comparisonDatasets,
        pairingStrategy: "primary_vs_comparison",
        breakoutColumnIds: breakoutColumns.map((column) => column.id)
      },
      breakoutColumns,
      waves: datasetIds.map((datasetId) => ({
        id: datasetId,
        label: getDatasetMetadata(datasetId)?.wave ?? datasetId
      })),
      rows: table.map((row) => ({
        id: row.optionId,
        label: row.label,
        cells: datasetIds.flatMap((datasetId) =>
          breakoutColumns.map((breakoutColumn) => {
            const columnId = waveBreakoutColumnId(datasetId, breakoutColumn.id);
            return {
              waveId: datasetId,
              breakoutColumnId: breakoutColumn.id,
              value: row.values[columnId] ?? 0,
              base: row.bases[columnId] ?? 0
            };
          })
        )
      }))
    };
  }

  const waveIds = columns.map((column) => column.id as DatasetId);

  return {
    method: "wave_comparison",
    confidenceLevel: query.confidenceLevel,
    metric: {
      id: metric.id,
      valueFormat: metric.valueFormat
    },
    comparisonScope: {
      basis: "wave",
      rowIds: table.map((row) => row.optionId),
      waveIds,
      primaryDatasetId: query.dataset,
      comparisonDatasetIds: comparisonDatasets,
      pairingStrategy: waveIds.length > 2 ? "adjacent_wave" : "primary_vs_comparison"
    },
    waves: columns.map((column) => ({
      id: column.id as DatasetId,
      label: column.label
    })),
    rows: table.map((row) => ({
      id: row.optionId,
      label: row.label,
      cells: columns.map((column) => ({
        waveId: column.id as DatasetId,
        value: row.values[column.id] ?? 0,
        base: row.bases[column.id] ?? 0
      }))
    }))
  };
}

function placeholderSignificance(annotations: AnalyticsAnnotation[], readiness: AnalyticsSignificanceReadiness): AnalyticsSignificanceResult {
  return {
    status: "placeholder",
    method: "mock_placeholder",
    readiness,
    reasonCodes: ["mock_provider_placeholder"],
    comparisonBasis: readiness.comparisonBasis,
    hasPlaceholders: true,
    details: annotations.map((annotation) => ({
      rowId: annotation.rowId,
      columnId: annotation.columnId,
      direction: annotation.direction,
      confidence: annotation.confidence as ConfidenceLevel,
      status: "placeholder",
      reasonCodes: ["mock_provider_placeholder"]
    }))
  };
}

function eligibleSignificance(readiness: AnalyticsSignificanceReadiness): AnalyticsSignificanceResult {
  return {
    status: "eligible",
    method: readiness.method,
    readiness,
    reasonCodes: readiness.reasonCodes,
    comparisonBasis: readiness.comparisonBasis,
    hasPlaceholders: false,
    details: []
  };
}

function inactiveSignificance(readiness: AnalyticsSignificanceReadiness): AnalyticsSignificanceResult {
  return {
    status: readiness.status === "unsupported" ? "unsupported" : "none",
    method: "none",
    readiness,
    reasonCodes: readiness.reasonCodes,
    comparisonBasis: readiness.comparisonBasis,
    hasPlaceholders: false,
    details: []
  };
}

function significanceFromReadiness(readiness: AnalyticsSignificanceReadiness, annotations: AnalyticsAnnotation[]): AnalyticsSignificanceResult {
  if (annotations.length > 0) {
    return placeholderSignificance(annotations, readiness);
  }

  if (readiness.status === "candidate") {
    return eligibleSignificance(readiness);
  }

  return inactiveSignificance(readiness);
}

function significanceFromExecutionReport(
  readiness: AnalyticsSignificanceReadiness,
  annotations: AnalyticsAnnotation[],
  report: AnalyticsSignificanceExecutionReport | null
): AnalyticsSignificanceResult {
  if (report?.status !== "executed" || !report.result) {
    return significanceFromReadiness(readiness, annotations);
  }

  const testedDetails =
    report.method === "column_comparison"
      ? report.result.outcomes
          .filter((outcome) => outcome.status === "tested")
          .map((outcome) => ({
            rowId: outcome.rowId,
            columnId: outcome.columnId,
            direction: outcome.statistics.direction ?? undefined,
            confidence: outcome.statistics.confidence ?? 0.95,
            status: "tested" as const,
            reasonCodes: outcome.reasonCodes
          }))
      : report.result.outcomes
          .filter((outcome) => outcome.status === "tested")
          .map((outcome) => ({
            rowId: outcome.rowId,
            columnId: outcome.waveId,
            direction: outcome.statistics.direction ?? undefined,
            confidence: outcome.statistics.confidence ?? 0.95,
            status: "tested" as const,
            reasonCodes: outcome.reasonCodes
          }));

  return {
    status: "tested",
    method: report.method,
    readiness,
    reasonCodes: [],
    comparisonBasis: readiness.comparisonBasis,
    hasPlaceholders: false,
    details: testedDetails
  };
}

function waveComparisonNote(query: AnalyticsQueryRequest, columns: AnalyticsTableColumn[]) {
  if ((query.comparisonMode ?? "none") !== "wave") return "";

  if (query.breakBy === "SUMMARY") {
    return `${columns.map((column) => column.label).join(" vs ")} live wave comparison.`;
  }

  const dimension = getDimensionMetadata(query.dataset, query.breakBy);
  const waveLabels = waveDatasetIds(query)
    .map((datasetId) => getDatasetMetadata(datasetId)?.wave ?? datasetId)
    .join(" vs ");

  return `${waveLabels} by ${dimension?.label ?? query.breakBy} live wave comparison.`;
}

export function normalizeSnowflakeRows(queryInput: AnalyticsQueryRequest, rows: SnowflakeResultRow[]): AnalyticsQueryResponse {
  const query = normalizedQuery(queryInput);
  const dataset = getDatasetMetadata(query.dataset);
  const question = getQuestionMetadata(query.dataset, query.question);
  const dimension = getDimensionMetadata(query.dataset, query.breakBy);
  const metric = getMetricMetadata(query.dataset, query.metric);
  const weight = getWeightMetadata(query.dataset, query.weight);

  if (!dataset || !question || !dimension || !metric) {
    throw new SnowflakeProviderError("snowflake_normalization_failed", "Cannot normalize Snowflake response for unsupported metadata.", [
      "metadata_not_supported"
    ]);
  }

  const columns = expectedColumnsForQuery(query);
  const labels = columns.map((column) => column.label);
  const expectedRows = expectedRowsForQuery(query, question);
  const normalizationWarnings = collectSnowflakeNormalizationWarnings(
    rows,
    expectedRows.map((row) => row.optionId),
    columns.map((column) => column.id)
  );
  const rowLookup = new Map<string, SnowflakeResultRow[]>();

  rows.forEach((row) => {
    const optionId = readString(row, "option_id");
    if (!optionId) return;
    rowLookup.set(optionId, [...(rowLookup.get(optionId) ?? []), row]);
  });

  const series: AnalyticsSeries[] = expectedRows.map((expectedRow) => {
    const optionRows = rowLookup.get(expectedRow.optionId) ?? [];
    const values = columns.map((column) => {
      const row = optionRows.find((item) => readString(item, "column_id").toLowerCase() === column.id.toLowerCase());
      return row ? readNumber(row, "value") : 0;
    });
    const bases = columns.map((column) => {
      const row = optionRows.find((item) => readString(item, "column_id").toLowerCase() === column.id.toLowerCase());
      return row ? readNumber(row, "base") : 0;
    });

    return {
      id: expectedRow.optionId,
      label: expectedRow.label,
      values,
      bases
    };
  });

  const table: AnalyticsTableRow[] = series.map((item, rowIndex) => ({
    optionId: item.id,
    label: item.label,
    values: Object.fromEntries(columns.map((column, index) => [column.id, item.values[index]])),
    bases: Object.fromEntries(columns.map((column, index) => [column.id, item.bases[index]])),
    presentation: {
      rowKind: expectedRows[rowIndex]?.rowKind ?? "option",
      emphasis: expectedRows[rowIndex]?.emphasis ?? "detail"
    }
  }));
  const significanceReadiness = buildSignificanceReadiness(query);
  const significanceExecutionPlan = buildSignificanceExecutionPlan(significanceReadiness, liveSnowflakeSignificanceCapabilities);
  const significanceExecutionInput =
    significanceExecutionPlan.executionInputContract === "column_comparison"
      ? columnComparisonExecutionInput(query, metric, columns, table)
      : waveComparisonExecutionInput(query, metric, columns, table);
  const significanceExecutionReport =
    significanceExecutionInput?.method === "column_comparison"
      ? runColumnComparisonSignificanceAdapter(significanceExecutionInput, significanceExecutionPlan)
      : significanceExecutionInput?.method === "wave_comparison"
        ? runWaveComparisonSignificanceAdapter(significanceExecutionInput, significanceExecutionPlan)
        : null;
  const significance = significanceFromExecutionReport(significanceReadiness, [], significanceExecutionReport);

  return {
    query,
    labels,
    series,
    columns,
    table,
    metric,
    weighting: {
      applied: Boolean(query.weight),
      id: query.weight,
      label: weight?.label ?? "Unweighted"
    },
    annotations: [],
    statistics: {
      confidenceLevel: query.confidenceLevel,
      significanceMethod: significance.method,
      significanceExecutionPlan,
      significanceExecutionInput,
      significanceExecutionReport,
      significance
    },
    warnings: [
      ...normalizationWarnings,
      ...collectBaseWarnings(series, dataset.minBaseWarning),
      ...collectWeightingWarnings(query, series)
    ],
    notes: [
      "Live Snowflake analytics output.",
      query.authoredVariableSet ? `Authored variable set rows executed by Snowflake from ${query.authoredVariableSet.label}.` : "",
      waveComparisonNote(query, columns),
      query.weight ? `Weighted data using ${weight?.label ?? query.weight}.` : "Unweighted Snowflake output.",
      weightingNote(query, weight?.label ?? query.weight ?? "Unweighted"),
      query.filters.length > 0 ? "Filters were applied by the Snowflake provider." : "No filters applied.",
      `${Math.round(query.confidenceLevel * 100)}% confidence level for significance context.`
    ].filter(Boolean),
    metadataRefs: {
      dataset: query.dataset,
      question: query.question,
      breakBy: query.breakBy,
      comparisonMode: query.comparisonMode,
      comparisonDatasets: query.comparisonDatasets,
      authoredVariableSet: query.authoredVariableSet
        ? {
            id: query.authoredVariableSet.id,
            label: query.authoredVariableSet.label,
            applied: true
          }
        : undefined
    }
  };
}

async function withSnowflakeTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(
        new SnowflakeProviderError(
          "snowflake_execution_timeout",
          `Snowflake query execution exceeded ${timeoutMs}ms.`,
          ["execution_timeout"],
          { timeoutMs }
        )
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

function normalizeProviderExecutionError(error: unknown) {
  if (error instanceof SnowflakeProviderError) {
    return error;
  }

  return new SnowflakeProviderError(
    "snowflake_execution_failed",
    error instanceof Error ? `Snowflake query execution failed: ${error.message}` : "Snowflake query execution failed.",
    ["execution_failed"]
  );
}

export const snowflakeSdkQueryExecutor: SnowflakeQueryExecutor = {
  async execute(sqlText, config) {
    assertSnowflakeSqlIsReadOnly(sqlText);
    const connection = snowflake.createConnection({
      account: config.account,
      username: config.username,
      password: config.password,
      warehouse: config.warehouse,
      database: config.database,
      schema: config.schema,
      role: config.role,
      authenticator: config.authenticator,
      timeout: config.queryTimeoutMs
    });

    await withSnowflakeTimeout(
      new Promise<void>((resolve, reject) => {
        connection.connect((error) => {
          if (error) reject(error);
          else resolve();
        });
      }),
      config.queryTimeoutMs
    );

    try {
      return await withSnowflakeTimeout(
        new Promise<SnowflakeResultRow[]>((resolve, reject) => {
          connection.execute({
            sqlText,
            complete(error, _statement, resultRows) {
              if (error) reject(error);
              else resolve((resultRows ?? []) as SnowflakeResultRow[]);
            }
          });
        }),
        config.queryTimeoutMs
      );
    } catch (error) {
      throw normalizeProviderExecutionError(error);
    } finally {
      await new Promise<void>((resolve) => {
        connection.destroy(() => resolve());
      });
    }
  }
};

async function executeSnowflakePlan(executor: SnowflakeQueryExecutor, sqlText: string, config: SnowflakeConfig) {
  assertSnowflakeSqlIsReadOnly(sqlText);

  try {
    return await withSnowflakeTimeout(executor.execute(sqlText, config), config.queryTimeoutMs);
  } catch (error) {
    throw normalizeProviderExecutionError(error);
  }
}

export function createSnowflakeAnalyticsProvider(
  executor: SnowflakeQueryExecutor = snowflakeSdkQueryExecutor,
  env: Record<string, string | undefined> = process.env
): AnalyticsProvider {
  return {
    id: "snowflake",
    label: "Snowflake provider",
    getReadiness() {
      const readiness = getSnowflakeReadiness(env);
      return readiness.configured
        ? {
            configured: true,
            summary: `Snowflake provider is configured for live execution against ${readiness.config?.database}.${readiness.config?.schema}.${readiness.config?.analyticsTable}.`
          }
        : {
            configured: false,
            summary: "Snowflake provider is not configured.",
            missingEnvVars: readiness.missingEnvVars
          };
    },
    async runQuery(queryInput) {
      let config: SnowflakeConfig;
      try {
        config = requireSnowflakeConfig(env);
      } catch (error) {
        throw new SnowflakeProviderError(
          "snowflake_config_error",
          error instanceof Error ? error.message : "Snowflake provider is not configured.",
          ["missing_configuration"]
        );
      }
      const query = normalizedQuery(queryInput);
      const support = getSnowflakeQuerySupport(query);

      if (!support.supported) {
        throw new SnowflakeProviderError("snowflake_unsupported_query", support.summary, support.reasons, {
          dataset: query.dataset,
          question: query.question,
          breakBy: query.breakBy,
          comparisonMode: query.comparisonMode
        });
      }

      createAnalyticsQueryPlan(query);
      const sqlPlan = buildSnowflakeSqlPlan(query, config);
      const rows = await executeSnowflakePlan(executor, sqlPlan.sqlText, config);

      try {
        return normalizeSnowflakeRows(query, rows);
      } catch (error) {
        if (error instanceof SnowflakeProviderError) throw error;
        throw new SnowflakeProviderError(
          "snowflake_normalization_failed",
          error instanceof Error ? `Snowflake response normalization failed: ${error.message}` : "Snowflake response normalization failed.",
          ["normalization_failed"]
        );
      }
    }
  };
}

export const snowflakeAnalyticsProvider = createSnowflakeAnalyticsProvider();
