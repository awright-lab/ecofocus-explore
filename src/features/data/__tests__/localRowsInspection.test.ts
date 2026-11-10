import { expect, it } from "vitest";
import { importDatasetBuffer } from "../datasetImportModel";
import { captureLocalRows, rawPage, searchLocalRows } from "../localRowsInspection";
async function fixture() { const r = await importDatasetBuffer(new TextEncoder().encode("Region,Other,Identifier\nNorth,0,000001\nNORTH, ,000002\nSouth,NA,000003\n").buffer, "synthetic-stored-rows.csv"); return r.dataset!; }
const immediate = () => Promise.resolve();
it("copies exact strings, missing properties, metadata-only keys and unmodeled case/reserved keys without touching the source", async () => {
  const d = await fixture(); d.rows = [JSON.parse('{"Region":"","__proto__":"own prototype code","constructor":"raw constructor","region":"Lowercase key"}'), { Region: " ", Other: "0", Identifier: "000002" }]; d.rowCount = 2; const before = JSON.stringify(d), snap = await captureLocalRows(d.id, () => d, { yieldControl: immediate });
  expect(snap.columns.map(c => c.key)).toEqual(["Region", "Other", "Identifier", "__proto__", "constructor", "region"]); expect(snap.rows[0].Region).toBe(""); expect(Object.hasOwn(snap.rows[0], "Other")).toBe(false); expect(snap.rows[0].__proto__).toBe("own prototype code"); expect(snap.rows[0].constructor).toBe("raw constructor"); expect(snap.rows[0].region).toBe("Lowercase key"); expect(Object.getPrototypeOf(snap.rows[0])).toBeNull(); expect(Object.isFrozen(snap.rows[0])).toBe(true); expect(JSON.stringify(d)).toBe(before); d.rows[0].Region = "Later edit"; expect(snap.rows[0].Region).toBe("");
});
it.each(["remote", "preview", "incomplete-fields", "foreign-id", "foreign-reference"])("refuses %s instead of substituting preview or alternate data", async kind => {
  const d = await fixture(); if (kind === "remote") d.sourceType = "netlify"; else if (kind === "preview") d.rows = []; else if (kind === "incomplete-fields") d.fieldCount++; else if (kind === "foreign-reference") d.sourceRef = { ...d.sourceRef!, kind: "live_connection", provider: "snowflake" };
  await expect(captureLocalRows(kind === "foreign-id" ? "another-study" : d.id, () => d, { yieldControl: immediate })).rejects.toThrow();
});
it.each(["source", "row", "field"])("rejects %s accessors without executing them", async where => {
  const d = await fixture(); let executed = 0; const getter = { enumerable: true, configurable: true, get() { executed++; return "Unexpected value"; } };
  Object.defineProperty(where === "source" ? d : where === "row" ? d.rows[0] : d.fields[0], where === "source" ? "title" : where === "row" ? "Region" : "label", getter);
  await expect(captureLocalRows(d.id, () => d, { yieldControl: immediate })).rejects.toThrow(); expect(executed).toBe(0);
});
it.each(["value", "row-growth", "row-removal", "metadata"])("withholds mixed snapshots after in-place %s changes across a yield", async change => {
  const d = await fixture(); let once = false;
  await expect(captureLocalRows(d.id, () => d, { yieldControl: async () => { if (once) return; once = true; if (change === "value") d.rows[0].Region = "Changed"; else if (change === "row-growth") d.rows.push({ Region: "new" }); else if (change === "row-removal") d.rows.pop(); else d.fields[0].label = "Changed field"; } })).rejects.toThrow();
});
it("keeps literal search semantics, empty strings, absent properties, zeroes, case and positions distinct", async () => {
  const d = await fixture(); d.rows = [{ Region: "North" }, { Region: "NORTH" }, { Region: "" }, { Region: " " }, { Region: "0" }, {}, { Region: "1e-9999" }]; d.rowCount = d.rows.length; const snap = await captureLocalRows(d.id, () => d, { yieldControl: immediate });
  const search = (mode: "contains" | "exact" | "empty" | "missing", text = "", matchCase = false) => searchLocalRows(snap, { field: "Region", mode, text, matchCase }, { yieldControl: immediate });
  expect(await search("contains", "north")).toEqual([0, 1]); expect(await search("exact", "North", true)).toEqual([0]); expect(await search("exact", "")).toEqual([2]); expect(await search("empty")).toEqual([2]); expect(await search("missing")).toEqual([5]); expect(await search("exact", " ")).toEqual([3]); expect(await search("exact", "0")).toEqual([4]); expect(await search("contains")).toEqual([0, 1, 2, 3, 4, 5, 6]); expect(await search("exact", "1e-9999")).toEqual([6]);
});
it("cancels capture and search between chunks without mutating source or existing snapshot", async () => {
  const d = await fixture(), before = JSON.stringify(d), c = new AbortController(); await expect(captureLocalRows(d.id, () => d, { signal: c.signal, yieldControl: async () => c.abort() })).rejects.toThrow("canceled"); const snap = await captureLocalRows(d.id, () => d, { yieldControl: immediate }), s = new AbortController(); await expect(searchLocalRows(snap, { field: "Region", mode: "contains", text: "North", matchCase: false }, { signal: s.signal, yieldControl: async () => s.abort() })).rejects.toThrow("canceled"); expect(JSON.stringify(d)).toBe(before); expect(snap.rows[0].Region).toBe("North");
});
it("refuses unsupported value size, sparse arrays, too many keys and forged snapshots", async () => {
  const d = await fixture(); d.rows[0].Region = "x".repeat(65537); await expect(captureLocalRows(d.id, () => d, { yieldControl: immediate })).rejects.toThrow(); d.rows[0].Region = "North"; delete d.rows[1]; await expect(captureLocalRows(d.id, () => d, { yieldControl: immediate })).rejects.toThrow(); d.rows[1] = Object.fromEntries(Array.from({ length: 201 }, (_, i) => [`column${i}`, "x"])); await expect(captureLocalRows(d.id, () => d, { yieldControl: immediate })).rejects.toThrow("200-column");
  await expect(searchLocalRows({ rows: [], columns: [] } as never, { field: "Region", mode: "contains", text: "", matchCase: false })).rejects.toThrow("valid snapshot");
});
it("enforces the aggregate stored-cell and character budgets without truncating source", async () => {
  const d = await fixture(), row = Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`k${i}`, "v"])); d.fields = Array.from({ length: 200 }, (_, i) => ({ ...d.fields[0], id: `budget-${i}`, sourceColumn: `k${i}` })); d.fieldCount = 200; d.rows = Array.from({ length: 2501 }, () => row); d.rowCount = d.rows.length; await expect(captureLocalRows(d.id, () => d, { yieldControl: immediate })).rejects.toThrow("500,000"); expect(d.rows).toHaveLength(2501); expect(Object.keys(d.rows[0])).toHaveLength(200);
  const key = "k".repeat(2048); d.fields = [{ ...d.fields[0], sourceColumn: key }]; d.fieldCount = 1; d.rows = Array.from({ length: 130 }, () => ({ [key]: "v".repeat(65536) })); d.rowCount = 130; await expect(captureLocalRows(d.id, () => d, { yieldControl: immediate })).rejects.toThrow("8 Mi"); expect(d.rows).toHaveLength(130);
});
it("captures all 150,000 raw cells in a 50,000-row study, searches literal IDs and covers every bounded page", async () => {
  const d = await fixture(); d.rows = Array.from({ length: 50000 }, (_, i) => ({ Region: i % 3 ? "South" : "North", Other: `literal-${i}`, Identifier: String(i).padStart(6, "0") })); d.rowCount = d.rows.length; const before = JSON.stringify(d); let chunks = 0; const snap = await captureLocalRows(d.id, () => d, { yieldControl: async () => { chunks++; } });
  expect(chunks).toBe(201); expect(snap.rows).toHaveLength(50000); for (let i = 0; i < d.rows.length; i++) for (const key of ["Region", "Other", "Identifier"]) if (snap.rows[i][key] !== d.rows[i][key]) throw Error(`Raw cell mismatch ${i}:${key}`);
  expect(await searchLocalRows(snap, { field: "Identifier", mode: "exact", text: "000042", matchCase: true }, { yieldControl: immediate })).toEqual([42]); expect(await searchLocalRows(snap, { field: "Region", mode: "exact", text: "North", matchCase: true }, { yieldControl: immediate })).toHaveLength(16667);
  const positions: number[] = []; for (let p = 0; p < 1000; p++) { const window = rawPage(snap.rows.length, p, 50); for (let i = window.start - 1; i < window.end; i++) positions.push(i); } expect(positions).toHaveLength(50000); expect(new Set(positions).size).toBe(50000); expect(positions.at(-1)).toBe(49999); expect(JSON.stringify(d)).toBe(before);
}, 20000);

it("distinguishes quoted-CSV CR, LF, CRLF and literal escape text through reversible JSON exact search", async () => {
  const values = ["A\rB", "A\nB", "A\r\nB", "A\\r\\nB", "a\rB", "", "tab\t\"quote\"\\end", "\ud800"];
  // ASCII line-ending cases are imported through the real quoted-CSV parser.
  const csvValues = values.slice(0, 7), csv = 'Region,Marker\r\n' + csvValues.map((value, i) => '"' + value.replaceAll('"', '""') + '",' + i).join('\r\n') + '\r\n';
  const imported = await importDatasetBuffer(new TextEncoder().encode(csv).buffer, 'synthetic-exact-line-endings.csv'), d = imported.dataset!;
  expect(d.rows.map(row => row.Region)).toEqual(csvValues); d.rows.push({ Region: values[7] }); d.rowCount++;
  const before = JSON.stringify(d), snap = await captureLocalRows(d.id, () => d, { yieldControl: immediate });
  for (let i = 0; i < values.length; i++) expect(await searchLocalRows(snap, { field: "Region", mode: "json-exact", text: JSON.stringify(values[i]), matchCase: false }, { yieldControl: immediate })).toEqual([i]);
  expect(JSON.stringify(d)).toBe(before);
});
it("refuses malformed/non-string escaped searches and accepts a complete maximum-size reversibly escaped cell", async () => {
  const d = await fixture(), raw = "\0".repeat(65536); d.rows = [{ Region: raw }]; d.rowCount = 1;
  const snap = await captureLocalRows(d.id, () => d, { yieldControl: immediate });
  expect(await searchLocalRows(snap, { field: "Region", mode: "json-exact", text: JSON.stringify(raw), matchCase: false }, { yieldControl: immediate })).toEqual([0]);
  for (const text of ['null', '[]', '{}', '1', '"unescaped\nline"', '"\\q"', JSON.stringify('x'.repeat(65537))]) await expect(searchLocalRows(snap, { field: "Region", mode: "json-exact", text, matchCase: true }, { yieldControl: immediate })).rejects.toThrow();
  expect(snap.rows[0].Region).toBe(raw);
});
import { buildNumericProfileFromValues } from '../importedNumericProfile';
import { rawSearchDescription,type RawSearch } from '../localRowsInspection';
it('partitions exact-key missing, blank, finite-number and rejected-nonblank values without converting any stored string',async()=>{const d=await fixture(),values=['',' \t\r\n','\u00a0','0','-0','0001','$1,234.50','5%','1e3','1e-9999','1e9999','Infinity','NaN','0x10','12,34','$','999','-12.5%','1\r\n2'];d.rows=[...values.map(Region=>({Region})),{Other:'5'},{region:'42'}];d.rowCount=d.rows.length;const before=JSON.stringify(d),snap=await captureLocalRows(d.id,()=>d,{yieldControl:immediate}),find=(mode:RawSearch['mode'])=>searchLocalRows(snap,{field:'Region',mode,text:'ignored text',matchCase:true},{yieldControl:immediate});expect(await find('number')).toEqual([3,4,5,6,7,8,16,17]);expect(await find('not-number')).toEqual([9,10,11,12,13,14,15,18]);expect(await find('blank')).toEqual([0,1,2]);expect(await find('missing')).toEqual([19,20]);expect(await find('empty')).toEqual([0]);const partitions=await Promise.all(['number','not-number','blank','missing'].map(mode=>find(mode as RawSearch['mode'])));expect(partitions.flat().sort((a,b)=>a-b)).toEqual(Array.from({length:d.rows.length},(_,i)=>i));expect(new Set(partitions.flat()).size).toBe(d.rows.length);const profile=buildNumericProfileFromValues([...values,'','']);expect(profile.status).toBe('ready');if(profile.status==='ready'){expect(profile.valid).toBe(partitions[0].length);expect(profile.invalid).toBe(partitions[1].length);expect(profile.blank).toBe(partitions[2].length+partitions[3].length);}expect(JSON.stringify(d)).toBe(before);expect(snap.rows[6].Region).toBe('$1,234.50');});
it.each(['blank','number','not-number','empty','missing'] as const)('ignores retained long text/case for %s and describes only the applied check',async mode=>{const d=await fixture(),snap=await captureLocalRows(d.id,()=>d,{yieldControl:immediate}),text='UNUSED-TEXT-'.repeat(600);expect(await searchLocalRows(snap,{field:'Other',mode,text,matchCase:true},{yieldControl:immediate})).toEqual(await searchLocalRows(snap,{field:'Other',mode,text:'',matchCase:false},{yieldControl:immediate}));const label=rawSearchDescription({field:'Other',mode,text,matchCase:true});expect(label).not.toContain('UNUSED');expect(label).not.toContain('case-sensitive');});
it('treats prototype-like stored keys as own strings during numeric checks',async()=>{const d=await fixture();d.fields[0].sourceColumn='__proto__';d.rows=[JSON.parse('{"__proto__":"0"}'),{},JSON.parse('{"__proto__":"bad"}')];d.rowCount=3;const snap=await captureLocalRows(d.id,()=>d,{yieldControl:immediate});expect(await searchLocalRows(snap,{field:'__proto__',mode:'number',text:'',matchCase:false},{yieldControl:immediate})).toEqual([0]);expect(await searchLocalRows(snap,{field:'__proto__',mode:'not-number',text:'',matchCase:false},{yieldControl:immediate})).toEqual([2]);expect(await searchLocalRows(snap,{field:'__proto__',mode:'missing',text:'',matchCase:false},{yieldControl:immediate})).toEqual([1]);});
it('cancels a chunked numeric check without changing source or frozen snapshot',async()=>{const d=await fixture();d.rows=Array.from({length:5000},(_,i)=>({Region:i%2?'bad':'0'}));d.rowCount=5000;const before=JSON.stringify(d),snap=await captureLocalRows(d.id,()=>d,{yieldControl:immediate}),saved=JSON.stringify(snap),controller=new AbortController();await expect(searchLocalRows(snap,{field:'Region',mode:'not-number',text:'',matchCase:false},{signal:controller.signal,yieldControl:immediate,onProgress:()=>controller.abort()})).rejects.toThrow('canceled');expect(JSON.stringify(d)).toBe(before);expect(JSON.stringify(snap)).toBe(saved);});

import { summarizeStoredFieldFormats } from "../localRowsInspection";
it("reconciles format totals to independent row partitions and exact display searches", async () => {
  const d = await fixture(), values = ["", " \t\r\n", "\u00a0", "0", "-0", "0001", "$1,234.50", "5%", "1e3", "1e-9999", "1e9999", "Infinity", "NaN", "0x10", "12,34", "$", "999", "-12.5%", "1\r\n2"];
  d.rows = [...values.map(Region => ({ Region })), { Other: "5" }, { region: "42" }]; d.rowCount = d.rows.length; const before = JSON.stringify(d), snap = await captureLocalRows(d.id, () => d, { yieldControl: immediate });
  const counts = await summarizeStoredFieldFormats(snap, "Region", { yieldControl: immediate }); expect(counts).toEqual({ number: 8, "not-number": 8, blank: 3, missing: 2, empty: 1, total: 21 }); expect(Object.isFrozen(counts)).toBe(true);
  for (const mode of ["number", "not-number", "blank", "missing"] as const) expect((await searchLocalRows(snap, { field: "Region", mode, text: "ignored", matchCase: true }, { yieldControl: immediate })).length).toBe(counts[mode]);
  expect(counts.number + counts["not-number"] + counts.blank + counts.missing).toBe(counts.total); expect(JSON.stringify(d)).toBe(before);
});
it("counts own prototype-like keys and empty studies without inherited or missing substitution", async () => {
  const d = await fixture(); d.rows = [JSON.parse('{"__proto__":"0"}'), JSON.parse('{"__proto__":"bad"}'), JSON.parse('{"__proto__":""}'), {}]; d.rowCount = 4; const snap = await captureLocalRows(d.id, () => d, { yieldControl: immediate });
  expect(await summarizeStoredFieldFormats(snap, "__proto__", { yieldControl: immediate })).toEqual({ number: 1, "not-number": 1, blank: 1, missing: 1, empty: 1, total: 4 });
  d.rows = []; d.rowCount = 0; const empty = await captureLocalRows(d.id, () => d, { yieldControl: immediate }); expect(await summarizeStoredFieldFormats(empty, "Region", { yieldControl: immediate })).toEqual({ number: 0, "not-number": 0, blank: 0, missing: 0, empty: 0, total: 0 });
});
it("refuses forged snapshots and absent fields, and publishes no partial totals on cancellation", async () => {
  const d = await fixture(), before = JSON.stringify(d), snap = await captureLocalRows(d.id, () => d, { yieldControl: immediate });
  await expect(summarizeStoredFieldFormats({ ...snap }, "Region", { yieldControl: immediate })).rejects.toThrow("valid snapshot"); await expect(summarizeStoredFieldFormats(snap, "Absent", { yieldControl: immediate })).rejects.toThrow("valid snapshot");
  const c = new AbortController(); await expect(summarizeStoredFieldFormats(snap, "Region", { signal: c.signal, yieldControl: async () => c.abort() })).rejects.toThrow("canceled"); expect(JSON.stringify(d)).toBe(before);
});
it("counts all 50000 source positions with bounded chunk progress and frozen-value semantics", async () => {
  const d = await fixture(); d.rows = Array.from({ length: 50000 }, (_, i): Record<string, string> => i % 5 === 0 ? {} : { Region: ["", "0", "bad", " "][i % 4] }); d.rowCount = 50000;
  const snap = await captureLocalRows(d.id, () => d, { yieldControl: immediate }), progress: number[] = []; d.rows[1].Region = "Later";
  const counts = await summarizeStoredFieldFormats(snap, "Region", { yieldControl: immediate, onProgress: p => progress.push(p.completed) }); expect(counts).toEqual({ number: 10000, "not-number": 10000, blank: 20000, missing: 10000, empty: 10000, total: 50000 }); expect(progress).toHaveLength(200); expect(progress.at(-1)).toBe(50000); expect(snap.rows[1].Region).toBe("0");
});
