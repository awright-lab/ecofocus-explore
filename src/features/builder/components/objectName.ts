/** Validates new navigation names; existing names are never rewritten on load. */
export function normalizeObjectName(input: string): string {
  const name = input.trim();
  if (!name) throw Error("Enter a name. The current report name was kept.");
  if (name.length > 400 || [...name].length > 200) throw Error("Use 200 characters or fewer. The current report name was kept.");
  if (/[\u0000-\u001f\u007f\u0085\u2028\u2029]/u.test(name)) throw Error("Use a single-line name without control characters. The current report name was kept.");
  for (const character of name) { const value = character.codePointAt(0)!; if (value >= 0xd800 && value <= 0xdfff) throw Error("Use valid Unicode characters. The current report name was kept."); }
  return name;
}
