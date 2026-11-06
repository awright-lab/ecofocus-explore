function hasUniqueIds(value: unknown, key: string): boolean {
  if (!Array.isArray(value)) return false;
  const ids = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const id = (item as Record<string, unknown>)[key];
    if (typeof id !== "string" || !id.trim() || ids.has(id)) return false;
    ids.add(id);
  }
  return true;
}
// Read-only identity check, not a complete result validator or a migration.
// Preserve records exactly; never deduplicate or assign replacement IDs here.
export function resultIdentityIssue(value: unknown): string | null {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const rowsValid = hasUniqueIds(record.table, "optionId"), columnsValid = hasUniqueIds(record.columns, "id");
  if (rowsValid && columnsValid) return null;
  const identities = !rowsValid && !columnsValid ? "row and column IDs" : !rowsValid ? "row IDs" : "column IDs";
  return `This result has missing or duplicate ${identities}. Its cells cannot be identified unambiguously. Rerun the analysis before using these results. The recorded result has not been changed.`;
}
