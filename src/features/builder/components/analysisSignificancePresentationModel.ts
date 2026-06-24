import type { AnalyticsQueryResponse } from "../../../../shared/types/analytics";

export interface ExecutedSignificanceCellPresentation {
  rowId: string;
  columnId: string;
  direction: "up" | "down" | "mixed";
  comparisonCount: number;
  comparedLabels: string[];
  label: string;
  title: string;
}

export interface ExecutedSignificancePresentation {
  available: boolean;
  testedComparisons: number;
  significantComparisons: number;
  cells: Record<string, ExecutedSignificanceCellPresentation>;
  summaryLabel: string;
}

export interface ExecutedSignificanceExplanationView {
  available: boolean;
  label: string;
  message: string;
  helper: string;
  chips: string[];
  markerMeanings: string[];
  comparedColumns: string[];
  exampleCells: ExecutedSignificanceCellPresentation[];
}

function cellKey(rowId: string, columnId: string) {
  return `${rowId}::${columnId}`;
}

function oppositeDirection(direction: "up" | "down") {
  return direction === "up" ? "down" : "up";
}

function mergeDirection(current: "up" | "down" | "mixed" | null, next: "up" | "down") {
  if (!current || current === next) return next;
  return "mixed";
}

function directionLabel(direction: ExecutedSignificanceCellPresentation["direction"], count: number) {
  if (direction === "up") return count > 1 ? `Sig ↑ ${count}` : "Sig ↑";
  if (direction === "down") return count > 1 ? `Sig ↓ ${count}` : "Sig ↓";
  return count > 1 ? `Sig ↕ ${count}` : "Sig ↕";
}

function titlePrefix(direction: ExecutedSignificanceCellPresentation["direction"]) {
  if (direction === "up") return "Higher than";
  if (direction === "down") return "Lower than";
  return "Differs from";
}

export function buildExecutedColumnComparisonPresentation(result: AnalyticsQueryResponse): ExecutedSignificancePresentation {
  const report = result.statistics?.significanceExecutionReport;
  const executionResult = report?.result;

  if (report?.status !== "executed" || executionResult?.method !== "column_comparison") {
    return {
      available: false,
      testedComparisons: 0,
      significantComparisons: 0,
      cells: {},
      summaryLabel: "No executed column-comparison significance"
    };
  }

  const columnLabels = new Map(result.columns.map((column) => [column.id, column.label]));
  const cells = new Map<string, {
    rowId: string;
    columnId: string;
    direction: "up" | "down" | "mixed" | null;
    comparedLabels: string[];
  }>();

  function addCellMarker(rowId: string, columnId: string, comparedColumnId: string, direction: "up" | "down") {
    const key = cellKey(rowId, columnId);
    const existing = cells.get(key) ?? {
      rowId,
      columnId,
      direction: null,
      comparedLabels: []
    };
    const comparedLabel = columnLabels.get(comparedColumnId) ?? comparedColumnId;

    cells.set(key, {
      ...existing,
      direction: mergeDirection(existing.direction, direction),
      comparedLabels: existing.comparedLabels.includes(comparedLabel)
        ? existing.comparedLabels
        : [...existing.comparedLabels, comparedLabel]
    });
  }

  executionResult.outcomes.forEach((outcome) => {
    if (outcome.status !== "tested" || !outcome.statistics.direction) return;

    addCellMarker(outcome.rowId, outcome.columnId, outcome.comparedColumnId, outcome.statistics.direction);
    addCellMarker(outcome.rowId, outcome.comparedColumnId, outcome.columnId, oppositeDirection(outcome.statistics.direction));
  });

  const presentationCells = Object.fromEntries(
    Array.from(cells.values()).map((item) => {
      const direction = item.direction ?? "mixed";
      const comparisonCount = item.comparedLabels.length;

      return [
        cellKey(item.rowId, item.columnId),
        {
          rowId: item.rowId,
          columnId: item.columnId,
          direction,
          comparisonCount,
          comparedLabels: item.comparedLabels,
          label: directionLabel(direction, comparisonCount),
          title: `${titlePrefix(direction)} ${item.comparedLabels.join(", ")} at ${Math.round(result.statistics.confidenceLevel * 100)}% confidence.`
        }
      ];
    })
  );

  return {
    available: true,
    testedComparisons: executionResult.summary.testedComparisons,
    significantComparisons: executionResult.summary.significantComparisons ?? cells.size,
    cells: presentationCells,
    summaryLabel: `${executionResult.summary.testedComparisons.toLocaleString()} tested column comparisons; ${(executionResult.summary.significantComparisons ?? cells.size).toLocaleString()} significant.`
  };
}

export function getExecutedSignificanceCell(
  presentation: ExecutedSignificancePresentation,
  rowId: string,
  columnId: string
) {
  return presentation.cells[cellKey(rowId, columnId)] ?? null;
}

export function buildExecutedSignificanceExplanationView(result: AnalyticsQueryResponse): ExecutedSignificanceExplanationView {
  const presentation = buildExecutedColumnComparisonPresentation(result);

  if (!presentation.available || presentation.significantComparisons === 0) {
    return {
      available: false,
      label: "No executed table markers",
      message: "This result has no executed column-comparison markers to explain.",
      helper: "Summary-only, wave, deferred, unsupported, and placeholder-only contexts do not show tested table markers.",
      chips: [],
      markerMeanings: [],
      comparedColumns: [],
      exampleCells: []
    };
  }

  const comparedColumns = result.columns.map((column) => column.label);
  const cells = Object.values(presentation.cells)
    .sort((a, b) => b.comparisonCount - a.comparisonCount || a.rowId.localeCompare(b.rowId) || a.columnId.localeCompare(b.columnId));

  return {
    available: true,
    label: "Tested table markers",
    message: "Sig markers show cells that tested higher or lower than another breakout column in the same row.",
    helper: "Only the current executed column-comparison path is represented here. It does not include wave significance or unsupported/deferred contexts.",
    chips: [
      `${presentation.testedComparisons.toLocaleString()} tested comparisons`,
      `${presentation.significantComparisons.toLocaleString()} significant comparisons`,
      `${Math.round(result.statistics.confidenceLevel * 100)}% confidence`
    ],
    markerMeanings: [
      "Sig ↑ means this cell tested higher than the listed comparison column.",
      "Sig ↓ means this cell tested lower than the listed comparison column.",
      "A number on the marker means the cell differs from multiple columns."
    ],
    comparedColumns,
    exampleCells: cells.slice(0, 4)
  };
}
