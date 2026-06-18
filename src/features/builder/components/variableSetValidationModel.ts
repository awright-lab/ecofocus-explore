import type { QuestionMetadata } from "../../../../shared/metadata/ecofocus2025";
import type { SavedVariableSet } from "../../../../shared/types/dashboard";

export interface VariableSetReadinessIssue {
  id: string;
  severity: "warning" | "info";
  label: string;
  helper: string;
}

export interface VariableSetReadinessView {
  status: "ready" | "review";
  label: string;
  helper: string;
  issueCount: number;
  visibleRowCount: number;
  totalRowCount: number;
  issues: VariableSetReadinessIssue[];
}

export interface VariableSetRowRecodePreview {
  rowId: string;
  label: string;
  kind: SavedVariableSet["rows"][number]["kind"];
  kindLabel: string;
  intentLabel: string;
  intentHelper: string;
  visible: boolean;
  sourceOptionLabels: string[];
  unknownSourceOptionIds: string[];
  overlapLabels: string[];
  overlapDetails: VariableSetRowOverlapDetail[];
  issueLabels: string[];
  needsReview: boolean;
  sourceSummary: string;
  compositionLabel: string;
  miniSummaryLabel: string;
  includedOptionCount: number;
  totalOptionCount: number;
}

export interface VariableSetOverlapWarning {
  id: string;
  optionLabel: string;
  rowLabels: string[];
  helper: string;
}

export interface VariableSetRowOverlapDetail {
  optionId: string;
  optionLabel: string;
  rowLabels: string[];
  helper: string;
}

export interface VariableSetRecodePreviewView {
  includedOptionLabels: string[];
  excludedOptionLabels: string[];
  authoredRows: VariableSetRowRecodePreview[];
  rows: VariableSetRowRecodePreview[];
  overlapWarnings: VariableSetOverlapWarning[];
  coverage: VariableSetRecodeCoverageView;
}

export interface VariableSetRecodeCoverageView {
  coveredOptionCount: number;
  totalOptionCount: number;
  uncoveredOptionCount: number;
  multiplyUsedOptionCount: number;
  coverageLabel: string;
  helper: string;
  uncoveredOptionLabels: string[];
  multiplyUsedOptionLabels: string[];
  multiplyUsedOptions: VariableSetCoverageOption[];
  status: "ready" | "review";
}

export interface VariableSetCoverageOption {
  id: string;
  label: string;
  rowCount: number;
  rowLabels: string[];
  summaryLabel: string;
}

export interface VariableSetAuthoredRowAuditView {
  authoredRowCount: number;
  manualNetCount: number;
  topBoxCount: number;
  bottomBoxCount: number;
  hiddenRowCount: number;
  emptyAuthoredRowCount: number;
  problemRowCount: number;
  overlappingAuthoredRowCount: number;
  overlappingSourceOptionCount: number;
  status: "ready" | "review";
  helper: string;
}

export function isAuthoredVariableSetRow(row: SavedVariableSet["rows"][number]) {
  return row.kind !== "option";
}

export function toggleVariableSetRowSourceOption(row: SavedVariableSet["rows"][number], optionId: string) {
  const nextSourceOptionIds = row.sourceOptionIds.includes(optionId)
    ? row.sourceOptionIds.filter((item) => item !== optionId)
    : [...row.sourceOptionIds, optionId];
  return nextSourceOptionIds;
}

export function clearUnknownVariableSetRowSourceOptions(row: SavedVariableSet["rows"][number], question: QuestionMetadata) {
  const knownOptionIds = new Set(question.options.map((option) => option.id));
  return row.sourceOptionIds.filter((optionId) => knownOptionIds.has(optionId));
}

export function selectAllVariableSetRowSourceOptions(question: QuestionMetadata) {
  return question.options.map((option) => option.id);
}

export function clearAllVariableSetRowSourceOptions() {
  return [];
}

export function variableSetRowIntent(kind: SavedVariableSet["rows"][number]["kind"]) {
  if (kind === "net") {
    return {
      label: "Manual net",
      helper: "Combines the selected source options into one authored summary row."
    };
  }
  if (kind === "topbox") {
    return {
      label: "Top box",
      helper: "Groups favorable or high-end response options into one authored row."
    };
  }
  if (kind === "bottombox") {
    return {
      label: "Bottom box",
      helper: "Groups unfavorable or low-end response options into one authored row."
    };
  }
  return {
    label: "Source option",
    helper: "Represents one original response option from the selected question."
  };
}

function normalizedLabel(label: string) {
  return label.trim().toLowerCase().replace(/\s+/g, " ");
}

function knownOptionIds(question: QuestionMetadata) {
  return new Set(question.options.map((option) => option.id));
}

function rowKindLabel(kind: SavedVariableSet["rows"][number]["kind"]) {
  if (kind === "topbox") return "Top box";
  if (kind === "bottombox") return "Bottom box";
  if (kind === "net") return "Net";
  return "Option";
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function sourceSummary(knownCount: number, unknownCount: number) {
  if (knownCount === 0 && unknownCount === 0) return "No source options";
  const knownLabel = knownCount > 0 ? pluralize(knownCount, "source option") : "";
  const unknownLabel = unknownCount > 0 ? `${unknownCount} unknown` : "";
  return [knownLabel, unknownLabel].filter(Boolean).join(" + ");
}

function rowMiniSummaryLabel(includedCount: number, totalCount: number, unknownCount: number) {
  const optionLabel = `${includedCount} of ${totalCount} option${totalCount === 1 ? "" : "s"}`;
  if (unknownCount > 0) return `Includes ${optionLabel} plus ${unknownCount} unknown`;
  return `Includes ${optionLabel}`;
}

function buildCoverageView(question: QuestionMetadata, includedOptionIds: Set<string>, overlapWarnings: VariableSetOverlapWarning[]): VariableSetRecodeCoverageView {
  const uncoveredOptionLabels = question.options.filter((option) => !includedOptionIds.has(option.id)).map((option) => option.label);
  const multiplyUsedOptions = overlapWarnings.map((warning) => ({
    id: warning.id,
    label: warning.optionLabel,
    rowCount: warning.rowLabels.length,
    rowLabels: warning.rowLabels,
    summaryLabel: `${warning.rowLabels.length} authored row${warning.rowLabels.length === 1 ? "" : "s"} use this option`
  }));
  const multiplyUsedOptionLabels = multiplyUsedOptions.map((option) => option.label);
  const coveredOptionCount = question.options.length - uncoveredOptionLabels.length;
  const status = uncoveredOptionLabels.length > 0 || multiplyUsedOptionLabels.length > 0 ? "review" : "ready";

  return {
    coveredOptionCount,
    totalOptionCount: question.options.length,
    uncoveredOptionCount: uncoveredOptionLabels.length,
    multiplyUsedOptionCount: multiplyUsedOptionLabels.length,
    coverageLabel: `${coveredOptionCount} of ${question.options.length} question option${question.options.length === 1 ? "" : "s"} covered`,
    helper:
      status === "ready"
        ? "Authored rows cover the full question option set without repeated authored usage."
        : "Review uncovered or multiply used options before saving or creating from this set.",
    uncoveredOptionLabels,
    multiplyUsedOptionLabels,
    multiplyUsedOptions,
    status
  };
}

export function buildVariableSetRecodePreview(rows: SavedVariableSet["rows"], question: QuestionMetadata): VariableSetRecodePreviewView {
  const optionLabels = new Map(question.options.map((option) => [option.id, option.label]));
  const visibleRows = rows.filter((row) => row.visible);
  const includedOptionIds = new Set<string>();
  const authoredUsage = new Map<string, Array<{ rowId: string; label: string }>>();

  visibleRows.forEach((row) => {
    row.sourceOptionIds.forEach((optionId) => {
      if (optionLabels.has(optionId)) {
        includedOptionIds.add(optionId);
      }
      if (isAuthoredVariableSetRow(row) && optionLabels.has(optionId)) {
        const rows = authoredUsage.get(optionId) ?? [];
        rows.push({ rowId: row.id, label: row.label });
        authoredUsage.set(optionId, rows);
      }
    });
  });

  const overlapByOption = new Map(
    Array.from(authoredUsage.entries()).filter(([, authoredRows]) => authoredRows.length > 1)
  );
  const overlapWarnings: VariableSetOverlapWarning[] = Array.from(overlapByOption.entries()).map(([optionId, authoredRows]) => ({
    id: optionId,
    optionLabel: optionLabels.get(optionId) ?? optionId,
    rowLabels: authoredRows.map((item) => item.label),
    helper: `${optionLabels.get(optionId) ?? optionId} appears in ${authoredRows.map((item) => item.label).join(", ")}.`
  }));

  const previewRows = rows
    .slice()
    .sort((a, b) => a.rowOrder - b.rowOrder)
    .map((row) => {
      const intent = variableSetRowIntent(row.kind);
      const sourceOptionLabels = row.sourceOptionIds
        .map((optionId) => optionLabels.get(optionId))
        .filter((label): label is string => Boolean(label));
      const unknownSourceOptionIds = row.sourceOptionIds.filter((optionId) => !optionLabels.has(optionId));
      const overlapLabels = row.sourceOptionIds
        .filter((optionId) => overlapByOption.has(optionId))
        .map((optionId) => optionLabels.get(optionId) ?? optionId);
      const overlapDetails = row.sourceOptionIds
        .filter((optionId) => overlapByOption.has(optionId))
        .map((optionId) => {
          const optionLabel = optionLabels.get(optionId) ?? optionId;
          const otherRows = (overlapByOption.get(optionId) ?? []).filter((item) => item.rowId !== row.id);
          const rowLabels = otherRows.map((item) => item.label);
          return {
            optionId,
            optionLabel,
            rowLabels,
            helper: `${optionLabel} is also included in ${rowLabels.join(", ")}.`
          };
        });
      const compositionLabels = sourceOptionLabels.concat(unknownSourceOptionIds.map((optionId) => `Unknown: ${optionId}`));
      const includedOptionCount = sourceOptionLabels.length;
      const totalOptionCount = question.options.length;
      const issueLabels = [
        isAuthoredVariableSetRow(row) && row.sourceOptionIds.length === 0 ? "No source options" : "",
        unknownSourceOptionIds.length > 0 ? "Unknown options" : "",
        overlapLabels.length > 0 ? "Overlaps another authored row" : ""
      ].filter(Boolean);

      return {
        rowId: row.id,
        label: row.label,
        kind: row.kind,
        kindLabel: rowKindLabel(row.kind),
        intentLabel: intent.label,
        intentHelper: intent.helper,
        visible: row.visible,
        sourceOptionLabels,
        unknownSourceOptionIds,
        overlapLabels,
        overlapDetails,
        issueLabels,
        needsReview: issueLabels.length > 0,
        sourceSummary: sourceSummary(sourceOptionLabels.length, unknownSourceOptionIds.length),
        compositionLabel: compositionLabels.length ? compositionLabels.join(", ") : "No source options",
        miniSummaryLabel: rowMiniSummaryLabel(includedOptionCount, totalOptionCount, unknownSourceOptionIds.length),
        includedOptionCount,
        totalOptionCount
      };
    });

  return {
    includedOptionLabels: question.options.filter((option) => includedOptionIds.has(option.id)).map((option) => option.label),
    excludedOptionLabels: question.options.filter((option) => !includedOptionIds.has(option.id)).map((option) => option.label),
    authoredRows: previewRows.filter((row) => row.kind !== "option"),
    rows: previewRows,
    overlapWarnings,
    coverage: buildCoverageView(question, includedOptionIds, overlapWarnings)
  };
}

export function buildVariableSetAuthoredRowAudit(rows: SavedVariableSet["rows"], question: QuestionMetadata): VariableSetAuthoredRowAuditView {
  const recodePreview = buildVariableSetRecodePreview(rows, question);
  const authoredRows = rows.filter(isAuthoredVariableSetRow);
  const hiddenRowCount = rows.filter((row) => !row.visible).length;
  const emptyAuthoredRowCount = authoredRows.filter((row) => row.sourceOptionIds.length === 0).length;
  const unknownSourceRowCount = recodePreview.authoredRows.filter((row) => row.unknownSourceOptionIds.length > 0).length;
  const overlappingRowCount = recodePreview.authoredRows.filter((row) => row.overlapLabels.length > 0).length;
  const problemRowCount = recodePreview.authoredRows.filter((row) => row.needsReview).length;
  const status = problemRowCount > 0 ? "review" : "ready";

  return {
    authoredRowCount: authoredRows.length,
    manualNetCount: authoredRows.filter((row) => row.kind === "net").length,
    topBoxCount: authoredRows.filter((row) => row.kind === "topbox").length,
    bottomBoxCount: authoredRows.filter((row) => row.kind === "bottombox").length,
    hiddenRowCount,
    emptyAuthoredRowCount,
    problemRowCount,
    overlappingAuthoredRowCount: overlappingRowCount,
    overlappingSourceOptionCount: recodePreview.overlapWarnings.length,
    status,
    helper:
      status === "ready"
        ? "Authored rows have source options and no visible authored overlaps."
        : `${problemRowCount} authored row${problemRowCount === 1 ? "" : "s"} need review for empty, unknown, or overlapping composition.${unknownSourceRowCount > 0 ? ` ${unknownSourceRowCount} row${unknownSourceRowCount === 1 ? "" : "s"} reference unknown options.` : ""}`
  };
}

export function buildVariableSetReadinessView(rows: SavedVariableSet["rows"], question: QuestionMetadata): VariableSetReadinessView {
  const issues: VariableSetReadinessIssue[] = [];
  const visibleRows = rows.filter((row) => row.visible);
  const options = knownOptionIds(question);
  const labelCounts = new Map<string, number>();
  const recodePreview = buildVariableSetRecodePreview(rows, question);

  visibleRows.forEach((row) => {
    const label = normalizedLabel(row.label);
    if (!label) return;
    labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
  });

  if (visibleRows.length === 0) {
    issues.push({
      id: "no-visible-rows",
      severity: "warning",
      label: "No visible rows",
      helper: "Reveal at least one row before using this set in a table or chart."
    });
  }

  const duplicateLabels = Array.from(labelCounts.entries()).filter(([, count]) => count > 1);
  if (duplicateLabels.length > 0) {
    issues.push({
      id: "duplicate-visible-labels",
      severity: "warning",
      label: "Duplicate visible labels",
      helper: `${duplicateLabels.length} label${duplicateLabels.length === 1 ? "" : "s"} appear more than once. Rename rows so outputs are clear.`
    });
  }

  const rowsWithoutSources = rows.filter((row) => row.sourceOptionIds.length === 0);
  if (rowsWithoutSources.length > 0) {
    issues.push({
      id: "rows-without-sources",
      severity: "warning",
      label: "Rows without source options",
      helper: `${rowsWithoutSources.length} row${rowsWithoutSources.length === 1 ? "" : "s"} do not reference source options. Add options or remove those rows.`
    });
  }

  const rowsWithUnknownSources = rows.filter((row) => row.sourceOptionIds.some((optionId) => !options.has(optionId)));
  if (rowsWithUnknownSources.length > 0) {
    issues.push({
      id: "unknown-source-options",
      severity: "warning",
      label: "Unknown source options",
      helper: `${rowsWithUnknownSources.length} row${rowsWithUnknownSources.length === 1 ? "" : "s"} reference options outside the selected question.`
    });
  }

  const emptyAuthoredRows = rows.filter((row) => isAuthoredVariableSetRow(row) && row.sourceOptionIds.length === 0);
  if (emptyAuthoredRows.length > 0) {
    issues.push({
      id: "empty-authored-rows",
      severity: "warning",
      label: "Empty authored rows",
      helper: `${emptyAuthoredRows.length} net/top/bottom row${emptyAuthoredRows.length === 1 ? "" : "s"} need source options.`
    });
  }

  if (recodePreview.overlapWarnings.length > 0) {
    issues.push({
      id: "overlapping-authored-rows",
      severity: "warning",
      label: "Overlapping authored rows",
      helper: `${recodePreview.overlapWarnings.length} source option${recodePreview.overlapWarnings.length === 1 ? "" : "s"} appear in more than one visible authored row.`
    });
  }

  if (recodePreview.excludedOptionLabels.length > 0) {
    issues.push({
      id: "excluded-source-options",
      severity: "info",
      label: "Excluded source options",
      helper: `${recodePreview.excludedOptionLabels.length} source option${recodePreview.excludedOptionLabels.length === 1 ? "" : "s"} are not included in visible rows.`
    });
  }

  const status = issues.some((issue) => issue.severity === "warning") ? "review" : "ready";

  return {
    status,
    label: status === "ready" ? "Variable set ready" : "Review variable set",
    helper:
      status === "ready"
        ? "Rows look structurally ready for save, reuse, and table creation."
        : "Readiness checks are advisory. You can still save while reviewing the issues below.",
    issueCount: issues.length,
    visibleRowCount: visibleRows.length,
    totalRowCount: rows.length,
    issues
  };
}
