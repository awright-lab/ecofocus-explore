// Imported numeric text uses a decimal point and optional comma thousands
// groups. Percentages remain percentage points; no unit conversion is implied.
export function parseImportedNumber(raw: string): number | null {
  const text = raw.trim().replace(/^([+-]?)\$\s*/, "$1").replace(/%$/, "").trim();
  if (!/^[+-]?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) return null;
  const value = Number(text.replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}
