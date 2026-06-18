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
  visible: boolean;
  sourceOptionLabels: string[];
  unknownSourceOptionIds: string[];
  overlapLabels: string[];
  sourceSummary: string;
  compositionLabel: string;
}

export interface VariableSetOverlapWarning {
  id: string;
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

export function buildVariableSetRecodePreview(rows: SavedVariableSet["rows"], question: QuestionMetadata): VariableSetRecodePreviewView {
  const optionLabels = new Map(question.options.map((option) => [option.id, option.label]));
  const visibleRows = rows.filter((row) => row.visible);
  const includedOptionIds = new Set<string>();
  const authoredUsage = new Map<string, string[]>();

  visibleRows.forEach((row) => {
    row.sourceOptionIds.forEach((optionId) => {
      if (optionLabels.has(optionId)) {
        includedOptionIds.add(optionId);
      }
      if (row.kind !== "option" && optionLabels.has(optionId)) {
        const labels = authoredUsage.get(optionId) ?? [];
        labels.push(row.label);
        authoredUsage.set(optionId, labels);
      }
    });
  });

  const overlapByOption = new Map(
    Array.from(authoredUsage.entries()).filter(([, rowLabels]) => rowLabels.length > 1)
  );
  const overlapWarnings: VariableSetOverlapWarning[] = Array.from(overlapByOption.entries()).map(([optionId, rowLabels]) => ({
    id: optionId,
    optionLabel: optionLabels.get(optionId) ?? optionId,
    rowLabels,
    helper: `${optionLabels.get(optionId) ?? optionId} appears in ${rowLabels.join(", ")}.`
  }));

  const previewRows = rows
    .slice()
    .sort((a, b) => a.rowOrder - b.rowOrder)
    .map((row) => {
      const sourceOptionLabels = row.sourceOptionIds
        .map((optionId) => optionLabels.get(optionId))
        .filter((label): label is string => Boolean(label));
      const unknownSourceOptionIds = row.sourceOptionIds.filter((optionId) => !optionLabels.has(optionId));
      const overlapLabels = row.sourceOptionIds
        .filter((optionId) => overlapByOption.has(optionId))
        .map((optionId) => optionLabels.get(optionId) ?? optionId);
      const compositionLabels = sourceOptionLabels.concat(unknownSourceOptionIds.map((optionId) => `Unknown: ${optionId}`));

      return {
        rowId: row.id,
        label: row.label,
        kind: row.kind,
        kindLabel: rowKindLabel(row.kind),
        visible: row.visible,
        sourceOptionLabels,
        unknownSourceOptionIds,
        overlapLabels,
        sourceSummary: sourceSummary(sourceOptionLabels.length, unknownSourceOptionIds.length),
        compositionLabel: compositionLabels.length ? compositionLabels.join(", ") : "No source options"
      };
    });

  return {
    includedOptionLabels: question.options.filter((option) => includedOptionIds.has(option.id)).map((option) => option.label),
    excludedOptionLabels: question.options.filter((option) => !includedOptionIds.has(option.id)).map((option) => option.label),
    authoredRows: previewRows.filter((row) => row.kind !== "option"),
    rows: previewRows,
    overlapWarnings
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

  const emptyAuthoredRows = rows.filter((row) => row.kind !== "option" && row.sourceOptionIds.length === 0);
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
