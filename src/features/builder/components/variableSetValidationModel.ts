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

function normalizedLabel(label: string) {
  return label.trim().toLowerCase().replace(/\s+/g, " ");
}

function knownOptionIds(question: QuestionMetadata) {
  return new Set(question.options.map((option) => option.id));
}

export function buildVariableSetReadinessView(rows: SavedVariableSet["rows"], question: QuestionMetadata): VariableSetReadinessView {
  const issues: VariableSetReadinessIssue[] = [];
  const visibleRows = rows.filter((row) => row.visible);
  const options = knownOptionIds(question);
  const labelCounts = new Map<string, number>();

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
