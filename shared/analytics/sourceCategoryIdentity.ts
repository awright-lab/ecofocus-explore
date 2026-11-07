// Optional recorded identity, never derived from a display label.
export function validSourceCategoryKey(value: unknown): value is string {
 if (typeof value !== "string") return false;
 try {
  const key: unknown = JSON.parse(value);
  if (key === null || typeof key === "string") return true;
  if (!key || typeof key !== "object" || Array.isArray(key)) return false;
  const record = key as Record<string, unknown>;
  return record.kind === "authored" && typeof record.definitionId === "string" && !!record.definitionId && typeof record.rowId === "string" && !!record.rowId &&
    ["option","net","topbox","bottombox"].includes(String(record.rowKind)) && Array.isArray(record.members) && record.members.length > 0 &&
    record.members.every(member => typeof member === "string" && validSourceCategoryKey(member)) && new Set(record.members).size === record.members.length;
 } catch { return false; }
}
