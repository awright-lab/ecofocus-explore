import type { AnalyticsQueryResponse, AnalyticsTableRow } from "../../../../shared/types/analytics";
import type { DashboardPage, DashboardTile, SavedDerivedDefinition } from "../../../../shared/types/dashboard";
import type { DerivedDefinitionRecreationCue, DerivedOutputLibraryActionCue, DerivedOutputRecreationCue } from "../builderTypes";
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

export interface DerivedDefinitionRecreationCueView {
  label: string;
  message: string;
  helper: string;
}

export interface DerivedOutputLibraryActionCueView {
  label: string;
  message: string;
  helper: string;
}

export interface DerivedDefinitionProvenanceView {
  label: string;
  message: string;
  helper: string;
  status: "matches" | "differs" | "missing";
  chips: string[];
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

export interface DerivedDefinitionLibraryItemView {
  id: string;
  title: string;
  description: string;
  label: string;
  sourceLabel: string;
  sourceStatusLabel: string;
  sourceStatus: "available" | "missing" | "unresolved";
  readinessStatus: "ready" | "caution" | "unavailable" | "unresolved";
  readinessLabel: string;
  readinessHelper: string;
  readinessReasons: string[];
  canCreate: boolean;
  structuralSummary: string;
  querySummary: string;
  outputKind: DerivedOutputKind;
  chips: string[];
  sourceTileId: string;
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

function derivedDefinitionStructureLabel(definition: SavedDerivedDefinition) {
  return definition.outputKind === "top_n_extract" || definition.outputKind === "bottom_n_extract"
    ? `${definition.spec.rowCount ?? 0} rows from ${definition.spec.columnLabel}`
    : `${definition.spec.rowLabel ?? "Lead row"} from ${definition.spec.columnLabel}`;
}

function derivedDefinitionSourceMatches(definition: SavedDerivedDefinition, sourceTile: DashboardTile) {
  const tileSource = sourceTile.source ?? {
    kind: "question" as const,
    id: sourceTile.query.question,
    label: sourceTile.title || sourceTile.name
  };

  return tileSource.kind === definition.source.kind
    && tileSource.id === definition.source.id
    && sourceTile.query.dataset === definition.query.dataset
    && sourceTile.query.question === definition.query.question;
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

export function buildDerivedDefinitionFromTile(tile: DashboardTile, kind: DerivedOutputKind): SavedDerivedDefinition | null {
  const metadata = buildDerivedOutputMetadata(tile, kind);
  if (!metadata) return null;

  const source = tile.source ?? {
    kind: "question" as const,
    id: tile.query.question,
    label: tile.title || tile.name || tile.query.question
  };
  const outputLabel = derivedOutputKindLabel(kind);
  const structureLabel = kind === "top_n_extract" || kind === "bottom_n_extract"
    ? `${metadata.rowCount ?? 0} rows from ${metadata.columnLabel}`
    : `${metadata.rowLabel ?? "Lead row"} from ${metadata.columnLabel}`;
  const confidenceLabel = `${Math.round((tile.query.confidenceLevel ?? 0.95) * 100)}% confidence`;

  return {
    id: `derived_definition_${Date.now()}`,
    datasetId: tile.query.dataset,
    label: `${tile.title || tile.name} ${outputLabel.toLowerCase()}`,
    description: `Reusable ${outputLabel.toLowerCase()} definition from ${tile.title || tile.name}.`,
    source,
    sourceTileId: tile.id,
    sourceTileTitle: tile.title || tile.name,
    query: {
      ...tile.query,
      chartType: tile.visualization
    },
    outputKind: kind,
    spec: {
      columnId: metadata.columnId,
      columnLabel: metadata.columnLabel,
      rowId: metadata.rowId,
      rowLabel: metadata.rowLabel,
      rowCount: metadata.rowCount
    },
    summary: {
      outputLabel,
      sourceLabel: source.label,
      structureLabel,
      queryLabel: `${tile.result.metric.label} · ${confidenceLabel}`
    }
  };
}

export function buildDerivedDefinitionFromDerivedTile(
  tile: DashboardTile,
  options?: { id?: string; label?: string; description?: string }
): SavedDerivedDefinition | null {
  const output = tile.derivedOutput;
  if (!output) return null;
  const source = tile.source ?? {
    kind: "question" as const,
    id: tile.query.question,
    label: output.sourceTitle || tile.query.question
  };
  const outputLabel = derivedOutputKindLabel(output.kind);
  const structureLabel = output.kind === "top_n_extract" || output.kind === "bottom_n_extract"
    ? `${output.rowCount ?? 0} rows from ${output.columnLabel}`
    : `${output.rowLabel ?? "Lead row"} from ${output.columnLabel}`;
  const confidenceLabel = `${Math.round((tile.query.confidenceLevel ?? 0.95) * 100)}% confidence`;

  return {
    id: options?.id ?? `derived_definition_${Date.now()}`,
    datasetId: tile.query.dataset,
    label: options?.label ?? `${output.sourceTitle} ${outputLabel.toLowerCase()}`,
    description: options?.description ?? `Reusable ${outputLabel.toLowerCase()} definition from ${output.sourceTitle}.`,
    source,
    sourceTileId: output.sourceTileId,
    sourceTileTitle: output.sourceTitle,
    query: {
      ...tile.query,
      chartType: tile.visualization
    },
    outputKind: output.kind,
    spec: {
      columnId: output.columnId,
      columnLabel: output.columnLabel,
      rowId: output.rowId,
      rowLabel: output.rowLabel,
      rowCount: output.rowCount
    },
    summary: {
      outputLabel,
      sourceLabel: source.label,
      structureLabel,
      queryLabel: `${tile.result.metric.label} · ${confidenceLabel}`
    }
  };
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

export function buildDerivedDefinitionRecreationCueView(
  cue: DerivedDefinitionRecreationCue,
  tile: DashboardTile,
  now = Date.now()
): DerivedDefinitionRecreationCueView | null {
  if (!cue || cue.tileId !== tile.id) return null;
  if (now - cue.createdAt > 60_000) return null;

  return {
    label: "Recreated from saved definition",
    message: `${derivedOutputKindSentenceLabel(cue.outputKind)} was recreated from "${cue.definitionLabel}".`,
    helper: "This tile now carries saved-definition provenance in its derived-output details."
  };
}

function derivedOutputMatchesDefinition(output: NonNullable<DashboardTile["derivedOutput"]>, definition: SavedDerivedDefinition) {
  return output.kind === definition.outputKind
    && output.sourceTileId === definition.sourceTileId
    && output.columnId === definition.spec.columnId
    && (output.rowId ?? "") === (definition.spec.rowId ?? "")
    && (output.rowCount ?? 0) === (definition.spec.rowCount ?? 0);
}

export function buildDerivedDefinitionProvenanceView(
  tile: DashboardTile,
  definitions: SavedDerivedDefinition[]
): DerivedDefinitionProvenanceView | null {
  const output = tile.derivedOutput;
  const savedDefinition = output?.savedDefinition;
  if (!output || !savedDefinition) return null;

  const definition = definitions.find((item) => item.id === savedDefinition.id);
  if (!definition) {
    return {
      label: "Saved definition provenance",
      message: `Created from "${savedDefinition.label}".`,
      helper: "The saved definition is no longer in the library, so only the tile's stored provenance is available.",
      status: "missing",
      chips: [derivedOutputKindLabel(savedDefinition.outputKind), "Definition missing"]
    };
  }

  const matches = derivedOutputMatchesDefinition(output, definition);
  return {
    label: "Saved definition provenance",
    message: `Created from "${definition.label}".`,
    helper: matches
      ? "This tile still matches the saved definition kind, source, and structural spec."
      : "This tile no longer fully matches the saved definition kind, source, or structural spec.",
    status: matches ? "matches" : "differs",
    chips: [
      derivedOutputKindLabel(definition.outputKind),
      definition.summary.structureLabel,
      matches ? "Matches saved definition" : "Differs from saved definition"
    ]
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

export function buildDerivedDefinitionReadinessView(definition: SavedDerivedDefinition, activePage: DashboardPage) {
  if (!definition.sourceTileId) {
    return {
      sourceTile: null,
      sourceStatus: "unresolved" as const,
      sourceStatusLabel: "Source relationship unresolved",
      readinessStatus: "unresolved" as const,
      readinessLabel: "Unresolved",
      readinessHelper: "This definition does not have a source tile id recorded.",
      readinessReasons: ["No source tile relationship is recorded."],
      canCreate: false
    };
  }

  const sourceTile = activePage.tiles.find((tile) => tile.id === definition.sourceTileId);
  if (!sourceTile) {
    return {
      sourceTile: null,
      sourceStatus: "missing" as const,
      sourceStatusLabel: "Source missing on current page",
      readinessStatus: "unavailable" as const,
      readinessLabel: "Unavailable",
      readinessHelper: "Open the page with the source tile before recreating this definition.",
      readinessReasons: ["The saved source tile is not on the current page."],
      canCreate: false
    };
  }

  if (!derivedDefinitionSourceMatches(definition, sourceTile)) {
    return {
      sourceTile,
      sourceStatus: "unresolved" as const,
      sourceStatusLabel: "Source context changed",
      readinessStatus: "unresolved" as const,
      readinessLabel: "Unresolved",
      readinessHelper: "The source tile id exists, but its source/query context no longer matches the saved definition.",
      readinessReasons: ["Source tile identity or question context differs from the saved definition."],
      canCreate: false
    };
  }

  const supportedResult = buildDerivedOutputResponse(sourceTile, definition.outputKind);
  const supportedMetadata = buildDerivedOutputMetadata(sourceTile, definition.outputKind);
  if (!supportedResult || !supportedMetadata) {
    return {
      sourceTile,
      sourceStatus: "available" as const,
      sourceStatusLabel: "Source available on current page",
      readinessStatus: "unavailable" as const,
      readinessLabel: "Unavailable",
      readinessHelper: "The current source result cannot produce this derived output kind.",
      readinessReasons: ["The source result does not have the rows or columns needed for this definition."],
      canCreate: false
    };
  }

  const queryStatus = buildTileQueryStatus(sourceTile);
  if (queryStatus.hasPendingChanges) {
    return {
      sourceTile,
      sourceStatus: "available" as const,
      sourceStatusLabel: "Source available on current page",
      readinessStatus: "caution" as const,
      readinessLabel: "Recreate with caution",
      readinessHelper: "The definition can be recreated, but the source tile has pending query changes.",
      readinessReasons: ["Source result may be stale until the source tile is refreshed."],
      canCreate: true
    };
  }

  return {
    sourceTile,
    sourceStatus: "available" as const,
    sourceStatusLabel: "Source available on current page",
    readinessStatus: "ready" as const,
    readinessLabel: "Ready to recreate",
    readinessHelper: "The source tile is available and the current stored result supports this definition.",
    readinessReasons: ["Source result is current for the stored query context."],
    canCreate: true
  };
}

export function buildDerivedDefinitionLibraryItems(
  definitions: SavedDerivedDefinition[],
  activePage: DashboardPage
): DerivedDefinitionLibraryItemView[] {
  return definitions.map((definition) => {
    const readiness = buildDerivedDefinitionReadinessView(definition, activePage);
    const structuralSummary = definition.summary.structureLabel || derivedDefinitionStructureLabel(definition);

    return {
      id: definition.id,
      title: definition.label,
      description: definition.description,
      label: definition.summary.outputLabel || derivedOutputKindLabel(definition.outputKind),
      sourceLabel: definition.sourceTileTitle || definition.summary.sourceLabel,
      sourceStatus: readiness.sourceStatus,
      sourceStatusLabel: readiness.sourceStatusLabel,
      readinessStatus: readiness.readinessStatus,
      readinessLabel: readiness.readinessLabel,
      readinessHelper: readiness.readinessHelper,
      readinessReasons: readiness.readinessReasons,
      canCreate: readiness.canCreate,
      structuralSummary,
      querySummary: definition.summary.queryLabel,
      outputKind: definition.outputKind,
      sourceTileId: definition.sourceTileId,
      chips: [
        definition.summary.outputLabel || derivedOutputKindLabel(definition.outputKind),
        definition.summary.sourceLabel,
        readiness.readinessLabel,
        structuralSummary,
        definition.summary.queryLabel,
        readiness.sourceStatusLabel
      ].filter(Boolean)
    };
  });
}
