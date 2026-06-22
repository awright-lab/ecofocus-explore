import type { AnalyticsQueryResponse, AnalyticsTableRow } from "../../../../shared/types/analytics";
import type { DashboardTile } from "../../../../shared/types/dashboard";

export interface DerivedSummaryOutputView {
  canCreate: boolean;
  label: string;
  helper: string;
  rowLabel?: string;
  columnLabel?: string;
  valueLabel?: string;
  baseLabel?: string;
}

function leadingRow(rows: AnalyticsTableRow[], columnId: string) {
  return rows.reduce<AnalyticsTableRow | null>((leader, row) => {
    if (!leader) return row;
    return (row.values[columnId] ?? 0) > (leader.values[columnId] ?? 0) ? row : leader;
  }, null);
}

function formatSummaryValue(value: number, format: AnalyticsQueryResponse["metric"]["valueFormat"]) {
  return format === "percent" ? `${value}%` : value.toLocaleString();
}

export function buildDerivedSummaryOutputView(tile: DashboardTile): DerivedSummaryOutputView {
  if (tile.derivedOutput) {
    return {
      canCreate: false,
      label: "Summary output already derived",
      helper: "This tile is already a derived summary output."
    };
  }

  const column = tile.result.columns[0];
  if (!column) {
    return {
      canCreate: false,
      label: "Summary output unavailable",
      helper: "This result has no columns to summarize."
    };
  }

  const row = leadingRow(tile.result.table, column.id);
  if (!row) {
    return {
      canCreate: false,
      label: "Summary output unavailable",
      helper: "This result has no rows to summarize."
    };
  }

  const value = row.values[column.id] ?? 0;
  const base = row.bases[column.id] ?? 0;
  return {
    canCreate: true,
    label: "Lead row summary",
    helper: `Creates a read-only summary table from the highest ${tile.result.metric.label.toLowerCase()} row in ${column.label}.`,
    rowLabel: row.label,
    columnLabel: column.label,
    valueLabel: formatSummaryValue(value, tile.result.metric.valueFormat),
    baseLabel: `Base ${base.toLocaleString()}`
  };
}

export function buildDerivedSummaryResponse(tile: DashboardTile): AnalyticsQueryResponse | null {
  const column = tile.result.columns[0];
  if (!column) return null;
  const row = leadingRow(tile.result.table, column.id);
  if (!row) return null;

  const value = row.values[column.id] ?? 0;
  const base = row.bases[column.id] ?? 0;
  return {
    ...tile.result,
    labels: [row.label],
    columns: [column],
    series: [
      {
        id: "lead_row_summary",
        label: row.label,
        values: [value],
        bases: [base]
      }
    ],
    table: [
      {
        ...row,
        values: { [column.id]: value },
        bases: { [column.id]: base },
        presentation: {
          rowKind: row.presentation?.rowKind ?? "option",
          emphasis: "summary"
        }
      }
    ],
    annotations: tile.result.annotations.filter((annotation) => annotation.rowId === row.optionId && annotation.columnId === column.id),
    notes: [
      `Derived lead row summary from ${tile.title || tile.name}.`,
      ...tile.result.notes
    ]
  };
}

export function buildDerivedSummaryMetadata(tile: DashboardTile): NonNullable<DashboardTile["derivedOutput"]> | null {
  const column = tile.result.columns[0];
  if (!column) return null;
  const row = leadingRow(tile.result.table, column.id);
  if (!row) return null;
  const value = row.values[column.id] ?? 0;
  const base = row.bases[column.id] ?? 0;
  return {
    kind: "lead_row_summary",
    sourceTileId: tile.id,
    sourceTitle: tile.title || tile.name,
    rowId: row.optionId,
    rowLabel: row.label,
    columnId: column.id,
    columnLabel: column.label,
    valueLabel: formatSummaryValue(value, tile.result.metric.valueFormat),
    baseLabel: `Base ${base.toLocaleString()}`
  };
}
