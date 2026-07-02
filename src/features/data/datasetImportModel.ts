import type { ImportedDatasetField, ImportedDatasetRecord } from "../../../shared/types/dashboard";

export interface DatasetImportResult {
  dataset?: ImportedDatasetRecord;
  error?: string;
}

function slug(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return normalized || "field";
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

function inferField(header: string, values: string[], index: number, rowCount: number): ImportedDatasetField {
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

  return {
    id: `${slug(header)}_${index + 1}`,
    label: header || `Column ${index + 1}`,
    sourceColumn: header || `Column ${index + 1}`,
    type,
    nonEmptyCount: values.filter(Boolean).length,
    distinctCount: distinctValues.length,
    sampleValues: distinctValues.slice(0, 5),
    modelingRole
  };
}

function fileExtension(fileName: string): ImportedDatasetRecord["fileType"] {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension === "csv" || extension === "xlsx" || extension === "sav") return extension;
  return "unknown";
}

export async function importDatasetFile(file: File): Promise<DatasetImportResult> {
  const fileType = fileExtension(file.name);
  if (fileType === "xlsx") {
    return { error: "XLSX import is not enabled yet. This pass supports CSV ingestion and stores the modeling path for workbook support next." };
  }
  if (fileType === "sav") {
    return { error: "SPSS .sav import is deferred until a proper metadata parser is added." };
  }
  if (fileType !== "csv") {
    return { error: "Unsupported file type. Import a CSV file for this foundation pass." };
  }

  const text = await file.text();
  const parsed = parseCsv(text);
  if (parsed.length < 2) return { error: "CSV import needs a header row and at least one data row." };

  const headers = parsed[0].map((header, index) => header || `Column ${index + 1}`);
  const dataRows = parsed.slice(1).filter((row) => row.some((cell) => cell.length > 0));
  const fields = headers.map((header, columnIndex) => inferField(
    header,
    dataRows.map((row) => row[columnIndex] ?? ""),
    columnIndex,
    dataRows.length
  ));
  const previewRows = dataRows.slice(0, 25).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));

  return {
    dataset: {
      id: datasetId(file.name),
      title: file.name.replace(/\.[^.]+$/, ""),
      sourceType: "local_file",
      fileName: file.name,
      fileType,
      importedAt: new Date().toISOString(),
      rowCount: dataRows.length,
      fieldCount: fields.length,
      fields,
      previewRows,
      modelingStatus: "initial_model",
      notes: [
        "Initial model inferred from imported CSV columns.",
        "Filters, segments, banners, and survey metadata still require explicit modeling."
      ]
    }
  };
}
