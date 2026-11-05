import type { ImportedDatasetField } from "../../../shared/types/dashboard";

type FieldChoice = { id: string; fields: ImportedDatasetField[] };

// Keep selected IDs even when metadata changes. An unavailable constraint must
// never quietly become a different field, no breakout, or an unfiltered result.
export function importedQuerySelectionIssue(options: {
  grouping: FieldChoice;
  comparison: FieldChoice;
  filter: FieldChoice;
  measure?: FieldChoice;
  filterValue: string | null;
  filterValues: string[];
  completeFilterValues: boolean;
}): string | null {
  const choices = [
    { label: "grouping", choice: options.grouping, removal: "", optional: false },
    { label: "comparison", choice: options.comparison, removal: " or select No group", optional: true },
    { label: "filter", choice: options.filter, removal: " or select No filter", optional: true },
    ...(options.measure ? [{ label: "numeric", choice: options.measure, removal: "", optional: true }] : [])
  ];
  for (const { label, choice, removal, optional } of choices) {
    if (choice.id && (!optional || choice.id !== "none") && !choice.fields.some((field) => field.id === choice.id)) {
      return `The selected ${label} field is no longer available in this study. Choose a replacement${removal} before continuing.`;
    }
  }
  if (options.filter.id !== "none" && options.filter.id && options.filterValue !== null &&
      options.completeFilterValues && !options.filterValues.includes(options.filterValue)) {
    return "The selected filter value is no longer available. Choose an available value or select No filter before continuing.";
  }
  return null;
}
