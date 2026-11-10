export const preparationCodeLimits = { values: 50000, escapedCharacters: 4 * 1024 * 1024, selected: 100, codeLength: 512, pageSize: 50 } as const;
export type PreparationCode = Readonly<{ value: string; escaped: string; label: string }>;
export type PreparationCodeCatalog = Readonly<{ entries: readonly PreparationCode[]; total: number; overlong: number }>;
export function buildPreparationCodeCatalog(values: readonly string[]): PreparationCodeCatalog {
  if (!Array.isArray(values) || values.length > preparationCodeLimits.values) throw Error("This picker supports up to 50,000 distinct codes. No codes were truncated or selected.");
  const unique = new Set<string>();
  for (let i = 0; i < values.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(values, String(i));
    if (!descriptor || !("value" in descriptor) || typeof descriptor.value !== "string") throw Error("The code list is unavailable. Original values and selections are kept.");
    unique.add(descriptor.value);
  }
  let characters = 0, overlong = 0;
  const entries: PreparationCode[] = [];
  for (const value of [...unique].sort()) {
    // Recipe version 1 cannot record longer source codes; do not offer a
    // selection that can only fail after an expensive preview.
    if (value.length > preparationCodeLimits.codeLength) { overlong++; continue; }
    const escaped = JSON.stringify(value); characters += escaped.length;
    if (characters > preparationCodeLimits.escapedCharacters) throw Error("The complete code list exceeds the 4 Mi escaped-character review budget. No partial list was shown. Original values and selections are kept.");
    const label = value === "" ? '""' : /^\s|\s$|[\u0000-\u001f\u007f\\"]/u.test(value) ? escaped : value;
    entries.push(Object.freeze({ value, escaped, label }));
  }
  return Object.freeze({ entries: Object.freeze(entries), total: unique.size, overlong });
}
export function preparationCodeWindow(catalog: PreparationCodeCatalog, search: string, requested: number, exact = false) {
  if (typeof search !== "string" || search.length > 4096) throw Error("Search allows up to 4,096 characters.");
  const matches = !exact && search === "" ? catalog.entries : catalog.entries.filter(entry => exact ? entry.escaped === search : entry.escaped.includes(search));
  const pages = Math.max(1, Math.ceil(matches.length / preparationCodeLimits.pageSize));
  const page = Math.max(0, Math.min(pages - 1, Number.isSafeInteger(requested) ? requested : 0)), offset = page * preparationCodeLimits.pageSize;
  return { page, pages, matched: matches.length, start: matches.length ? offset + 1 : 0, end: Math.min(offset + preparationCodeLimits.pageSize, matches.length), entries: matches.slice(offset, offset + preparationCodeLimits.pageSize) };
}
