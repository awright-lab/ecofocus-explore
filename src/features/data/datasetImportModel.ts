import type { ImportedDatasetField, ImportedDatasetRecord } from "../../../shared/types/dashboard";

export interface DatasetImportResult {
  dataset?: ImportedDatasetRecord;
  error?: string;
}

interface ParsedTabularData {
  headers: string[];
  rows: string[][];
  metadata: NonNullable<ImportedDatasetRecord["importMetadata"]>;
  notes: string[];
}

interface ZipEntry {
  name: string;
  compressionMethod: number;
  compressedData: Uint8Array;
}

function slug(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return normalized || "field";
}

function humanizeHeader(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function datasetId(fileName: string) {
  return `dataset_${slug(fileName.replace(/\.[^.]+$/, ""))}_${Date.now().toString(36)}`;
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === "\"" && inQuotes && next === "\"") {
      current += "\"";
      index += 1;
    } else if (char === "\"") {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(current.trim());
      current = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(current.trim());
      current = "";
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
    } else {
      current += char;
    }
  }

  row.push(current.trim());
  if (row.some((cell) => cell.length > 0)) rows.push(row);
  return rows;
}

function looksNumeric(values: string[]) {
  const sample = values.filter(Boolean);
  return sample.length > 0 && sample.every((value) => Number.isFinite(Number(value.replace(/[$,%]/g, ""))));
}

function looksDate(values: string[]) {
  const sample = values.filter(Boolean).slice(0, 20);
  return sample.length > 0 && sample.every((value) => {
    const time = Date.parse(value);
    return Number.isFinite(time) && /\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/.test(value);
  });
}

function inferField(header: string, values: string[], index: number, rowCount: number, options?: { metadataAware?: boolean }): ImportedDatasetField {
  const distinctValues = Array.from(new Set(values.filter(Boolean)));
  const type = looksDate(values)
    ? "date"
    : looksNumeric(values)
      ? "numeric"
      : distinctValues.length <= Math.max(20, Math.round(rowCount * 0.25))
        ? "categorical"
        : "text";
  const modelingRole =
    type === "numeric"
      ? "candidate_measure"
      : type === "date"
        ? "candidate_date"
        : type === "categorical"
          ? "candidate_dimension"
          : "raw_variable";
  const sourceColumn = header || `Column ${index + 1}`;

  return {
    id: `${slug(sourceColumn)}_${index + 1}`,
    label: options?.metadataAware ? humanizeHeader(sourceColumn) || sourceColumn : sourceColumn,
    sourceColumn,
    type,
    nonEmptyCount: values.filter(Boolean).length,
    distinctCount: distinctValues.length,
    sampleValues: distinctValues.slice(0, 5),
    modelingRole,
    eligibleForFilter: type === "categorical" || type === "date",
    eligibleForSegment: type === "categorical",
    eligibleForBanner: type === "categorical"
  };
}

function fileExtension(fileName: string): ImportedDatasetRecord["fileType"] {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension === "csv" || extension === "xlsx" || extension === "sav") return extension;
  return "unknown";
}

function buildDataset(file: File, fileType: ImportedDatasetRecord["fileType"], parsed: ParsedTabularData): ImportedDatasetRecord {
  const dataRows = parsed.rows.filter((row) => row.some((cell) => cell.length > 0));
  const fields = parsed.headers.map((header, columnIndex) => inferField(
    header,
    dataRows.map((row) => row[columnIndex] ?? ""),
    columnIndex,
    dataRows.length,
    { metadataAware: parsed.metadata.metadataQuality !== "raw" }
  ));
  const previewRows = dataRows.slice(0, 25).map((row) => Object.fromEntries(parsed.headers.map((header, index) => [header, row[index] ?? ""])));
  const rows = dataRows.map((row) => Object.fromEntries(parsed.headers.map((header, index) => [header, row[index] ?? ""])));

  return {
    id: datasetId(file.name),
    title: file.name.replace(/\.[^.]+$/, ""),
    sourceType: "local_file",
    fileName: file.name,
    fileType,
    importMetadata: parsed.metadata,
    importedAt: new Date().toISOString(),
    rowCount: dataRows.length,
    fieldCount: fields.length,
    fields,
    rows,
    previewRows,
    modelingStatus: "initial_model",
    notes: parsed.notes
  };
}

function normalizeMatrix(matrix: string[][]): { headers: string[]; rows: string[][] } | null {
  if (matrix.length < 2) return null;
  const headerIndex = matrix.findIndex((row) => row.some((cell) => cell.trim().length > 0));
  if (headerIndex < 0 || headerIndex >= matrix.length - 1) return null;
  const rawHeaders = matrix[headerIndex];
  const width = Math.max(rawHeaders.length, ...matrix.slice(headerIndex + 1).map((row) => row.length));
  const headers = Array.from({ length: width }, (_, index) => rawHeaders[index]?.trim() || `Column ${index + 1}`);
  const rows = matrix.slice(headerIndex + 1).map((row) => headers.map((_, index) => row[index]?.trim() ?? ""));
  return { headers, rows };
}

function parseCsvImport(text: string): ParsedTabularData | null {
  const normalized = normalizeMatrix(parseCsv(text));
  if (!normalized) return null;
  return {
    ...normalized,
    metadata: {
      formatLabel: "CSV raw import",
      metadataQuality: "raw",
      parserNotes: ["CSV provides column headers and row values, but no survey-native labels or value labels."]
    },
    notes: [
      "Initial model inferred from imported CSV columns.",
      "CSV is metadata-light; review labels, roles, filters, banners, and measures before deeper analysis."
    ]
  };
}

function readUint16(view: DataView, offset: number) {
  return view.getUint16(offset, true);
}

function readUint32(view: DataView, offset: number) {
  return view.getUint32(offset, true);
}

function decodeText(bytes: Uint8Array) {
  return new TextDecoder("utf-8").decode(bytes);
}

async function inflateZipEntry(entry: ZipEntry) {
  if (entry.compressionMethod === 0) return entry.compressedData;
  if (entry.compressionMethod !== 8) throw new Error(`Unsupported XLSX ZIP compression method ${entry.compressionMethod}.`);
  if (typeof DecompressionStream === "undefined") {
    throw new Error("This browser/runtime does not expose DecompressionStream for XLSX import.");
  }
  const compressedBuffer = entry.compressedData.buffer.slice(
    entry.compressedData.byteOffset,
    entry.compressedData.byteOffset + entry.compressedData.byteLength
  ) as ArrayBuffer;
  const stream = new Blob([compressedBuffer]).stream().pipeThrough(new DecompressionStream("deflate-raw" as CompressionFormat));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function readZipEntries(buffer: ArrayBuffer): ZipEntry[] {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let eocdOffset = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 66000); offset -= 1) {
    if (readUint32(view, offset) === 0x06054b50) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error("Could not find XLSX ZIP directory.");

  const entryCount = readUint16(view, eocdOffset + 10);
  let centralOffset = readUint32(view, eocdOffset + 16);
  const entries: ZipEntry[] = [];
  for (let index = 0; index < entryCount; index += 1) {
    if (readUint32(view, centralOffset) !== 0x02014b50) throw new Error("Invalid XLSX ZIP central directory.");
    const compressionMethod = readUint16(view, centralOffset + 10);
    const compressedSize = readUint32(view, centralOffset + 20);
    const fileNameLength = readUint16(view, centralOffset + 28);
    const extraLength = readUint16(view, centralOffset + 30);
    const commentLength = readUint16(view, centralOffset + 32);
    const localOffset = readUint32(view, centralOffset + 42);
    const name = decodeText(bytes.slice(centralOffset + 46, centralOffset + 46 + fileNameLength));
    if (readUint32(view, localOffset) !== 0x04034b50) throw new Error("Invalid XLSX ZIP local header.");
    const localNameLength = readUint16(view, localOffset + 26);
    const localExtraLength = readUint16(view, localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    entries.push({
      name,
      compressionMethod,
      compressedData: bytes.slice(dataOffset, dataOffset + compressedSize)
    });
    centralOffset += 46 + fileNameLength + extraLength + commentLength;
  }
  return entries;
}

function parseXml(text: string) {
  return new DOMParser().parseFromString(text, "application/xml");
}

function xmlText(element: Element | null | undefined) {
  return element?.textContent ?? "";
}

function cellColumnIndex(cellRef: string | null) {
  const letters = (cellRef ?? "").match(/[A-Z]+/i)?.[0] ?? "";
  if (!letters) return 0;
  return letters.toUpperCase().split("").reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function resolveWorkbookTarget(target: string) {
  const normalized = target.replace(/^\/+/, "");
  if (normalized.startsWith("xl/")) return normalized;
  return `xl/${normalized}`;
}

async function parseXlsxImport(file: File): Promise<ParsedTabularData> {
  const entries = readZipEntries(await file.arrayBuffer());
  const entryMap = new Map(entries.map((entry) => [entry.name, entry]));
  async function entryText(name: string) {
    const entry = entryMap.get(name);
    if (!entry) return null;
    return decodeText(await inflateZipEntry(entry));
  }

  const workbookText = await entryText("xl/workbook.xml");
  const relsText = await entryText("xl/_rels/workbook.xml.rels");
  if (!workbookText || !relsText) throw new Error("XLSX workbook metadata is missing.");
  const workbook = parseXml(workbookText);
  const rels = parseXml(relsText);
  const firstSheet = Array.from(workbook.getElementsByTagName("sheet"))[0];
  const sheetName = firstSheet?.getAttribute("name") ?? "Sheet 1";
  const relationshipId = firstSheet?.getAttribute("r:id");
  const relationship = relationshipId
    ? Array.from(rels.getElementsByTagName("Relationship")).find((rel) => rel.getAttribute("Id") === relationshipId)
    : null;
  const target = relationship?.getAttribute("Target") ?? "worksheets/sheet1.xml";
  const sheetText = await entryText(resolveWorkbookTarget(target));
  if (!sheetText) throw new Error(`XLSX worksheet ${sheetName} could not be read.`);

  const sharedStringsText = await entryText("xl/sharedStrings.xml");
  const sharedStrings = sharedStringsText
    ? Array.from(parseXml(sharedStringsText).getElementsByTagName("si")).map((si) =>
        Array.from(si.getElementsByTagName("t")).map((item) => item.textContent ?? "").join("")
      )
    : [];
  const sheet = parseXml(sheetText);
  const matrix = Array.from(sheet.getElementsByTagName("row")).map((row) => {
    const values: string[] = [];
    Array.from(row.getElementsByTagName("c")).forEach((cell) => {
      const columnIndex = cellColumnIndex(cell.getAttribute("r"));
      const type = cell.getAttribute("t");
      const value = xmlText(cell.getElementsByTagName("v")[0]);
      const inlineText = Array.from(cell.getElementsByTagName("t")).map((item) => item.textContent ?? "").join("");
      values[columnIndex] = type === "s"
        ? sharedStrings[Number(value)] ?? value
        : type === "inlineStr"
          ? inlineText
          : type === "b"
            ? value === "1" ? "TRUE" : "FALSE"
            : value;
    });
    return values.map((value) => value ?? "");
  });
  const normalized = normalizeMatrix(matrix);
  if (!normalized) throw new Error("XLSX import needs a header row and at least one data row.");

  return {
    ...normalized,
    metadata: {
      formatLabel: "XLSX structured workbook",
      metadataQuality: "structured",
      sheetName,
      parserNotes: [
        `Imported first worksheet: ${sheetName}.`,
        "Workbook headers were preserved and converted into cleaner display labels where possible."
      ]
    },
    notes: [
      `Initial model inferred from XLSX worksheet "${sheetName}".`,
      "XLSX is structured, but usually does not include survey-native value labels; review modeling before advanced analysis."
    ]
  };
}

function looksLikeSav(buffer: ArrayBuffer) {
  const signature = decodeText(new Uint8Array(buffer.slice(0, 4)));
  return signature === "$FL2" || signature === "$FL3";
}

export async function importDatasetFile(file: File): Promise<DatasetImportResult> {
  const fileType = fileExtension(file.name);
  try {
    if (fileType === "csv") {
      const parsed = parseCsvImport(await file.text());
      if (!parsed) return { error: "CSV import needs a header row and at least one data row." };
      return { dataset: buildDataset(file, fileType, parsed) };
    }

    if (fileType === "xlsx") {
      const parsed = await parseXlsxImport(file);
      return { dataset: buildDataset(file, fileType, parsed) };
    }

    if (fileType === "sav") {
      const buffer = await file.arrayBuffer();
      const recognized = looksLikeSav(buffer);
      return {
        error: recognized
          ? "SPSS .sav was recognized as a metadata-rich survey file, but row/value-label parsing requires a dedicated SAV parser that is not bundled yet. Export to XLSX/CSV for this build."
          : "This does not look like a valid SPSS .sav file. Import CSV or XLSX for this build."
      };
    }

    return { error: "Unsupported file type. Import CSV or XLSX; SAV is recognized but not parsed in this build." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Dataset import failed." };
  }
}
