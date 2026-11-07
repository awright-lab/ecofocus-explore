import { parseImportedNumber } from "./importedNumericValue";
import { createImportedStudyId } from "../../../shared/importedStudyId";
import { quotedJsonLength } from "../../../shared/jsonSizeBudget";
import { crc32 } from "../export/zip";
import { defaultXlsxImportLimits, readBoundedXlsxPart, validateXlsxImportLimits, xlsxLimitError, type XlsxImportLimits } from "./xlsxImportBudget";
import type { ImportedDatasetField, ImportedDatasetRecord } from "../../../shared/types/dashboard";

export interface DatasetImportResult {
  dataset?: ImportedDatasetRecord;
  error?: string;
  errorCode?: "sav_case_integrity";
}
export interface DatasetImportLimits {
  maxRows: number;
  maxFields: number;
  maxCells: number;
  maxValueChars: number;
  maxPhysicalSlots: number;
  maxExpandedRowJsonChars?: number;
}
class DatasetImportLimitError extends Error {}
class DatasetImportIntegrityError extends Error {}
function checkImportBudget(rows: number, fields: number, limits?: DatasetImportLimits) {
  if (limits && (rows > limits.maxRows || fields > limits.maxFields || rows > Math.floor(limits.maxCells / Math.max(1, fields)))) {
    throw new DatasetImportLimitError("This study exceeds the local import row, field or cell budget. No partial study was imported.");
  }
}

interface ParsedTabularData {
  headers: string[];
  rows: string[][];
  metadata: NonNullable<ImportedDatasetRecord["importMetadata"]>;
  notes: string[];
  fieldMetadata?: Record<string, Partial<ImportedDatasetField>>;
}

interface DatasetBuildSource {
  name: string;
}

interface ZipEntry {
  name: string;
  compressionMethod: number;
  compressedData: Uint8Array<ArrayBuffer>;
  checksum: number;
  uncompressedSize: number;
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

function parseCsv(text: string, limits?: DatasetImportLimits) {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;
  let quoteClosed = false;
  let record = 1;
  let width = 0;
  function pushCell() {
    if (limits && (row.length >= limits.maxFields || current.length > limits.maxValueChars)) {
      throw new DatasetImportLimitError("A row or value exceeds the local import size limit. No partial study was imported.");
    }
    row.push(current.trim());
  }
  function pushRow() {
    if (!row.some(cell => cell.length > 0)) return;
    width = Math.max(width, row.length);
    // The first matrix row is the header. Before appending another row,
    // rows.length is exactly the new number of data rows. Account for the
    // rectangular padding normalizeMatrix will add to earlier narrow rows.
    checkImportBudget(rows.length, width, limits);
    rows.push(row);
  }
  function malformed(reason: string): never {
    throw new Error(`CSV could not be read at record ${record}, column ${row.length + 1}: ${reason}. Check the quotes in the source file and import it again.`);
  }

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (inQuotes) {
      if (char === "\"") {
        if (next === "\"") { current += "\""; index += 1; }
        else { inQuotes = false; quoteClosed = true; }
      } else current += char;
    } else if (char === ",") {
      pushCell();
      current = "";
      quoteClosed = false;
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && next === "\n") index += 1;
      pushCell();
      current = "";
      pushRow();
      row = [];
      quoteClosed = false;
      record += 1;
    } else if (char === "\"") {
      if (quoteClosed || current.trim()) malformed("a quote appeared inside an unquoted field");
      inQuotes = true;
    } else {
      if (quoteClosed && char !== " " && char !== "\t") malformed("unexpected text followed a closing quote");
      current += char;
    }
    if (limits && current.length > limits.maxValueChars) {
      throw new DatasetImportLimitError("A value exceeds the local import size limit. No partial study was imported.");
    }
  }

  if (inQuotes) malformed("a quoted field was not closed");
  pushCell();
  pushRow();
  return rows;
}

function looksNumeric(values: string[]) {
  const sample = values.filter(Boolean);
  return sample.length > 0 && sample.every((value) => parseImportedNumber(value) !== null);
}

function looksDate(values: string[]) {
  const sample = values.filter(Boolean).slice(0, 20);
  return sample.length > 0 && sample.every((value) => {
    const time = Date.parse(value);
    return Number.isFinite(time) && /\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/.test(value);
  });
}

function inferField(
  header: string,
  values: string[],
  index: number,
  rowCount: number,
  options?: { metadataAware?: boolean; metadata?: Partial<ImportedDatasetField> }
): ImportedDatasetField {
  const distinctValues = Array.from(new Set(values.filter(Boolean)));
  const type = options?.metadata?.type ?? (looksDate(values)
    ? "date"
    : looksNumeric(values)
      ? "numeric"
      : distinctValues.length <= Math.max(20, Math.round(rowCount * 0.25))
        ? "categorical"
        : "text");
  const modelingRole = options?.metadata?.modelingRole ?? (type === "numeric"
      ? "candidate_measure"
      : type === "date"
        ? "candidate_date"
        : type === "categorical"
          ? "candidate_dimension"
          : "raw_variable");
  const sourceColumn = header || `Column ${index + 1}`;
  const label = options?.metadata?.label ?? (options?.metadataAware ? humanizeHeader(sourceColumn) || sourceColumn : sourceColumn);

  return {
    id: `${slug(sourceColumn)}_${index + 1}`,
    label,
    sourceColumn,
    variableLabel: options?.metadata?.variableLabel,
    valueLabels: options?.metadata?.valueLabels,
    sourceFormat: options?.metadata?.sourceFormat,
    type,
    nonEmptyCount: values.filter(Boolean).length,
    distinctCount: distinctValues.length,
    sampleValues: distinctValues.slice(0, 5),
    modelingRole,
    eligibleForFilter: options?.metadata?.eligibleForFilter ?? (type === "categorical" || type === "date"),
    eligibleForSegment: options?.metadata?.eligibleForSegment ?? type === "categorical",
    eligibleForBanner: options?.metadata?.eligibleForBanner ?? type === "categorical"
  };
}

export function importedFileExtension(fileName: string): ImportedDatasetRecord["fileType"] {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension === "csv" || extension === "xlsx" || extension === "sav") return extension;
  return "unknown";
}

function buildDataset(file: DatasetBuildSource, fileType: ImportedDatasetRecord["fileType"], parsed: ParsedTabularData): ImportedDatasetRecord {
  // SAV rows are physical cases, including cases with every value missing.
  const dataRows = fileType === "sav" ? parsed.rows : parsed.rows.filter((row) => row.some((cell) => cell.length > 0));
  const fields = parsed.headers.map((header, columnIndex) => inferField(
    header,
    dataRows.map((row) => row[columnIndex] ?? ""),
    columnIndex,
    dataRows.length,
    {
      metadataAware: parsed.metadata.metadataQuality !== "raw",
      metadata: parsed.fieldMetadata?.[header]
    }
  ));
  const rows = dataRows.map((row) => Object.fromEntries(parsed.headers.map((header, index) => [header, row[index] ?? ""])));
  const previewRows = selectRepresentativePreviewRows(rows, fields, 50);

  return {
    id: createImportedStudyId(file.name),
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

function selectRepresentativePreviewRows(
  rows: Array<Record<string, string>>,
  fields: ImportedDatasetField[],
  limit: number
) {
  if (rows.length <= limit) return rows;
  const analysisColumns = fields
    .filter((field) => field.nonEmptyCount > 0 && (field.type === "categorical" || field.modelingRole === "candidate_dimension"))
    .map((field) => field.sourceColumn);
  const scoredRows = rows.map((row, index) => ({
    row,
    index,
    score: analysisColumns.reduce((score, column) => score + (row[column]?.trim() ? 1 : 0), 0)
  }));
  return scoredRows
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .sort((a, b) => a.index - b.index)
    .map((item) => item.row);
}

function normalizeMatrix(matrix: string[][]): { headers: string[]; rows: string[][]; headerNotes: string[] } | null {
  if (matrix.length < 2) return null;
  const headerIndex = matrix.findIndex((row) => row.some((cell) => cell.trim().length > 0));
  if (headerIndex < 0 || headerIndex >= matrix.length - 1) return null;
  const rawHeaders = matrix[headerIndex];
  let width = rawHeaders.length;
  for (let index = headerIndex + 1; index < matrix.length; index += 1) width = Math.max(width, matrix[index].length);
  // Reserve authored names before naming duplicates/missing headers, so a
  // generated name cannot take the identity of a later authored column.
  const reserved = new Set(rawHeaders.map(header => header.trim()).filter(Boolean));
  const used = new Set<string>();
  const headerNotes: string[] = [];
  const headers = Array.from({ length: width }, (_, index) => {
    const authored = rawHeaders[index]?.trim() ?? "";
    const base = authored || `Column ${index + 1}`;
    let candidate = base;
    if (used.has(candidate) || (!authored && reserved.has(candidate))) {
      let suffix = 2;
      while (used.has(`${base} (${suffix})`) || reserved.has(`${base} (${suffix})`)) suffix += 1;
      candidate = `${base} (${suffix})`;
    }
    used.add(candidate);
    if (candidate !== authored) headerNotes.push(`Column ${index + 1}: ${authored ? `duplicate header "${authored}"` : "missing header"} imported as "${candidate}" to preserve its values separately.`);
    return candidate;
  });
  const rows = matrix.slice(headerIndex + 1).map((row) => headers.map((_, index) => row[index]?.trim() ?? ""));
  return { headers, rows, headerNotes };
}

function parseCsvImport(text: string, limits?: DatasetImportLimits): ParsedTabularData | null {
  const normalized = normalizeMatrix(parseCsv(text, limits));
  if (!normalized) return null;
  return {
    ...normalized,
    metadata: {
      formatLabel: "CSV raw import",
      metadataQuality: "raw",
      parserNotes: ["CSV provides column headers and row values, but no survey-native labels or value labels.", ...normalized.headerNotes]
    },
    notes: [
      "Initial model inferred from imported CSV columns.",
      ...normalized.headerNotes,
      "CSV is metadata-light; review labels, roles, filters, banners, and measures before deeper analysis."
    ]
  };
}

function checkExpandedRows(parsed: ParsedTabularData, limits?: DatasetImportLimits) {
  if (limits?.maxExpandedRowJsonChars === undefined) return;
  const maximum = limits.maxExpandedRowJsonChars;
  const fail = () => new DatasetImportLimitError("Expanded study rows exceed the local import limit. Long field names repeat in every row. No partial study was imported; keep the original file.");
  // Count quoted property names, delimiters and escaped values before creating
  // row objects. A short file with a long header can otherwise expand enormously.
  try {
    const base = 2 + Math.max(0, parsed.headers.length - 1) + parsed.headers.reduce((sum, header) => sum + quotedJsonLength(header, maximum) + 1, 0);
    let size = 2 + Math.max(0, parsed.rows.length - 1);
    if (parsed.rows.length > Math.floor((maximum - size) / (base + 2 * parsed.headers.length))) throw fail();
    for (const row of parsed.rows) {
      size += base;
      for (let column = 0; column < parsed.headers.length; column++) size += quotedJsonLength(row[column] ?? "", maximum - size);
      if (size > maximum) throw fail();
    }
  } catch { throw fail(); }
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

function decodeCsvText(bytes: Uint8Array) {
  const guidance = "CSV text could not be decoded safely. Export the source file as UTF-8 CSV and import it again; no study was created.";
  const utf32 = (bytes[0] === 0xff && bytes[1] === 0xfe && bytes[2] === 0 && bytes[3] === 0)
    || (bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 0xfe && bytes[3] === 0xff);
  if (utf32) throw new Error(guidance);
  const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? "utf-16le"
    : bytes[0] === 0xfe && bytes[1] === 0xff ? "utf-16be" : "utf-8";
  let text: string;
  try { text = new TextDecoder(encoding, { fatal: true }).decode(bytes); }
  catch { throw new Error(guidance); }
  // NUL often signals BOM-less UTF-16 or binary content. Do not guess an
  // encoding, remove bytes, or replace malformed characters in analytical data.
  if (text.includes("\0")) throw new Error(guidance);
  return { text, encoding: encoding.toUpperCase() };
}

function decodeSavText(bytes: Uint8Array) {
  return new TextDecoder("windows-1252").decode(bytes).replace(/\0+$/g, "").trim();
}

async function inflateZipEntry(entry: ZipEntry, maxBytes: number) {
  function verified(bytes: Uint8Array) {
    if (bytes.length !== entry.uncompressedSize || crc32(bytes) !== entry.checksum) {
      throw new Error(`XLSX ZIP integrity check failed for ${entry.name}. Repair and save the source workbook; no study was imported.`);
    }
    return bytes;
  }
  if (entry.compressionMethod === 0) {
    if (entry.compressedData.byteLength > maxBytes) throw xlsxLimitError("decoded part");
    return verified(entry.compressedData);
  }
  if (entry.compressionMethod !== 8) throw new Error(`Unsupported XLSX ZIP compression method ${entry.compressionMethod}.`);
  if (typeof DecompressionStream === "undefined") {
    throw new Error("This browser/runtime does not expose DecompressionStream for XLSX import.");
  }
  const stream = new Blob([entry.compressedData]).stream().pipeThrough(new DecompressionStream("deflate-raw" as CompressionFormat));
  return verified(await readBoundedXlsxPart(stream,entry.uncompressedSize,maxBytes));
}

function readZipEntries(buffer: ArrayBuffer, limits: XlsxImportLimits): ZipEntry[] {
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
  if (entryCount > limits.maxEntries) throw xlsxLimitError("ZIP entry count");
  let centralOffset = readUint32(view, eocdOffset + 16);
  const entries: ZipEntry[] = [];
  for (let index = 0; index < entryCount; index += 1) {
    if (readUint32(view, centralOffset) !== 0x02014b50) throw new Error("Invalid XLSX ZIP central directory.");
    const compressionMethod = readUint16(view, centralOffset + 10);
    const checksum = readUint32(view, centralOffset + 16);
    const compressedSize = readUint32(view, centralOffset + 20);
    const uncompressedSize = readUint32(view, centralOffset + 24);
    const fileNameLength = readUint16(view, centralOffset + 28);
    const extraLength = readUint16(view, centralOffset + 30);
    const commentLength = readUint16(view, centralOffset + 32);
    const localOffset = readUint32(view, centralOffset + 42);
    const name = decodeText(bytes.slice(centralOffset + 46, centralOffset + 46 + fileNameLength));
    if (readUint32(view, localOffset) !== 0x04034b50) throw new Error("Invalid XLSX ZIP local header.");
    const localNameLength = readUint16(view, localOffset + 26);
    const localExtraLength = readUint16(view, localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    if (dataOffset > bytes.length || compressedSize > bytes.length - dataOffset) throw new Error("XLSX ZIP compressed data is incomplete. No study was imported.");
    entries.push({
      name,
      compressionMethod,
      checksum,
      uncompressedSize,
      compressedData: bytes.subarray(dataOffset, dataOffset + compressedSize)
    });
    centralOffset += 46 + fileNameLength + extraLength + commentLength;
  }
  return entries;
}

function parseXml(text: string) {
  const document = new DOMParser().parseFromString(text, "application/xml");
  if (document.getElementsByTagName("parsererror").length) throw new Error("XLSX XML is malformed. Repair and save the source workbook before importing; no study was imported.");
  return document;
}

function xmlText(element: Element | null | undefined) {
  return element?.textContent ?? "";
}

function xlsxCellReference(cellRef: string | null) {
  if (cellRef === null) return null;
  const match = /^([A-Z]{1,3})([0-9]{1,7})$/i.exec(cellRef);
  const column = match ? match[1].toUpperCase().split("").reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1 : -1;
  const row = match ? Number(match[2]) : 0;
  if (column < 0 || column >= 16384 || row < 1 || row > 1048576) throw new Error("XLSX has an invalid cell address. Repair and save the source workbook; no study was imported.");
  return {column,row};
}

function resolveWorkbookTarget(target: string) {
  const normalized = target.replace(/^\/+/, "");
  if (normalized.startsWith("xl/")) return normalized;
  return `xl/${normalized}`;
}

async function parseXlsxImport(file: File, configuredLimits: XlsxImportLimits): Promise<ParsedTabularData> {
  const limits = {...configuredLimits};
  validateXlsxImportLimits(limits);
  if (file.size !== undefined && (!Number.isSafeInteger(file.size) || file.size < 0 || file.size > limits.maxArchiveBytes)) throw xlsxLimitError("archive size (32 MiB maximum)");
  const buffer = await file.arrayBuffer();
  if (buffer.byteLength > limits.maxArchiveBytes) throw xlsxLimitError("archive size (32 MiB maximum)");
  if (file.size !== undefined && buffer.byteLength !== file.size) throw new Error("The XLSX source file could not be read completely. No study was imported.");
  const entries = readZipEntries(buffer,limits);
  let decodedBytes = 0;
  const entryMap = new Map<string, ZipEntry | null>();
  for (const entry of entries) entryMap.set(entry.name,entryMap.has(entry.name) ? null : entry);
  async function entryText(name: string) {
    if (!entryMap.has(name)) return null;
    const entry = entryMap.get(name);
    if (!entry) throw new Error(`XLSX has ambiguous duplicate part ${name}. Repair and save the source workbook; no study was imported.`);
    const remaining = limits.maxDecodedBytes - decodedBytes;
    if (entry.uncompressedSize > limits.maxPartBytes) throw xlsxLimitError("decoded part (32 MiB maximum)");
    if (entry.uncompressedSize > remaining) throw xlsxLimitError("combined decoded parts (64 MiB maximum)");
    const bytes = await inflateZipEntry(entry,Math.min(limits.maxPartBytes,remaining));
    decodedBytes += bytes.byteLength;
    return decodeText(bytes);
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
  const seenRows = new Set<number>();
  let previousRow = 0;
  const matrix = Array.from(sheet.getElementsByTagName("row")).map((row) => {
    const cells = Array.from(row.getElementsByTagName("c"));
    const declaredRow = row.getAttribute("r");
    const normalizedRow = declaredRow?.replace(/^[\x20\t\r\n]+|[\x20\t\r\n]+$/g, "");
    if (normalizedRow !== undefined && !/^[0-9]+$/.test(normalizedRow)) throw new Error("XLSX has an invalid row address. No study was imported.");
    const rowNumber = normalizedRow !== undefined ? Number(normalizedRow) : xlsxCellReference(cells[0]?.getAttribute("r") ?? null)?.row ?? previousRow + 1;
    if (!Number.isSafeInteger(rowNumber) || rowNumber < 1 || rowNumber > 1048576 || seenRows.has(rowNumber)) throw new Error("XLSX has a duplicate or invalid row address. No study was imported.");
    seenRows.add(rowNumber);previousRow = rowNumber;
    const values: string[] = [];
    const occupied = new Set<number>();
    let nextColumn = 0;
    cells.forEach((cell) => {
      const reference = xlsxCellReference(cell.getAttribute("r"));
      const columnIndex = reference?.column ?? nextColumn;
      if (reference && reference.row !== rowNumber) throw new Error("XLSX cell and row addresses disagree. No study was imported.");
      if (columnIndex >= 16384 || occupied.has(columnIndex)) throw new Error("XLSX has a duplicate or invalid cell address. No values were overwritten and no study was imported.");
      occupied.add(columnIndex);nextColumn = columnIndex + 1;
      const type = cell.getAttribute("t");
      const valueNodes = cell.getElementsByTagName("v");
      const value = xmlText(valueNodes[0]);
      const inlineText = Array.from(cell.getElementsByTagName("t")).map((item) => item.textContent ?? "").join("");
      if (type === "s" && (valueNodes.length !== 1 || !/^\+?[0-9]+$/.test(value.trim()) || !Number.isSafeInteger(Number(value)) || Number(value) >= sharedStrings.length)) {
        throw new Error("XLSX has an unresolved shared-string reference. Repair and save the source workbook; its numeric index was not imported as a response and no study was imported.");
      }
      values[columnIndex] = type === "s"
        ? sharedStrings[Number(value)]
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
        ...normalized.headerNotes,
        "Workbook headers were preserved and converted into cleaner display labels where possible."
      ]
    },
    notes: [
      `Initial model inferred from XLSX worksheet "${sheetName}".`,
      ...normalized.headerNotes,
      "XLSX is structured, but usually does not include survey-native value labels; review modeling before advanced analysis."
    ]
  };
}

function looksLikeSav(buffer: ArrayBuffer) {
  const signature = decodeText(new Uint8Array(buffer.slice(0, 4)));
  return signature === "$FL2" || signature === "$FL3";
}

function readInt32(view: DataView, offset: number) {
  return view.getInt32(offset, true);
}

function readFloat64(view: DataView, offset: number) {
  return view.getFloat64(offset, true);
}

interface SavVariable {
  name: string;
  label: string;
  type: "numeric" | "string";
  width: number;
  recordIndex: number;
  recordSpan: number;
  sourceFormat?: string;
  valueLabels?: Record<string, string>;
}

function paddedLength(length: number, unit: number) {
  return Math.ceil(length / unit) * unit;
}

function savFormatLabel(format: number) {
  const type = format & 0xff;
  const width = (format >> 16) & 0xff;
  const decimals = (format >> 8) & 0xff;
  return `SPSS format ${type}${width ? ` width ${width}` : ""}${decimals ? ` decimals ${decimals}` : ""}`;
}

function normalizeSavNumeric(value: number, systemMissing = -Number.MAX_VALUE) {
  if (!Number.isFinite(value) || value === systemMissing) return "";
  return value.toString();
}

function parseSavValueLabelValue(bytes: Uint8Array, variable: SavVariable | undefined, view: DataView, offset: number, systemMissing: number) {
  if (variable?.type === "string") return decodeSavText(bytes.slice(offset, offset + 8));
  return normalizeSavNumeric(readFloat64(view, offset), systemMissing);
}

function materializeSavCase(chunks: Uint8Array[], variables: SavVariable[], systemMissing: number) {
  const row: string[] = [];
  let chunkIndex = 0;
  variables.forEach((variable) => {
    if (variable.type === "numeric") {
      row.push(normalizeSavNumeric(new DataView(chunks[chunkIndex].buffer, chunks[chunkIndex].byteOffset, 8).getFloat64(0, true), systemMissing));
      chunkIndex += 1;
      return;
    }
    const valueBytes = new Uint8Array(variable.recordSpan * 8);
    chunks.slice(chunkIndex, chunkIndex + variable.recordSpan).forEach((chunk, index) => valueBytes.set(chunk, index * 8));
    row.push(decodeSavText(valueBytes.slice(0, variable.width)));
    chunkIndex += variable.recordSpan;
  });
  return row;
}

function parseSavImport(buffer: ArrayBuffer, limits?: DatasetImportLimits): ParsedTabularData {
  if (!looksLikeSav(buffer)) throw new Error("This does not look like a valid SPSS .sav file.");
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const compression = readInt32(view, 72);
  const nominalCaseSize = readInt32(view, 68);
  if (nominalCaseSize < 1) throw new DatasetImportIntegrityError("SAV case width is invalid. No partial study was imported; keep the original file.");
  if (limits && (nominalCaseSize < 1 || nominalCaseSize > limits.maxPhysicalSlots)) {
    throw new DatasetImportLimitError("The SAV record width exceeds the local import size limit.");
  }
  const caseCount = readInt32(view, 80);
  const bias = readFloat64(view, 84);
  const variables: SavVariable[] = [];
  const variableNames = new Set<string>();
  const recordToVariable = new Map<number, SavVariable>();
  const pendingValueLabels: Record<string, string>[] = [];
  const linkedValueLabels: Array<{ variable: SavVariable; labels: Record<string, string> }> = [];
  let systemMissing = -Number.MAX_VALUE;
  let hasSystemMissingInfo = false;
  let offset = 176;
  let recordIndex = 0;
  let lastVariable: SavVariable | null = null;

  while (offset + 4 <= bytes.length) {
    const recordType = readInt32(view, offset);
    offset += 4;
    if (recordType === 999) {
      offset += 4;
      break;
    }

    if (recordType === 2) {
      const typeCode = readInt32(view, offset);
      const hasLabel = readInt32(view, offset + 4);
      const missingCount = readInt32(view, offset + 8);
      const printFormat = readInt32(view, offset + 12);
      const name = decodeSavText(bytes.slice(offset + 20, offset + 28));
      offset += 28;
      let label = "";
      if (hasLabel) {
        const labelLength = readInt32(view, offset);
        offset += 4;
        label = decodeSavText(bytes.slice(offset, offset + labelLength));
        offset += paddedLength(labelLength, 4);
      }
      if (missingCount > 0) offset += missingCount * 8;

      recordIndex += 1;
      if (limits && recordIndex > limits.maxPhysicalSlots) throw new DatasetImportLimitError("The SAV dictionary exceeds the local import record-width limit.");
      if (typeCode === -1 && lastVariable) {
        lastVariable.recordSpan += 1;
        recordToVariable.set(recordIndex, lastVariable);
      } else {
        if (!name || variableNames.has(name)) throw new DatasetImportIntegrityError("SAV has an empty or repeated variable name. Repair or re-export the source file; no study was imported.");
        variableNames.add(name);
        const variable: SavVariable = {
          name,
          label: label || humanizeHeader(name) || name,
          type: typeCode === 0 ? "numeric" : "string",
          width: typeCode === 0 ? 8 : typeCode,
          recordIndex,
          recordSpan: 1,
          sourceFormat: savFormatLabel(printFormat)
        };
        variables.push(variable);
        checkImportBudget(0, variables.length, limits);
        recordToVariable.set(recordIndex, variable);
        lastVariable = variable;
      }
    } else if (recordType === 3) {
      const labelCount = readInt32(view, offset);
      offset += 4;
      const labels: Record<string, string> = {};
      for (let index = 0; index < labelCount; index += 1) {
        const rawOffset = offset;
        const labelLength = bytes[offset + 8] ?? 0;
        const label = decodeSavText(bytes.slice(offset + 9, offset + 9 + labelLength));
        labels[`__raw_${index}`] = JSON.stringify({ rawOffset, label });
        offset += 8 + paddedLength(labelLength + 1, 8);
      }
      pendingValueLabels.push(labels);
    } else if (recordType === 4) {
      const variableCount = readInt32(view, offset);
      offset += 4;
      const linkedVariables = Array.from({ length: variableCount }, () => {
        const variableIndex = readInt32(view, offset);
        offset += 4;
        return recordToVariable.get(variableIndex);
      }).filter(Boolean) as SavVariable[];
      const labels = pendingValueLabels.shift();
      if (labels) {
        linkedVariables.forEach(variable => linkedValueLabels.push({ variable, labels }));
      }
    } else if (recordType === 6) {
      const lineCount = readInt32(view, offset);
      offset += 4 + lineCount * 80;
    } else if (recordType === 7) {
      if (offset + 12 > bytes.length) throw new DatasetImportIntegrityError("SAV extension metadata header is incomplete. No partial study was imported; keep the original file.");
      const subtype = readInt32(view, offset);
      const size = readInt32(view, offset + 4);
      const count = readInt32(view, offset + 8);
      if (subtype === 4) {
        if (size !== 8 || count !== 3 || offset + 36 > bytes.length) throw new DatasetImportIntegrityError("SAV missing-value metadata is incomplete or unsupported. No partial study was imported; keep the original file.");
        const marker = readFloat64(view, offset + 12);
        if (!Number.isFinite(marker) || hasSystemMissingInfo && marker !== systemMissing) throw new DatasetImportIntegrityError("SAV missing-value metadata is invalid or conflicting. No partial study was imported; keep the original file.");
        systemMissing = marker;
        hasSystemMissingInfo = true;
      }
      offset += 12 + size * count;
    } else {
      throw new Error(`Unsupported SAV dictionary record type ${recordType}.`);
    }
  }

  if (variables.some(variable => variable.recordSpan !== (variable.type === "numeric" ? 1 : Math.ceil(variable.width / 8)))) {
    throw new DatasetImportIntegrityError("SAV variable continuation layout is incomplete or inconsistent. No partial study was imported; keep the original file.");
  }

  // Floating-point metadata follows value labels. Resolve numeric codes only
  // after the complete dictionary establishes the file's missing marker.
  linkedValueLabels.forEach(({ variable, labels }) => {
    const resolved: Record<string, string> = {};
    Object.values(labels).forEach(encoded => {
      const { rawOffset, label } = JSON.parse(encoded) as { rawOffset: number; label: string };
      const key = parseSavValueLabelValue(bytes, variable, view, rawOffset, systemMissing);
      if (key) resolved[key] = label;
    });
    variable.valueLabels = { ...(variable.valueLabels ?? {}), ...resolved };
  });

  if (!variables.length) throw new Error("SAV file did not contain readable variable metadata.");
  if (caseCount > 0) checkImportBudget(caseCount, variables.length, limits);
  function appendCase(rows: string[][], chunks: Uint8Array[]) {
    checkImportBudget(rows.length + 1, variables.length, limits);
    const row = materializeSavCase(chunks, variables, systemMissing);
    if (limits && row.some(value => value.length > limits.maxValueChars)) throw new DatasetImportLimitError("A SAV value exceeds the local import size limit.");
    rows.push(row);
  }

  function readUncompressedCases() {
    const rows: string[][] = [];
    const knownCases = caseCount > 0 ? caseCount : Number.POSITIVE_INFINITY;
    const caseBytes = nominalCaseSize * 8;
    const remaining = bytes.length - offset;
    if (caseCount > 0 ? Math.floor(remaining / caseBytes) !== caseCount || remaining % caseBytes !== 0 : remaining % caseBytes !== 0) {
      throw new DatasetImportIntegrityError("SAV case data is truncated, incomplete or inconsistent with its declared case count. No partial study was imported; keep the original file.");
    }
    while (offset + nominalCaseSize * 8 <= bytes.length && rows.length < knownCases) {
      const chunks = Array.from({ length: nominalCaseSize }, () => {
        const chunk = bytes.slice(offset, offset + 8);
        offset += 8;
        return chunk;
      });
      appendCase(rows, chunks);
    }
    return rows;
  }

  function readCompressedCases() {
    const rows: string[][] = [];
    let controls: number[] = [];
    let controlIndex = 8;
    function nextChunk(): Uint8Array | null {
      while (true) {
        if (controlIndex >= controls.length) {
          if (offset + 8 > bytes.length) {
            if (offset !== bytes.length) throw new DatasetImportIntegrityError("SAV compressed control data is truncated. No partial study was imported; keep the original file.");
            return null;
          }
          controls = Array.from(bytes.slice(offset, offset + 8));
          offset += 8;
          controlIndex = 0;
        }
        const code = controls[controlIndex++];
        if (code === 0) continue;
        if (code === 252) return null;
        if (code === 253) {
          if (offset + 8 > bytes.length) throw new DatasetImportIntegrityError("SAV compressed value data is truncated. No partial study was imported; keep the original file.");
          const raw = bytes.slice(offset, offset + 8);
          offset += 8;
          return raw;
        }
        if (code === 254) return new Uint8Array(8).fill(0x20);
        if (code === 255) {
          const raw = new Uint8Array(8);
          new DataView(raw.buffer).setFloat64(0, Number.NaN, true);
          return raw;
        }
        const raw = new Uint8Array(8);
        new DataView(raw.buffer).setFloat64(0, code - bias, true);
        return raw;
      }
    }

    while (caseCount < 0 || rows.length < caseCount) {
      const chunks: Uint8Array[] = [];
      for (let index = 0; index < nominalCaseSize; index += 1) {
        const chunk = nextChunk();
        if (!chunk) {
          if (chunks.length || caseCount > 0 && rows.length < caseCount) throw new DatasetImportIntegrityError("SAV compressed case data is truncated or incomplete. No partial study was imported; keep the original file.");
          return rows;
        }
        chunks.push(chunk);
      }
      appendCase(rows, chunks);
    }
    if (caseCount > 0 && nextChunk()) throw new DatasetImportIntegrityError("SAV case data exceeds its declared case count. No partial study was imported; keep the original file.");
    return rows;
  }

  let caseDataNote: string | null = null;
  let rows: string[][] = [];
  try {
    if (compression === 0) {
      rows = readUncompressedCases();
    } else if (compression === 1) {
      rows = readCompressedCases();
    } else if (compression === 2 || decodeText(bytes.slice(0, 4)) === "$FL3") {
      caseDataNote = "This SAV file appears to use ZLIB-compressed case data, which is not supported yet; imported metadata without rows.";
    } else {
      caseDataNote = `This SAV file uses unsupported case-data compression ${compression}; imported metadata without rows.`;
    }
  } catch (error) {
    if (error instanceof DatasetImportLimitError || error instanceof DatasetImportIntegrityError) throw error;
    caseDataNote = error instanceof Error
      ? `Could not read SAV case rows: ${error.message}`
      : "Could not read SAV case rows; imported metadata without rows.";
    rows = [];
  }
  const headers = variables.map((variable) => variable.name);
  const fieldMetadata: Record<string, Partial<ImportedDatasetField>> = {};
  variables.forEach((variable) => {
    const hasValueLabels = Boolean(variable.valueLabels && Object.keys(variable.valueLabels).length);
    fieldMetadata[variable.name] = {
      label: variable.label,
      variableLabel: variable.label,
      valueLabels: variable.valueLabels,
      sourceFormat: variable.sourceFormat,
      type: variable.type === "numeric" && !hasValueLabels ? "numeric" : hasValueLabels ? "categorical" : "text",
      modelingRole: variable.type === "numeric" && !hasValueLabels ? "candidate_measure" : hasValueLabels ? "candidate_dimension" : "raw_variable",
      eligibleForFilter: hasValueLabels,
      eligibleForSegment: hasValueLabels,
      eligibleForBanner: hasValueLabels
    };
  });

  return {
    headers,
    rows,
    fieldMetadata,
    metadata: {
      formatLabel: "SAV survey metadata import",
      metadataQuality: "metadata_rich",
      parserNotes: [
        "Imported variable labels and value labels from the SPSS dictionary where available.",
        caseDataNote ?? (compression === 1 ? "Read standard SPSS compressed case data." : "Read uncompressed SPSS case data.")
      ]
    },
    notes: [
      "Initial model inferred from SAV variable metadata, variable labels, and value labels.",
      "SAV value labels are used for categorical display while raw codes remain stored in imported rows.",
      ...(caseDataNote ? [caseDataNote] : [])
    ]
  };
}

export async function importDatasetBuffer(
  buffer: ArrayBuffer,
  fileName: string,
  fileType: ImportedDatasetRecord["fileType"] = importedFileExtension(fileName),
  limits?: DatasetImportLimits
): Promise<DatasetImportResult> {
  try {
    if (limits && (![limits.maxRows, limits.maxFields, limits.maxCells, limits.maxValueChars, limits.maxPhysicalSlots].every(n => Number.isSafeInteger(n) && n > 0) ||
        limits.maxExpandedRowJsonChars !== undefined && (!Number.isSafeInteger(limits.maxExpandedRowJsonChars) || limits.maxExpandedRowJsonChars < 1))) {
      throw new Error("Invalid local import budgets.");
    }
    if (fileType === "csv") {
      const decoded = decodeCsvText(new Uint8Array(buffer));
      const parsed = parseCsvImport(decoded.text, limits);
      if (!parsed) return { error: "CSV import needs a header row and at least one data row." };
      parsed.metadata.parserNotes.push(`Decoded CSV text as ${decoded.encoding}.`);
      checkExpandedRows(parsed, limits);
      return { dataset: buildDataset({ name: fileName }, fileType, parsed) };
    }

    if (fileType === "sav") {
      const parsed = parseSavImport(buffer, limits);
      checkExpandedRows(parsed, limits);
      return { dataset: buildDataset({ name: fileName }, fileType, parsed) };
    }

    return { error: fileType === "xlsx"
      ? "XLSX server-side parsing is not enabled yet; use the browser parse path."
      : "Unsupported file type. Import CSV, XLSX, or classic SPSS SAV files." };
  } catch (error) {
    if (error instanceof DatasetImportIntegrityError) return { error: error.message, errorCode: "sav_case_integrity" };
    return { error: error instanceof Error ? error.message : "Dataset import failed." };
  }
}

export async function importDatasetFile(file: File, xlsxLimits: XlsxImportLimits = defaultXlsxImportLimits): Promise<DatasetImportResult> {
  const fileType = importedFileExtension(file.name);
  try {
    if (fileType === "csv") {
      return importDatasetBuffer(await file.arrayBuffer(), file.name, fileType);
    }

    if (fileType === "xlsx") {
      const parsed = await parseXlsxImport(file,xlsxLimits);
      return { dataset: buildDataset(file, fileType, parsed) };
    }

    if (fileType === "sav") {
      return importDatasetBuffer(await file.arrayBuffer(), file.name, fileType);
    }

    return { error: "Unsupported file type. Import CSV, XLSX, or classic SPSS SAV files." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Dataset import failed." };
  }
}
