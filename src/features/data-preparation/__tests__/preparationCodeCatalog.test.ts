import { expect, it } from "vitest";
import { buildPreparationCodeCatalog, preparationCodeLimits, preparationCodeWindow } from "../preparationCodeCatalog";
it("keeps every supported code beyond the old cutoff, preserves exact sorting, and pages all50000 without changing input", () => {
  const values = Array.from({ length: 50000 }, (_, i) => `Code-${String(49999 - i).padStart(5, "0")}`), before = [...values], catalog = buildPreparationCodeCatalog(values);
  expect(catalog.total).toBe(50000); expect(catalog.entries).toHaveLength(50000); expect(Object.isFrozen(catalog.entries)).toBe(true);
  const pages = Array.from({ length: 1000 }, (_, i) => preparationCodeWindow(catalog, "", i)); expect(pages.flatMap(p => p.entries.map(e => e.value))).toEqual([...values].sort()); expect(pages.at(-1)?.start).toBe(49951); expect(pages.at(-1)?.end).toBe(50000); expect(values).toEqual(before);
  expect(preparationCodeWindow(catalog, "Code-49999", 1000).entries.map(e => e.value)).toEqual(["Code-49999"]); expect(preparationCodeWindow(catalog, "Not present", 50).entries).toEqual([]);
});
it("distinguishes empty/whitespace, CR/LF/CRLF, literal escapes, case and prototype-like codes", () => {
  const values = ["", " ", "a\rb", "a\nb", "a\r\nb", "a\\rb", "North", "north", "__proto__", "constructor", '"quoted"', "0001", "1"], c = buildPreparationCodeCatalog(values);
  expect(c.entries.map(e => e.value)).toEqual([...values].sort()); expect(preparationCodeWindow(c, "\\r", 0).entries.map(e => e.value)).toEqual(["a\r\nb", "a\rb", "a\\rb"]);
  expect(preparationCodeWindow(c, JSON.stringify("a\rb"), 0).entries.map(e => e.value)).toEqual(["a\rb"]); expect(preparationCodeWindow(c, JSON.stringify("a\\rb"), 0).entries.map(e => e.value)).toEqual(["a\\rb"]); expect(preparationCodeWindow(c, "North", 0).matched).toBe(1);
  for (const entry of c.entries) expect(JSON.parse(entry.escaped)).toBe(entry.value); expect(c.entries.find(e => e.value === "")!.label).toBe('""'); expect(c.entries.find(e => e.value === " ")!.label).toBe('" "');
});
it("deduplicates exact strings without coercion, discloses overlong unsupported recipe codes and preserves originals", () => {
  const long = "x".repeat(513), values = ["1", "01", "1", long, "x".repeat(512)], c = buildPreparationCodeCatalog(values); expect(c.total).toBe(4); expect(c.overlong).toBe(1); expect(c.entries.map(e => e.value)).toEqual(["01", "1", "x".repeat(512)]); expect(values[3]).toBe(long);
});
it("refuses an entire overbudget catalog, sparse/accessor input or oversized query rather than exposing a partial list", () => {
  const values = Array.from({ length: 10000 }, (_, i) => `${i}`.padEnd(512, "x")); expect(() => buildPreparationCodeCatalog(values)).toThrow("No partial list"); expect(values).toHaveLength(10000);
  expect(() => buildPreparationCodeCatalog(Array.from({ length: 50001 }, (_, i) => String(i)))).toThrow("50,000"); const sparse = ["A", "B"]; delete sparse[0]; expect(() => buildPreparationCodeCatalog(sparse)).toThrow("unavailable"); let calls = 0; Object.defineProperty(sparse, "0", { get() { calls++; return "A"; } }); expect(() => buildPreparationCodeCatalog(sparse)).toThrow("unavailable"); expect(calls).toBe(0);
  expect(() => preparationCodeWindow(buildPreparationCodeCatalog(["A"]), "x".repeat(4097), 0)).toThrow("4,096"); expect(preparationCodeLimits.selected).toBe(100);
});

it("matches a complete escaped display exactly, including blank versus a literal quotation mark", () => {
 const c = buildPreparationCodeCatalog(["", '"', "A\rB", "A\nB", "A\\rB"]);
 expect(preparationCodeWindow(c, '""', 0, false).matched).toBe(2);
 for (const value of ["", '"', "A\rB", "A\nB", "A\\rB"]) expect(preparationCodeWindow(c, JSON.stringify(value), 0, true).entries.map(e => e.value)).toEqual([value]);
 expect(preparationCodeWindow(c, "", 0, true).matched).toBe(0);
});

it("keeps empty codes visibly distinct from literal blank markers and quote characters", () => {
 const values = ["", "[blank]", '\"\"', " ", "0", '\"0\"', "A\rB", "A\\rB"], c = buildPreparationCodeCatalog(values);
 expect(new Set(c.entries.map(e => e.label)).size).toBe(values.length); expect(c.entries.find(e => e.value === "")!.label).toBe('""'); expect(c.entries.find(e => e.value === "[blank]")!.label).toBe("[blank]");
});
