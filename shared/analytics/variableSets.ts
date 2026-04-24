import type { AnalyticsQueryResponse, AnalyticsTableRow } from "../types/analytics";
import type { SavedVariableSet } from "../types/dashboard";

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

function variableSetRowNote(variableSet: SavedVariableSet) {
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

export function applyVariableSetRows(response: AnalyticsQueryResponse, variableSet: SavedVariableSet): AnalyticsQueryResponse {
  if (!variableSet.rows.length) return response;

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

  return {
    ...response,
    series: nextSeries,
    table: nextTable,
    notes: [...response.notes, variableSetRowNote(variableSet)]
  };
}
