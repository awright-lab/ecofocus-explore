import type { AnalyticsQueryResponse, AnalyticsTableRow } from "../../../../shared/types/analytics";
import type { DashboardPage, DashboardTile } from "../../../../shared/types/dashboard";
import type { DerivedOutputLibraryActionCue, DerivedOutputRecreationCue } from "../builderTypes";
import { buildTileQueryStatus } from "./inspectorTileQueryModel";

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
  sourceStatus: "available" | "missing" | "unresolved";
  sourceStatusLabel: string;
  sourceStatusHelper: string;
  readinessStatus: "current" | "sourceChanged" | "sourceStale" | "unknown" | "unresolved";
  readinessLabel: string;
  readinessHelper: string;
  canRecreate: boolean;
  managementHelper: string;
  lastRecreatedLabel?: string;
  sourceTileId?: string;
  chips: string[];
}

export interface DerivedOutputRecreationCueView {
  label: string;
  message: string;
  helper: string;
}

export interface DerivedOutputLibraryActionCueView {
  label: string;
  message: string;
  helper: string;
}

export interface DerivedOutputLibraryItemView {
  id: string;
  tileId: string;
  pageId: string;
  pageTitle: string;
  title: string;
  label: string;
  sourceLabel: string;
  readinessLabel: string;
  sourceStatusLabel: string;
  structuralSummary: string;
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

function bottomRows(rows: AnalyticsTableRow[], columnId: string, count: number) {
  return [...rows]
    .sort((left, right) => (left.values[columnId] ?? 0) - (right.values[columnId] ?? 0))
    .slice(0, count);
}

function formatSummaryValue(value: number, format: AnalyticsQueryResponse["metric"]["valueFormat"]) {
  return format === "percent" ? `${value}%` : value.toLocaleString();
}

function derivedOutputKindLabel(kind: DerivedOutputKind) {
  if (kind === "top_n_extract") return "Top-N extract";
  if (kind === "bottom_n_extract") return "Bottom-N extract";
  return "Lead-row summary";
}

function derivedOutputKindSentenceLabel(kind: DerivedOutputKind) {
  return derivedOutputKindLabel(kind).toLowerCase();
}

function derivedOutputTitle(output: NonNullable<DashboardTile["derivedOutput"]>) {
  return output.kind === "top_n_extract" || output.kind === "bottom_n_extract"
    ? `${output.kind === "top_n_extract" ? "Top" : "Bottom"} ${output.rowCount ?? 0} ${output.columnLabel}`
    : `${output.rowLabel} summary`;
}

function extractRows(tile: DashboardTile, columnId: string, kind: "top_n_extract" | "bottom_n_extract") {
  return kind === "top_n_extract" ? topRows(tile.result.table, columnId, topNCount) : bottomRows(tile.result.table, columnId, topNCount);
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

export function buildDerivedBottomNOutputView(tile: DashboardTile): DerivedOutputView {
  if (tile.derivedOutput) {
    return unavailableView("bottom_n_extract", "Bottom-N extract already derived", "This tile is already a derived output.");
  }

  const column = tile.result.columns[0];
  if (!column) {
    return unavailableView("bottom_n_extract", "Bottom-N extract unavailable", "This result has no columns to extract from.");
  }

  const rows = extractRows(tile, column.id, "bottom_n_extract");
  if (!rows.length) {
    return unavailableView("bottom_n_extract", "Bottom-N extract unavailable", "This result has no rows to extract.");
  }

  return {
    kind: "bottom_n_extract",
    canCreate: true,
    label: `Bottom ${rows.length} extract`,
    helper: `Creates a read-only table from the lowest ${rows.length} rows by ${tile.result.metric.label.toLowerCase()} in ${column.label}.`,
    rowLabel: rows.map((row) => row.label).join(", "),
    columnLabel: column.label,
    rowCountLabel: `${rows.length} rows`
  };
}

export function buildDerivedOutputViews(tile: DashboardTile): DerivedOutputView[] {
  return [
    buildDerivedSummaryOutputView(tile),
    buildDerivedTopNOutputView(tile),
    buildDerivedBottomNOutputView(tile)
  ];
}

function sourceRelationshipStatus(output: NonNullable<DashboardTile["derivedOutput"]>, pageTiles: DashboardTile[]) {
  if (!output.sourceTileId) {
    return {
      sourceStatus: "unresolved" as const,
      sourceStatusLabel: "Source relationship unresolved",
      sourceStatusHelper: "This derived output does not have a source tile id recorded.",
      sourceTileId: undefined
    };
  }

  const sourceTile = pageTiles.find((pageTile) => pageTile.id === output.sourceTileId);
  if (!sourceTile) {
    return {
      sourceStatus: "missing" as const,
      sourceStatusLabel: "Source missing on current page",
      sourceStatusHelper: "The source tile was not found on the current page, so navigation is unavailable.",
      sourceTileId: undefined
    };
  }

  return {
    sourceStatus: "available" as const,
    sourceStatusLabel: "Source still available",
    sourceStatusHelper: "Open the source tile to inspect the analytical result this output was derived from.",
    sourceTileId: sourceTile.id,
    sourceTile
  };
}

export function buildDerivedSourceResultSignature(tile: DashboardTile) {
  return JSON.stringify({
    query: tile.result.query,
    columns: tile.result.columns,
    table: tile.result.table.map((row) => ({
      optionId: row.optionId,
      label: row.label,
      values: row.values,
      bases: row.bases,
      presentation: row.presentation
    })),
    metric: tile.result.metric,
    weighting: tile.result.weighting,
    annotations: tile.result.annotations
  });
}

function lastRecreatedLabel(output: NonNullable<DashboardTile["derivedOutput"]>) {
  if (!output.lastRecreatedAt) return undefined;
  return `Last recreated ${new Date(output.lastRecreatedAt).toLocaleString()}`;
}

function derivedOutputReadiness(
  output: NonNullable<DashboardTile["derivedOutput"]>,
  sourceTile?: DashboardTile
) {
  if (!sourceTile) {
    return {
      readinessStatus: "unresolved" as const,
      readinessLabel: "Readiness unresolved",
      readinessHelper: "The source relationship cannot currently be resolved, so this output cannot be checked or recreated.",
      canRecreate: false
    };
  }

  const sourceQueryStatus = buildTileQueryStatus(sourceTile);
  if (sourceQueryStatus.hasPendingChanges) {
    return {
      readinessStatus: "sourceStale" as const,
      readinessLabel: "Source result may be stale",
      readinessHelper: "The source tile has pending analysis changes. Refresh the source first if this output should reflect those changes.",
      canRecreate: true
    };
  }

  if (!output.sourceResultSignature) {
    return {
      readinessStatus: "unknown" as const,
      readinessLabel: "Readiness unknown",
      readinessHelper: "This derived output was created before source-result signatures were recorded. Recreate it to establish a current baseline.",
      canRecreate: true
    };
  }

  if (output.sourceResultSignature !== buildDerivedSourceResultSignature(sourceTile)) {
    return {
      readinessStatus: "sourceChanged" as const,
      readinessLabel: "Recreate recommended",
      readinessHelper: "The stored source result has changed since this derived output was created.",
      canRecreate: true
    };
  }

  return {
    readinessStatus: "current" as const,
    readinessLabel: "Reflects current stored source result",
    readinessHelper: "This derived output matches the current stored result on its source tile.",
    canRecreate: true
  };
}

export function buildDerivedOutputDetailView(tile: DashboardTile, pageTiles: DashboardTile[] = []): DerivedOutputDetailView | null {
  const output = tile.derivedOutput;
  if (!output) return null;
  const sourceStatus = sourceRelationshipStatus(output, pageTiles);
  const readiness = derivedOutputReadiness(output, sourceStatus.sourceTile);
  const relationship = {
    sourceStatus: sourceStatus.sourceStatus,
    sourceStatusLabel: sourceStatus.sourceStatusLabel,
    sourceStatusHelper: sourceStatus.sourceStatusHelper,
    sourceTileId: sourceStatus.sourceTileId,
    ...readiness
  };

  if (output.kind === "top_n_extract" || output.kind === "bottom_n_extract") {
    const directionLabel = output.kind === "top_n_extract" ? "leading" : "lowest";
    const patternLabel = derivedOutputKindLabel(output.kind);
    return {
      label: `Derived output: ${patternLabel.toLowerCase()}`,
      sourceLabel: output.sourceTitle,
      description: `Read-only extract of the ${directionLabel} ${output.rowCount ?? "selected"} rows by ${output.columnLabel} from the source tile.`,
      managementHelper: "Use the title field above to rename this derived output, duplicate it for a separate maintained copy, or save the setup as a template.",
      lastRecreatedLabel: lastRecreatedLabel(output),
      ...relationship,
      chips: [
        `Pattern: ${patternLabel}`,
        `Source: ${output.sourceTitle}`,
        sourceStatus.sourceStatusLabel,
        readiness.readinessLabel,
        ...(output.lastRecreatedAt ? ["Recreated"] : []),
        `Column: ${output.columnLabel}`,
        `${output.rowCount ?? 0} rows`
      ]
    };
  }

  return {
    label: "Derived output: lead-row summary",
    sourceLabel: output.sourceTitle,
    description: `Read-only summary of ${output.rowLabel ?? "the lead row"} from ${output.columnLabel} in the source tile.`,
    managementHelper: "Use the title field above to rename this derived output, duplicate it for a separate maintained copy, or save the setup as a template.",
    lastRecreatedLabel: lastRecreatedLabel(output),
    ...relationship,
    chips: [
      `Pattern: ${derivedOutputKindLabel(output.kind)}`,
      `Source: ${output.sourceTitle}`,
      sourceStatus.sourceStatusLabel,
      readiness.readinessLabel,
      ...(output.lastRecreatedAt ? ["Recreated"] : []),
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
    baseLabel: `Base ${base.toLocaleString()}`,
    sourceResultSignature: buildDerivedSourceResultSignature(tile)
  };
}

export function buildDerivedTopNResponse(tile: DashboardTile): AnalyticsQueryResponse | null {
  const column = tile.result.columns[0];
  if (!column) return null;
  const rows = extractRows(tile, column.id, "top_n_extract");
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

export function buildDerivedBottomNResponse(tile: DashboardTile): AnalyticsQueryResponse | null {
  const column = tile.result.columns[0];
  if (!column) return null;
  const rows = extractRows(tile, column.id, "bottom_n_extract");
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
      `Derived bottom ${rows.length} extract from ${tile.title || tile.name}.`,
      ...tile.result.notes
    ]
  };
}

export function buildDerivedTopNMetadata(tile: DashboardTile): NonNullable<DashboardTile["derivedOutput"]> | null {
  const column = tile.result.columns[0];
  if (!column) return null;
  const rows = extractRows(tile, column.id, "top_n_extract");
  if (!rows.length) return null;

  return {
    kind: "top_n_extract",
    sourceTileId: tile.id,
    sourceTitle: tile.title || tile.name,
    columnId: column.id,
    columnLabel: column.label,
    rowCount: rows.length,
    sourceResultSignature: buildDerivedSourceResultSignature(tile)
  };
}

export function buildDerivedBottomNMetadata(tile: DashboardTile): NonNullable<DashboardTile["derivedOutput"]> | null {
  const column = tile.result.columns[0];
  if (!column) return null;
  const rows = extractRows(tile, column.id, "bottom_n_extract");
  if (!rows.length) return null;

  return {
    kind: "bottom_n_extract",
    sourceTileId: tile.id,
    sourceTitle: tile.title || tile.name,
    columnId: column.id,
    columnLabel: column.label,
    rowCount: rows.length,
    sourceResultSignature: buildDerivedSourceResultSignature(tile)
  };
}

export function buildDerivedOutputResponse(tile: DashboardTile, kind: DerivedOutputKind): AnalyticsQueryResponse | null {
  if (kind === "top_n_extract") return buildDerivedTopNResponse(tile);
  if (kind === "bottom_n_extract") return buildDerivedBottomNResponse(tile);
  return buildDerivedSummaryResponse(tile);
}

export function buildDerivedOutputMetadata(tile: DashboardTile, kind: DerivedOutputKind): NonNullable<DashboardTile["derivedOutput"]> | null {
  if (kind === "top_n_extract") return buildDerivedTopNMetadata(tile);
  if (kind === "bottom_n_extract") return buildDerivedBottomNMetadata(tile);
  return buildDerivedSummaryMetadata(tile);
}

export function buildDerivedOutputTitle(output: NonNullable<DashboardTile["derivedOutput"]>) {
  return derivedOutputTitle(output);
}

export function buildDerivedOutputRecreationCueView(
  cue: DerivedOutputRecreationCue,
  tile: DashboardTile,
  now = Date.now()
): DerivedOutputRecreationCueView | null {
  if (!cue || cue.tileId !== tile.id) return null;
  if (now - cue.createdAt > 60_000) return null;

  return {
    label: "Derived output recreated",
    message: `${derivedOutputKindSentenceLabel(cue.outputKind)} was regenerated from ${cue.sourceTitle}.`,
    helper: cue.readinessLabel === "Reflects current stored source result"
      ? "Readiness is current against the stored source result."
      : `Current readiness: ${cue.readinessLabel}.`
  };
}

export function buildDerivedOutputLibraryActionCueView(
  cue: DerivedOutputLibraryActionCue,
  tile: DashboardTile,
  now = Date.now()
): DerivedOutputLibraryActionCueView | null {
  if (!cue || cue.tileId !== tile.id) return null;
  if (now - cue.createdAt > 60_000) return null;

  const outputLabel = derivedOutputKindSentenceLabel(cue.outputKind);
  if (cue.action === "duplicated") {
    return {
      label: "Derived output duplicated",
      message: `Created this ${outputLabel} copy from the derived-output library.`,
      helper: "This copy is selected for inspection and can be maintained independently."
    };
  }

  if (cue.action === "savedAsTemplate") {
    return {
      label: "Derived output saved as template",
      message: `${cue.templateLabel ?? "A template"} was saved from this ${outputLabel}.`,
      helper: "Open Templates in the library to reuse or manage that saved analytical setup."
    };
  }

  return {
    label: "Located from derived-output library",
    message: `Opened this ${outputLabel} from the derived-output library.`,
    helper: `Source relationship: ${cue.sourceTitle}. Review readiness and management actions below.`
  };
}

export function buildDerivedOutputLibraryItems(pages: DashboardPage[]): DerivedOutputLibraryItemView[] {
  return pages.flatMap((page) => page.tiles
    .filter((tile) => tile.derivedOutput)
    .map((tile) => {
      const detail = buildDerivedOutputDetailView(tile, page.tiles);
      const output = tile.derivedOutput!;
      const structuralSummary = output.kind === "top_n_extract" || output.kind === "bottom_n_extract"
        ? `${output.rowCount ?? 0} rows from ${output.columnLabel}`
        : `${output.rowLabel ?? "Lead row"} from ${output.columnLabel}`;

      return {
        id: `${page.id}:${tile.id}`,
        tileId: tile.id,
        pageId: page.id,
        pageTitle: page.title,
        title: tile.title || tile.name,
        label: detail?.label ?? `Derived output: ${derivedOutputKindSentenceLabel(output.kind)}`,
        sourceLabel: output.sourceTitle,
        readinessLabel: detail?.readinessLabel ?? "Readiness unresolved",
        sourceStatusLabel: detail?.sourceStatusLabel ?? "Source relationship unresolved",
        structuralSummary,
        chips: [
          derivedOutputKindLabel(output.kind),
          page.title,
          detail?.sourceStatusLabel ?? "Source unresolved",
          detail?.readinessLabel ?? "Readiness unresolved",
          structuralSummary
        ]
      };
    }));
}
