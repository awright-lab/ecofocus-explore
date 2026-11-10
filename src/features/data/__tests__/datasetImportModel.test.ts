import { describe, expect, it } from "vitest";
import { importDatasetBuffer, importDatasetFile, type DatasetImportLimits } from "../datasetImportModel";
import { importedFieldValues } from "../importedDatasetAnalytics";

function textBytes(value: string, length: number) {
  const bytes = new Uint8Array(length);
  new TextEncoder().encode(value).slice(0, length).forEach((byte, index) => {
    bytes[index] = byte;
  });
  return bytes;
}

function paddedLength(length: number, unit: number) {
  return Math.ceil(length / unit) * unit;
}

function concatBytes(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const bytes = new Uint8Array(total);
  let offset = 0;
  parts.forEach((part) => {
    bytes.set(part, offset);
    offset += part.length;
  });
  return bytes;
}

function int32(value: number) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setInt32(0, value, true);
  return bytes;
}

function float64(value: number) {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setFloat64(0, value, true);
  return bytes;
}

function variableRecord(name: string, label: string) {
  const labelBytes = new TextEncoder().encode(label);
  return concatBytes([
    int32(2),
    int32(0),
    int32(1),
    int32(0),
    int32(5),
    int32(5),
    textBytes(name, 8),
    int32(labelBytes.length),
    textBytes(label, paddedLength(labelBytes.length, 4))
  ]);
}

function stringVariableRecords(name: string, label: string, width: number) {
  const labelBytes = new TextEncoder().encode(label);
  const continuations = Math.max(0, Math.ceil(width / 8) - 1);
  return concatBytes([
    int32(2),
    int32(width),
    int32(1),
    int32(0),
    int32(1),
    int32(1),
    textBytes(name, 8),
    int32(labelBytes.length),
    textBytes(label, paddedLength(labelBytes.length, 4)),
    ...Array.from({ length: continuations }, () => concatBytes([
      int32(2),
      int32(-1),
      int32(0),
      int32(0),
      int32(1),
      int32(1),
      textBytes("", 8)
    ]))
  ]);
}

function valueLabelRecord(values: Array<[number, string]>) {
  return concatBytes([
    int32(3),
    int32(values.length),
    ...values.map(([value, label]) => {
      const labelBytes = new TextEncoder().encode(label);
      return concatBytes([
        float64(value),
        new Uint8Array([labelBytes.length]),
        textBytes(label, paddedLength(labelBytes.length + 1, 8) - 1)
      ]);
    }),
    int32(4),
    int32(1),
    int32(1)
  ]);
}

function minimalSavFileWithStringContinuation() {
  const header = new Uint8Array(176);
  header.set(textBytes("$FL2", 4), 0);
  header.set(textBytes("@(#) SPSS DATA FILE TEST", 60), 4);
  const view = new DataView(header.buffer);
  view.setInt32(64, 2, true);
  view.setInt32(68, 3, true);
  view.setInt32(72, 0, true);
  view.setInt32(76, 0, true);
  view.setInt32(80, 1, true);
  view.setFloat64(84, 100, true);
  header.set(textBytes("04 Jul 26", 9), 92);
  header.set(textBytes("12:00:00", 8), 101);
  header.set(textBytes("Synthetic SAV", 64), 109);

  return concatBytes([
    header,
    stringVariableRecords("UUID", "Respondent identifier", 16),
    variableRecord("Q1", "Preferred package type"),
    valueLabelRecord([[2, "Compostable"]]),
    int32(999),
    int32(0),
    textBytes("abcdefghijklmnop", 16),
    float64(2)
  ]).buffer;
}

function minimalSavFile() {
  const header = new Uint8Array(176);
  header.set(textBytes("$FL2", 4), 0);
  header.set(textBytes("@(#) SPSS DATA FILE TEST", 60), 4);
  const view = new DataView(header.buffer);
  view.setInt32(64, 2, true);
  view.setInt32(68, 1, true);
  view.setInt32(72, 0, true);
  view.setInt32(76, 0, true);
  view.setInt32(80, 2, true);
  view.setFloat64(84, 100, true);
  header.set(textBytes("04 Jul 26", 9), 92);
  header.set(textBytes("12:00:00", 8), 101);
  header.set(textBytes("Synthetic SAV", 64), 109);

  return concatBytes([
    header,
    variableRecord("Q1", "Preferred package type"),
    valueLabelRecord([
      [1, "Reusable"],
      [2, "Compostable"]
    ]),
    int32(999),
    int32(0),
    float64(1),
    float64(2)
  ]).buffer;
}

function minimalSavFileWithUnsupportedCompression() {
  const buffer = minimalSavFile();
  new DataView(buffer).setInt32(72, 2, true);
  return buffer;
}

describe("datasetImportModel", () => {
  it("imports classic SAV rows with variable labels and value labels", async () => {
    const result = await importDatasetFile(new File([minimalSavFile()], "survey.sav"));

    expect(result.error).toBeUndefined();
    expect(result.dataset).toMatchObject({
      fileType: "sav",
      rowCount: 2,
      fieldCount: 1,
      importMetadata: {
        formatLabel: "SAV survey metadata import",
        metadataQuality: "metadata_rich"
      }
    });
    expect(result.dataset?.fields[0]).toMatchObject({
      sourceColumn: "Q1",
      label: "Preferred package type",
      variableLabel: "Preferred package type",
      type: "categorical",
      modelingRole: "candidate_dimension",
      valueLabels: {
        "1": "Reusable",
        "2": "Compostable"
      }
    });
    expect(result.dataset?.rows).toEqual([{ Q1: "1" }, { Q1: "2" }]);
    expect(importedFieldValues(result.dataset, result.dataset?.fields[0])).toEqual(["Compostable", "Reusable"]);
  });

  it("imports classic SAV rows through the server-side buffer parser", async () => {
    const result = await importDatasetBuffer(minimalSavFile(), "survey.sav", "sav");

    expect(result.error).toBeUndefined();
    expect(result.dataset).toMatchObject({
      fileType: "sav",
      rowCount: 2,
      fieldCount: 1
    });
    expect(result.dataset?.fields[0]).toMatchObject({
      sourceColumn: "Q1",
      label: "Preferred package type",
      valueLabels: {
        "1": "Reusable",
        "2": "Compostable"
      }
    });
    expect(result.dataset?.rows).toEqual([{ Q1: "1" }, { Q1: "2" }]);
  });

  it("imports SAV rows when string continuations are followed by numeric fields", async () => {
    const result = await importDatasetBuffer(minimalSavFileWithStringContinuation(), "string-continuation.sav", "sav");

    expect(result.error).toBeUndefined();
    expect(result.dataset).toMatchObject({
      fileType: "sav",
      rowCount: 1,
      fieldCount: 2
    });
    expect(result.dataset?.fields.map((field) => field.sourceColumn)).toEqual(["UUID", "Q1"]);
    expect(result.dataset?.rows).toEqual([{ UUID: "abcdefghijklmnop", Q1: "2" }]);
  });

  it("keeps SAV variable metadata when case-data compression is not supported", async () => {
    const result = await importDatasetFile(new File([minimalSavFileWithUnsupportedCompression()], "metadata-only.sav"));

    expect(result.error).toBeUndefined();
    expect(result.dataset).toMatchObject({
      fileType: "sav",
      rowCount: 0,
      fieldCount: 1
    });
    expect(result.dataset?.fields[0]).toMatchObject({
      sourceColumn: "Q1",
      label: "Preferred package type",
      valueLabels: {
        "1": "Reusable",
        "2": "Compostable"
      }
    });
    expect(result.dataset?.notes).toContain("This SAV file appears to use ZLIB-compressed case data, which is not supported yet; imported metadata without rows.");
  });
});

describe("bounded local parser", () => {
  const budget: DatasetImportLimits = { maxRows: 2, maxFields: 3, maxCells: 6, maxValueChars: 20, maxPhysicalSlots: 3 };
  const csv = (text: string, limits = budget) => importDatasetBuffer(new TextEncoder().encode(text).buffer, "local.csv", "csv", limits);
  it("retains the exact rectangular boundary and existing duplicate-header behavior", async () => {
    const text = 'A,A,\n1,2,3\n4,5,6';
    const bounded = (await csv(text)).dataset!;
    const ordinary = (await importDatasetBuffer(new TextEncoder().encode(text).buffer, "local.csv", "csv")).dataset!;
    expect(bounded.rows).toEqual(ordinary.rows);
    expect(bounded.fields).toEqual(ordinary.fields);
    expect(bounded.previewRows).toEqual(ordinary.previewRows);
    expect(bounded.notes).toEqual(ordinary.notes);
    expect(bounded.rowCount).toBe(2);
  });
  it.each([
    ['A\n1\n2\n3', budget],
    ['A,B,C,D\n1,2,3,4', budget],
    ['A\n1\n2,3,4', { ...budget, maxCells: 5 }],
    ['A\n"123456"', { ...budget, maxValueChars: 5 }],
    ['A\n"12\n3456"', { ...budget, maxValueChars: 5 }],
    ['A\n"12""3456"', { ...budget, maxValueChars: 5 }],
  ])("rejects overflow before returning any partial study (%s)", async (text, limits) => {
    const result = await csv(text, limits);
    expect(result.dataset).toBeUndefined(); expect(result.error).toMatch(/limit|budget/);
  });
  it("rejects missing, nonpositive, fractional and unsafe budgets", async () => {
    for (const value of [undefined, 0, -1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      const result = await csv('A\n1', { ...budget, maxRows: value } as DatasetImportLimits);
      expect(result.error).toBe('Invalid local import budgets.'); expect(result.dataset).toBeUndefined();
      if (value !== undefined) expect((await csv('A\n1', { ...budget, maxExpandedRowJsonChars: value })).error).toBe('Invalid local import budgets.');
    }
  });
  it("retains classic SAV at its boundary and refuses a declared oversized study", async () => {
    const result = await importDatasetBuffer(minimalSavFile(), 'local.sav', 'sav', budget);
    expect(result.dataset?.rows).toEqual([{ Q1: '1' }, { Q1: '2' }]);
    const large = minimalSavFile(); new DataView(large).setInt32(80, 3, true);
    const rejected = await importDatasetBuffer(large, 'local.sav', 'sav', budget);
    expect(rejected.dataset).toBeUndefined(); expect(rejected.error).toContain('budget');
  });
  it("does not turn unknown-count SAV budget failures into a metadata-only success", async () => {
    for (const compressed of [false, true]) {
      let buffer = minimalSavFile();
      new DataView(buffer).setInt32(80, -1, true);
      if (compressed) {
        new DataView(buffer).setInt32(72, 1, true);
        buffer = concatBytes([new Uint8Array(buffer).slice(0, -16), new Uint8Array([101, 102, 103, 252, 0, 0, 0, 0])]).buffer;
      }
      const result = await importDatasetBuffer(buffer, 'local.sav', 'sav', { ...budget, maxRows: 1 });
      expect(result.dataset).toBeUndefined(); expect(result.error).toContain('budget');
    }
  });
  it("bounds SAV physical slots, logical fields, cells and string values", async () => {
    const cases: Array<[ArrayBuffer, DatasetImportLimits]> = [
      [minimalSavFileWithStringContinuation(), { ...budget, maxPhysicalSlots: 2 }],
      [minimalSavFileWithStringContinuation(), { ...budget, maxFields: 1 }],
      [minimalSavFile(), { ...budget, maxCells: 1 }],
      [minimalSavFileWithStringContinuation(), { ...budget, maxValueChars: 15 }],
    ];
    for (const [buffer, limits] of cases) {
      const result = await importDatasetBuffer(buffer, 'local.sav', 'sav', limits);
      expect(result.dataset).toBeUndefined(); expect(result.error).toMatch(/limit|budget/);
    }
  });
  it("counts repeated keys, padding and escaped values at the exact expanded JSON boundary", async () => {
    for (const text of ['Long field,B\n1,2\n3', 'A,A\n"quote""value",x\ny,z', '"Line\nheader",B\n"Line\nvalue",\n😀,x', '__proto__,toJSON\nconstructor,plain']) {
      const ordinary = (await importDatasetBuffer(new TextEncoder().encode(text).buffer, 'local.csv', 'csv')).dataset!;
      const exact = JSON.stringify(ordinary.rows).length;
      const generous = { ...budget, maxRows: 20, maxFields: 20, maxCells: 400, maxValueChars: 100, maxExpandedRowJsonChars: exact };
      expect((await csv(text, generous)).dataset?.rows).toEqual(ordinary.rows);
      const refused = await csv(text, { ...generous, maxExpandedRowJsonChars: exact - 1 });
      expect(refused.dataset).toBeUndefined(); expect(refused.error).toContain('Expanded study rows');
    }
  });
  it("rejects a roughly 112 KB CSV with theoretical 600M repeated-key characters before creating row objects", async () => {
    const text = 'H'.repeat(100_000) + '\n' + 'x\n'.repeat(6_000);
    const result = await csv(text, { ...budget, maxRows: 10_000, maxCells: 10_000, maxValueChars: 128 * 1024, maxExpandedRowJsonChars: 16 * 1024 * 1024 });
    expect(new TextEncoder().encode(text).length).toBe(112_001);
    expect(result.dataset).toBeUndefined(); expect(result.error).toContain('Long field names repeat');
  });
  it("does not let the optional expanded-row guard become a metadata-only SAV success", async () => {
    const ordinary = (await importDatasetBuffer(minimalSavFile(), 'local.sav', 'sav')).dataset!;
    const exact = JSON.stringify(ordinary.rows).length;
    expect((await importDatasetBuffer(minimalSavFile(), 'local.sav', 'sav', { ...budget, maxExpandedRowJsonChars: exact })).dataset?.rows).toEqual(ordinary.rows);
    const result = await importDatasetBuffer(minimalSavFile(), 'local.sav', 'sav', { ...budget, maxExpandedRowJsonChars: exact - 1 });
    expect(result.dataset).toBeUndefined(); expect(result.error).toContain('Expanded study rows');
  });
});
