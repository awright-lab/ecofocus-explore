import { validSourceCategoryKey } from "./sourceCategoryIdentity";
import type { AnalyticsAuthoredVariableSet, AnalyticsQueryResponse, AnalyticsTableRow } from "../types/analytics";
import type { SavedVariableSet } from "../types/dashboard";
import { getQuestionMetadata } from "../metadata/ecofocus2025";
import { withSafeInference } from "./inferenceSafety";

type VariableSetRowSource = Pick<SavedVariableSet, "id" | "label" | "rows"> | AnalyticsAuthoredVariableSet;

function aggregateRowValues(
  response: AnalyticsQueryResponse,
  sourceRows: AnalyticsTableRow[]
) {
  const values = Object.fromEntries(
    response.columns.map((column) => {
      const columnValues = sourceRows.map((sourceRow) => sourceRow.values[column.id] ?? 0);
      const aggregateValue =
        response.metric.id === "count"
          ? columnValues.reduce((sum, value) => sum + value, 0)
          : Math.min(100, Math.round(columnValues.reduce((sum, value) => sum + value, 0) * 10) / 10);
      return [column.id, aggregateValue];
    })
  );

  const bases = Object.fromEntries(
    response.columns.map((column) => {
      const sourceBases = sourceRows.map((sourceRow) => sourceRow.bases[column.id] ?? 0);
      return [column.id, Math.max(...sourceBases)];
    })
  );

  return { values, bases };
}

function variableSetRowNote(variableSet: VariableSetRowSource) {
  const summaryRows = variableSet.rows.filter((row) => row.visible && row.emphasis === "summary");
  const hiddenRows = variableSet.rows.filter((row) => !row.visible);
  const parts = [`Variable set logic applied from ${variableSet.label}.`];

  if (summaryRows.length > 0) {
    parts.push(`Summary rows: ${summaryRows.map((row) => row.label).join(", ")}.`);
  }

  if (hiddenRows.length > 0) {
    parts.push(`Hidden rows: ${hiddenRows.map((row) => row.label).join(", ")}.`);
  }

  return parts.join(" ");
}

export function applyVariableSetRows(response: AnalyticsQueryResponse, variableSet: VariableSetRowSource): AnalyticsQueryResponse {
  if (!variableSet.rows.length) return response;
  if (getQuestionMetadata(response.query.dataset, response.query.question)?.type === "multi_binary_set" &&
      variableSet.rows.some((row) => row.visible && row.sourceOptionIds.length > 1)) {
    throw new Error("Multi-response nets require respondent-level union data. Marginal percentages cannot establish how respondents overlap. Rerun with a respondent-level provider.");
  }

  const orderedRows = variableSet.rows
    .slice()
    .sort((a, b) => a.rowOrder - b.rowOrder)
    .filter((row) => row.visible);

  const nextTable = orderedRows
    .map((row) => {
      const sourceRows = row.sourceOptionIds
        .map((optionId) => response.table.find((tableRow) => tableRow.optionId === optionId))
        .filter((item): item is AnalyticsTableRow => Boolean(item));

      if (sourceRows.length === 0) return null;

      const { values, bases } = aggregateRowValues(response, sourceRows);

      return {
        sourceCategoryKey: sourceRows.every(source => validSourceCategoryKey(source.sourceCategoryKey)) ? row.kind === "option" && sourceRows.length === 1 ? sourceRows[0].sourceCategoryKey : JSON.stringify({ kind: "authored", definitionId: variableSet.id, rowId: row.id, rowKind: row.kind, members: [...new Set(sourceRows.map(source => source.sourceCategoryKey!))].sort() }) : undefined,
        optionId: row.id,
        label: row.label,
        values,
        bases,
        presentation: {
          rowKind: row.kind,
          emphasis: row.emphasis
        }
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const nextSeries = nextTable.map((row) => ({
    id: row.optionId,
    label: row.label,
    values: response.columns.map((column) => row.values[column.id]),
    bases: response.columns.map((column) => row.bases[column.id])
  }));

  return withSafeInference({
    ...response,
    statistics: { ...response.statistics, inferenceBasis: undefined },
    query: {
      ...response.query,
      authoredVariableSet: {
        id: variableSet.id,
        label: variableSet.label,
        rowMode: "authored",
        rows: variableSet.rows
      }
    },
    series: nextSeries,
    table: nextTable,
    notes: [...response.notes, variableSetRowNote(variableSet)],
    metadataRefs: {
      ...response.metadataRefs,
      authoredVariableSet: {
        id: variableSet.id,
        label: variableSet.label,
        applied: true
      }
    }
  });
}
