import type { ImportedDatasetField } from "../../../shared/types/dashboard";

type FieldChoice = { id: string | null; fields: ImportedDatasetField[] };

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
    if (choice.id !== null && (choice.id !== "" || optional) && choice.fields.filter((field) => field.id === choice.id).length !== 1) {
      return `The selected ${label} field is no longer available in this study. Choose a replacement${removal} before continuing.`;
    }
  }
  if (options.filter.id !== null && options.filter.id !== "" && options.filterValue !== null &&
      options.completeFilterValues && !options.filterValues.includes(options.filterValue)) {
    return "The selected filter value is no longer available. Choose an available value or select No filter before continuing.";
  }
  return null;
}

/** A DOM-only empty-choice value, never a stored field ID or query constraint.
 * Retained missing IDs also reserve their value so stale selections stay visible.
 */
export function importedEmptyFieldOption(fields: ReadonlyArray<Pick<ImportedDatasetField, "id">>, retainedId: string | null): string {
  const used = new Set(fields.map(field => field.id));
  if (retainedId !== null) used.add(retainedId);
  if (!used.has("none")) return "none";
  for (let index = 0; index <= used.size; index += 1) {
    const candidate = `__ecofocus_no_field_${index}__`;
    if (!used.has(candidate)) return candidate;
  }
  throw new Error("An empty field choice could not be represented.");
}
