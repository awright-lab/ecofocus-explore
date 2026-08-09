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
  fieldMetadata?: Record<string, Partial<ImportedDatasetField>>;
}

interface DatasetBuildSource {
  name: string;
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
  const dataRows = parsed.rows.filter((row) => row.some((cell) => cell.length > 0));
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

function decodeSavText(bytes: Uint8Array) {
  return new TextDecoder("windows-1252").decode(bytes).replace(/\0+$/g, "").trim();
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

function normalizeSavNumeric(value: number) {
  if (!Number.isFinite(value) || Math.abs(value) > 1e100) return "";
  return Number.isInteger(value) ? value.toString() : value.toString();
}

function parseSavValueLabelValue(bytes: Uint8Array, variable: SavVariable | undefined, view: DataView, offset: number) {
  if (variable?.type === "string") return decodeSavText(bytes.slice(offset, offset + 8));
  return normalizeSavNumeric(readFloat64(view, offset));
}

function materializeSavCase(chunks: Uint8Array[], variables: SavVariable[]) {
  const row: string[] = [];
  let chunkIndex = 0;
  variables.forEach((variable) => {
    if (variable.type === "numeric") {
      row.push(normalizeSavNumeric(new DataView(chunks[chunkIndex].buffer, chunks[chunkIndex].byteOffset, 8).getFloat64(0, true)));
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

function parseSavImport(buffer: ArrayBuffer): ParsedTabularData {
  if (!looksLikeSav(buffer)) throw new Error("This does not look like a valid SPSS .sav file.");
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const compression = readInt32(view, 72);
  const nominalCaseSize = readInt32(view, 68);
  const caseCount = readInt32(view, 80);
  const bias = readFloat64(view, 84);
  const variables: SavVariable[] = [];
  const recordToVariable = new Map<number, SavVariable>();
  const pendingValueLabels: Record<string, string>[] = [];
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
      if (typeCode === -1 && lastVariable) {
        lastVariable.recordSpan += 1;
        recordToVariable.set(recordIndex, lastVariable);
      } else {
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
        linkedVariables.forEach((variable) => {
          const resolved: Record<string, string> = {};
          Object.values(labels).forEach((encoded) => {
            const { rawOffset, label } = JSON.parse(encoded) as { rawOffset: number; label: string };
            const key = parseSavValueLabelValue(bytes, variable, view, rawOffset);
            if (key) resolved[key] = label;
          });
          variable.valueLabels = { ...(variable.valueLabels ?? {}), ...resolved };
        });
      }
    } else if (recordType === 6) {
      const lineCount = readInt32(view, offset);
      offset += 4 + lineCount * 80;
    } else if (recordType === 7) {
      const size = readInt32(view, offset + 4);
      const count = readInt32(view, offset + 8);
      offset += 12 + size * count;
    } else {
      throw new Error(`Unsupported SAV dictionary record type ${recordType}.`);
    }
  }

  if (!variables.length) throw new Error("SAV file did not contain readable variable metadata.");

  function readUncompressedCases() {
    const rows: string[][] = [];
    const knownCases = caseCount > 0 ? caseCount : Number.POSITIVE_INFINITY;
    while (offset + nominalCaseSize * 8 <= bytes.length && rows.length < knownCases) {
      const chunks = Array.from({ length: nominalCaseSize }, () => {
        const chunk = bytes.slice(offset, offset + 8);
        offset += 8;
        return chunk;
      });
      rows.push(materializeSavCase(chunks, variables));
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
          if (offset + 8 > bytes.length) return null;
          controls = Array.from(bytes.slice(offset, offset + 8));
          offset += 8;
          controlIndex = 0;
        }
        const code = controls[controlIndex++];
        if (code === 0) continue;
        if (code === 252) return null;
        if (code === 253) {
          if (offset + 8 > bytes.length) return null;
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
        if (!chunk) return rows;
        chunks.push(chunk);
      }
      rows.push(materializeSavCase(chunks, variables));
    }
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
  fileType: ImportedDatasetRecord["fileType"] = importedFileExtension(fileName)
): Promise<DatasetImportResult> {
  try {
    if (fileType === "csv") {
      const parsed = parseCsvImport(decodeText(new Uint8Array(buffer)));
      if (!parsed) return { error: "CSV import needs a header row and at least one data row." };
      return { dataset: buildDataset({ name: fileName }, fileType, parsed) };
    }

    if (fileType === "sav") {
      const parsed = parseSavImport(buffer);
      return { dataset: buildDataset({ name: fileName }, fileType, parsed) };
    }

    return { error: fileType === "xlsx"
      ? "XLSX server-side parsing is not enabled yet; use the browser parse path."
      : "Unsupported file type. Import CSV, XLSX, or classic SPSS SAV files." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Dataset import failed." };
  }
}

export async function importDatasetFile(file: File): Promise<DatasetImportResult> {
  const fileType = importedFileExtension(file.name);
  try {
    if (fileType === "csv") {
      return importDatasetBuffer(await file.arrayBuffer(), file.name, fileType);
    }

    if (fileType === "xlsx") {
      const parsed = await parseXlsxImport(file);
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
