import type { AnalyticsQueryResponse, AnalyticsTableRow } from "../../../../shared/types/analytics";
import type { DashboardTile } from "../../../../shared/types/dashboard";

export type DerivedOutputKind = NonNullable<DashboardTile["derivedOutput"]>["kind"];

export interface DerivedOutputView {
  kind: DerivedOutputKind;
  canCreate: boolean;
  label: string;
  helper: string;
  rowLabel?: string;
  columnLabel?: string;
  valueLabel?: string;
  baseLabel?: string;
  rowCountLabel?: string;
}

export interface DerivedOutputDetailView {
  label: string;
  sourceLabel: string;
  description: string;
  chips: string[];
}

const topNCount = 5;

function leadingRow(rows: AnalyticsTableRow[], columnId: string) {
  return rows.reduce<AnalyticsTableRow | null>((leader, row) => {
    if (!leader) return row;
    return (row.values[columnId] ?? 0) > (leader.values[columnId] ?? 0) ? row : leader;
  }, null);
}

function topRows(rows: AnalyticsTableRow[], columnId: string, count: number) {
  return [...rows]
    .sort((left, right) => (right.values[columnId] ?? 0) - (left.values[columnId] ?? 0))
    .slice(0, count);
}

function formatSummaryValue(value: number, format: AnalyticsQueryResponse["metric"]["valueFormat"]) {
  return format === "percent" ? `${value}%` : value.toLocaleString();
}

function derivedOutputKindLabel(kind: DerivedOutputKind) {
  return kind === "top_n_extract" ? "Top-N extract" : "Lead-row summary";
}

function unavailableView(kind: DerivedOutputKind, label: string, helper: string): DerivedOutputView {
  return {
    kind,
    canCreate: false,
    label,
    helper
  };
}

export function buildDerivedSummaryOutputView(tile: DashboardTile): DerivedOutputView {
  if (tile.derivedOutput) {
    return unavailableView("lead_row_summary", "Summary output already derived", "This tile is already a derived output.");
  }

  const column = tile.result.columns[0];
  if (!column) {
    return unavailableView("lead_row_summary", "Summary output unavailable", "This result has no columns to summarize.");
  }

  const row = leadingRow(tile.result.table, column.id);
  if (!row) {
    return unavailableView("lead_row_summary", "Summary output unavailable", "This result has no rows to summarize.");
  }

  const value = row.values[column.id] ?? 0;
  const base = row.bases[column.id] ?? 0;
  return {
    kind: "lead_row_summary",
    canCreate: true,
    label: "Lead row summary",
    helper: `Creates a read-only summary table from the highest ${tile.result.metric.label.toLowerCase()} row in ${column.label}.`,
    rowLabel: row.label,
    columnLabel: column.label,
    valueLabel: formatSummaryValue(value, tile.result.metric.valueFormat),
    baseLabel: `Base ${base.toLocaleString()}`
  };
}

export function buildDerivedTopNOutputView(tile: DashboardTile): DerivedOutputView {
  if (tile.derivedOutput) {
    return unavailableView("top_n_extract", "Top-N extract already derived", "This tile is already a derived output.");
  }

  const column = tile.result.columns[0];
  if (!column) {
    return unavailableView("top_n_extract", "Top-N extract unavailable", "This result has no columns to extract from.");
  }

  const rows = topRows(tile.result.table, column.id, topNCount);
  if (!rows.length) {
    return unavailableView("top_n_extract", "Top-N extract unavailable", "This result has no rows to extract.");
  }

  return {
    kind: "top_n_extract",
    canCreate: true,
    label: `Top ${rows.length} extract`,
    helper: `Creates a read-only table from the leading ${rows.length} rows by ${tile.result.metric.label.toLowerCase()} in ${column.label}.`,
    rowLabel: rows.map((row) => row.label).join(", "),
    columnLabel: column.label,
    rowCountLabel: `${rows.length} rows`
  };
}

export function buildDerivedOutputViews(tile: DashboardTile): DerivedOutputView[] {
  return [
    buildDerivedSummaryOutputView(tile),
    buildDerivedTopNOutputView(tile)
  ];
}

export function buildDerivedOutputDetailView(tile: DashboardTile): DerivedOutputDetailView | null {
  const output = tile.derivedOutput;
  if (!output) return null;

  if (output.kind === "top_n_extract") {
    return {
      label: "Derived output: top-N extract",
      sourceLabel: output.sourceTitle,
      description: `Read-only extract of the leading ${output.rowCount ?? "selected"} rows by ${output.columnLabel} from the source tile.`,
      chips: [
        "Pattern: Top-N extract",
        `Source: ${output.sourceTitle}`,
        `Column: ${output.columnLabel}`,
        `${output.rowCount ?? 0} rows`
      ]
    };
  }

  return {
    label: "Derived output: lead-row summary",
    sourceLabel: output.sourceTitle,
    description: `Read-only summary of ${output.rowLabel ?? "the lead row"} from ${output.columnLabel} in the source tile.`,
    chips: [
      `Pattern: ${derivedOutputKindLabel(output.kind)}`,
      `Source: ${output.sourceTitle}`,
      output.rowLabel ? `Row: ${output.rowLabel}` : "Row: Lead row",
      `${output.columnLabel}${output.valueLabel ? `: ${output.valueLabel}` : ""}`,
      ...(output.baseLabel ? [output.baseLabel] : [])
    ]
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

export function buildDerivedTopNResponse(tile: DashboardTile): AnalyticsQueryResponse | null {
  const column = tile.result.columns[0];
  if (!column) return null;
  const rows = topRows(tile.result.table, column.id, topNCount);
  if (!rows.length) return null;

  return {
    ...tile.result,
    labels: rows.map((row) => row.label),
    columns: [column],
    series: rows.map((row) => ({
      id: row.optionId,
      label: row.label,
      values: [row.values[column.id] ?? 0],
      bases: [row.bases[column.id] ?? 0]
    })),
    table: rows.map((row) => ({
      ...row,
      values: { [column.id]: row.values[column.id] ?? 0 },
      bases: { [column.id]: row.bases[column.id] ?? 0 },
      presentation: {
        rowKind: row.presentation?.rowKind ?? "option",
        emphasis: row.presentation?.emphasis ?? "detail"
      }
    })),
    annotations: tile.result.annotations.filter((annotation) => rows.some((row) => row.optionId === annotation.rowId) && annotation.columnId === column.id),
    notes: [
      `Derived top ${rows.length} extract from ${tile.title || tile.name}.`,
      ...tile.result.notes
    ]
  };
}

export function buildDerivedTopNMetadata(tile: DashboardTile): NonNullable<DashboardTile["derivedOutput"]> | null {
  const column = tile.result.columns[0];
  if (!column) return null;
  const rows = topRows(tile.result.table, column.id, topNCount);
  if (!rows.length) return null;

  return {
    kind: "top_n_extract",
    sourceTileId: tile.id,
    sourceTitle: tile.title || tile.name,
    columnId: column.id,
    columnLabel: column.label,
    rowCount: rows.length
  };
}

export function buildDerivedOutputResponse(tile: DashboardTile, kind: DerivedOutputKind): AnalyticsQueryResponse | null {
  return kind === "top_n_extract" ? buildDerivedTopNResponse(tile) : buildDerivedSummaryResponse(tile);
}

export function buildDerivedOutputMetadata(tile: DashboardTile, kind: DerivedOutputKind): NonNullable<DashboardTile["derivedOutput"]> | null {
  return kind === "top_n_extract" ? buildDerivedTopNMetadata(tile) : buildDerivedSummaryMetadata(tile);
}
