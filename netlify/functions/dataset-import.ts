import { getDatabase, MissingDatabaseConnectionError } from "@netlify/database";
import { connectLambda, getStore } from "@netlify/blobs";
import type { Handler } from "@netlify/functions";
import { createRequire } from "node:module";
import type { ImportedDatasetField, ImportedDatasetRecord } from "../../shared/types/dashboard";
import { importDatasetBuffer, importedFileExtension } from "../../src/features/data/datasetImportModel";

const jsonHeaders = {
  "Content-Type": "application/json"
};

interface SavReaderVariable {
  name: string;
  label?: string;
  type: number;
  printFormat?: { typestr?: string; width?: number; nbdec?: number };
  __is_child_string_var?: boolean;
}

interface SavReaderInstance {
  meta: {
    sysvars: SavReaderVariable[];
    getValueLabels: (varname: string) => Array<{ val: number | string; label: string }>;
  };
  open: () => Promise<void>;
  readAllRows: (includeNulls?: boolean) => Promise<Array<Record<string, unknown>>>;
}

const require = createRequire(import.meta.url);
const { SavBufferReader } = require("sav-reader") as {
  SavBufferReader: new (buffer: Buffer) => SavReaderInstance;
};

interface DatasetImportRequest {
  dataset?: ImportedDatasetRecord;
  fileName: string;
  fileType?: ImportedDatasetRecord["fileType"];
  contentType?: string;
  contentBase64: string;
}

function errorResponse(statusCode: number, error: string, details?: string[]) {
  return {
    statusCode,
    headers: jsonHeaders,
    body: JSON.stringify({ error, details })
  };
}

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, "_");
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

function objectPath(dataset: ImportedDatasetRecord, fileName: string) {
  return `workspace-imports/${dataset.id}/${safeFileName(fileName)}`;
}

function status(
  nextStatus: NonNullable<ImportedDatasetRecord["importStatus"]>["status"],
  label: string,
  detail: string
): NonNullable<ImportedDatasetRecord["importStatus"]> {
  return {
    status: nextStatus,
    label,
    detail,
    updatedAt: new Date().toISOString()
  };
}

function parseRequest(body: string): DatasetImportRequest {
  const payload = JSON.parse(body) as Partial<DatasetImportRequest>;
  if (!payload.fileName) throw new Error("Missing uploaded file name.");
  if (!payload.contentBase64) throw new Error("Missing uploaded file content.");
  return payload as DatasetImportRequest;
}

function jsonValue(value: unknown) {
  return value === undefined ? null : JSON.stringify(value);
}

function thinDatasetForClient(dataset: ImportedDatasetRecord): ImportedDatasetRecord {
  const previewRows = dataset.previewRows?.length ? dataset.previewRows : selectRepresentativePreviewRows(dataset.rows, dataset.fields, 50);
  const note = dataset.rows.length > previewRows.length
    ? "Full imported rows are stored server-side; this browser workspace keeps metadata and preview rows for performance."
    : null;
  return {
    ...dataset,
    rows: [],
    previewRows,
    notes: note && !dataset.notes.includes(note) ? [...dataset.notes, note] : dataset.notes
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

function stringifySavValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" && !Number.isFinite(value)) return "";
  return String(value);
}

function savRowValue(row: Record<string, unknown>, variableName: string) {
  if (Object.prototype.hasOwnProperty.call(row, variableName)) return row[variableName];
  const matchingKey = Object.keys(row).find((key) => key.toLowerCase() === variableName.toLowerCase());
  return matchingKey ? row[matchingKey] : undefined;
}

function buildSavReaderField(
  variable: {
    name: string;
    label?: string;
    type: number;
    printFormat?: { typestr?: string; width?: number; nbdec?: number };
  },
  values: string[],
  columnIndex: number,
  valueLabels: Record<string, string>
): ImportedDatasetField {
  const distinctValues = Array.from(new Set(values.filter(Boolean)));
  const hasValueLabels = Object.keys(valueLabels).length > 0;
  const sourceColumn = variable.name;
  const isNumeric = variable.type === 0;
  const type: ImportedDatasetField["type"] = isNumeric && !hasValueLabels ? "numeric" : hasValueLabels ? "categorical" : "text";
  const label = variable.label || humanizeHeader(sourceColumn) || sourceColumn;
  const formatParts = [
    variable.printFormat?.typestr,
    variable.printFormat?.width ? `width ${variable.printFormat.width}` : null,
    variable.printFormat?.nbdec ? `${variable.printFormat.nbdec} decimals` : null
  ].filter(Boolean);

  return {
    id: `${slug(sourceColumn)}_${columnIndex + 1}`,
    label,
    sourceColumn,
    variableLabel: variable.label || undefined,
    valueLabels: hasValueLabels ? valueLabels : undefined,
    sourceFormat: formatParts.length ? formatParts.join(" ") : undefined,
    type,
    nonEmptyCount: values.filter(Boolean).length,
    distinctCount: distinctValues.length,
    sampleValues: distinctValues.slice(0, 5),
    modelingRole: type === "numeric" ? "candidate_measure" : type === "categorical" ? "candidate_dimension" : "raw_variable",
    eligibleForFilter: type === "categorical",
    eligibleForSegment: type === "categorical",
    eligibleForBanner: type === "categorical"
  };
}

async function parseSavWithSavReader(fileBuffer: Buffer, fileName: string): Promise<ImportedDatasetRecord> {
  const reader = new SavBufferReader(fileBuffer);
  await reader.open();
  const rawRows = await reader.readAllRows(true);
  const variables = reader.meta.sysvars.filter((variable) => !variable.__is_child_string_var);
  const rows = rawRows.map((row) =>
    Object.fromEntries(variables.map((variable) => [variable.name, stringifySavValue(savRowValue(row, variable.name))]))
  );
  const fields = variables.map((variable, columnIndex) => {
    const labels = Object.fromEntries(
      reader.meta.getValueLabels(variable.name).map((entry: { val: number | string; label: string }) => [stringifySavValue(entry.val), entry.label])
    );
    return buildSavReaderField(variable, rows.map((row) => row[variable.name] ?? ""), columnIndex, labels);
  });

  return {
    id: datasetId(fileName),
    title: fileName.replace(/\.[^.]+$/, ""),
    sourceType: "local_file",
    fileName,
    fileType: "sav",
    importMetadata: {
      formatLabel: "SAV survey metadata import",
      metadataQuality: "metadata_rich",
      parserNotes: [
        "Imported variable labels and value labels with the Netlify SAV parser fallback.",
        `Read ${rows.length.toLocaleString()} respondent rows with sav-reader.`
      ]
    },
    importedAt: new Date().toISOString(),
    rowCount: rows.length,
    fieldCount: fields.length,
    fields,
    rows,
    previewRows: selectRepresentativePreviewRows(rows, fields, 50),
    modelingStatus: "initial_model",
    notes: [
      "Initial model inferred from SAV variable metadata, variable labels, and value labels.",
      "SAV value labels are used for categorical display while raw codes remain stored in imported rows.",
      "Rows were recovered by the Netlify SAV parser fallback."
    ]
  };
}

async function insertDatasetFields(pool: ReturnType<typeof getDatabase>["pool"], datasetId: string, fields: ImportedDatasetField[]) {
  await pool.query("delete from imported_dataset_fields where dataset_id = $1", [datasetId]);

  for (const field of fields) {
    await pool.query(
      `insert into imported_dataset_fields (
        dataset_id,
        field_id,
        label,
        source_column,
        variable_label,
        value_labels,
        source_format,
        field_type,
        non_empty_count,
        distinct_count,
        sample_values,
        modeling_role,
        eligible_for_filter,
        eligible_for_segment,
        eligible_for_banner,
        updated_at
      ) values (
        $1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11::jsonb, $12, $13, $14, $15, now()
      )`,
      [
        datasetId,
        field.id,
        field.label,
        field.sourceColumn,
        field.variableLabel ?? null,
        jsonValue(field.valueLabels ?? null),
        field.sourceFormat ?? null,
        field.type,
        field.nonEmptyCount,
        field.distinctCount,
        jsonValue(field.sampleValues),
        field.modelingRole,
        field.eligibleForFilter,
        field.eligibleForSegment,
        field.eligibleForBanner
      ]
    );
  }
}

async function insertDatasetRows(pool: ReturnType<typeof getDatabase>["pool"], dataset: ImportedDatasetRecord) {
  await pool.query("delete from imported_dataset_rows where dataset_id = $1", [dataset.id]);

  const chunkSize = 250;
  for (let start = 0; start < dataset.rows.length; start += chunkSize) {
    const rows = dataset.rows.slice(start, start + chunkSize);
    const values: unknown[] = [];
    const placeholders = rows.map((row, index) => {
      const paramOffset = index * 3;
      values.push(dataset.id, start + index, JSON.stringify(row));
      return `($${paramOffset + 1}, $${paramOffset + 2}, $${paramOffset + 3}::jsonb)`;
    });

    await pool.query(
      `insert into imported_dataset_rows (dataset_id, row_index, row_data)
        values ${placeholders.join(", ")}`,
      values
    );
  }
}

async function writeImportedDatasetToDatabase(dataset: ImportedDatasetRecord) {
  try {
    const { pool } = getDatabase();
    await pool.query("begin");

    try {
      await pool.query(
        `insert into imported_datasets (
          id,
          title,
          file_name,
          file_type,
          source_type,
          row_count,
          field_count,
          imported_at,
          import_status,
          import_metadata,
          remote,
          notes,
          updated_at
        ) values (
          $1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb, now()
        )
        on conflict (id) do update set
          title = excluded.title,
          file_name = excluded.file_name,
          file_type = excluded.file_type,
          source_type = excluded.source_type,
          row_count = excluded.row_count,
          field_count = excluded.field_count,
          imported_at = excluded.imported_at,
          import_status = excluded.import_status,
          import_metadata = excluded.import_metadata,
          remote = excluded.remote,
          notes = excluded.notes,
          updated_at = now()`,
        [
          dataset.id,
          dataset.title,
          dataset.fileName,
          dataset.fileType,
          dataset.sourceType,
          dataset.rowCount,
          dataset.fieldCount,
          dataset.importedAt,
          jsonValue(dataset.importStatus ?? null),
          jsonValue(dataset.importMetadata ?? null),
          jsonValue(dataset.remote ?? null),
          jsonValue(dataset.notes)
        ]
      );

      await insertDatasetFields(pool, dataset.id, dataset.fields);
      await insertDatasetRows(pool, dataset);
      await pool.query("commit");

      return { stored: true as const };
    } catch (error) {
      await pool.query("rollback").catch(() => undefined);
      throw error;
    }
  } catch (error) {
    if (error instanceof MissingDatabaseConnectionError) {
      return {
        stored: false as const,
        warning: "Netlify Database is not connected for this deploy yet, so the source file was stored in Netlify Blobs only."
      };
    }

    return {
      stored: false as const,
      warning: error instanceof Error ? error.message : "Netlify Database write failed."
    };
  }
}

async function buildDatasetForUpload(request: DatasetImportRequest, fileBuffer: Buffer) {
  const fileType = request.fileType ?? request.dataset?.fileType ?? importedFileExtension(request.fileName);
  const shouldParseServerSide = fileType === "sav" || !request.dataset;
  const parseResult = shouldParseServerSide
    ? await importDatasetBuffer(
        fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength) as ArrayBuffer,
        request.fileName,
        fileType
      )
    : { dataset: request.dataset };

  if (fileType === "sav" && (!parseResult.dataset || parseResult.dataset.rowCount === 0)) {
    try {
      const fallbackDataset = await parseSavWithSavReader(fileBuffer, request.fileName);
      if (fallbackDataset.rowCount > 0) {
        return {
          dataset: fallbackDataset,
          parsedServerSide: true,
          parserWarning: parseResult.dataset
            ? "The built-in SAV parser read labels only; Netlify recovered rows with the SAV parser fallback."
            : parseResult.error
              ? `The built-in SAV parser failed: ${parseResult.error}`
              : undefined
        };
      }
    } catch (error) {
      if (!parseResult.dataset) {
        throw error;
      }
      parseResult.dataset = {
        ...parseResult.dataset,
        notes: [
          ...parseResult.dataset.notes,
          `Netlify SAV parser fallback also could not read rows: ${error instanceof Error ? error.message : "Unknown parser error"}`
        ],
        importMetadata: parseResult.dataset.importMetadata
          ? {
              ...parseResult.dataset.importMetadata,
              parserNotes: [
                ...parseResult.dataset.importMetadata.parserNotes,
                `Netlify SAV parser fallback also could not read rows: ${error instanceof Error ? error.message : "Unknown parser error"}`
              ]
            }
          : parseResult.dataset.importMetadata
      };
    }
  }

  if (parseResult.dataset) {
    return {
      dataset: parseResult.dataset,
      parsedServerSide: shouldParseServerSide,
      parserWarning: undefined
    };
  }

  if (request.dataset) {
    return {
      dataset: request.dataset,
      parsedServerSide: false,
      parserWarning: parseResult.error ?? "Server-side parsing failed; using browser-parsed dataset metadata."
    };
  }

  throw new Error(parseResult.error ?? "Server-side dataset parsing failed.");
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return errorResponse(405, "Method not allowed. Use POST.");
  }

  if (!event.body) {
    return errorResponse(400, "Missing request body.");
  }

  try {
    connectLambda(event as unknown as Parameters<typeof connectLambda>[0]);
    const request = parseRequest(event.body);
    const fileBuffer = Buffer.from(request.contentBase64, "base64");
    const fileArrayBuffer = fileBuffer.buffer.slice(
      fileBuffer.byteOffset,
      fileBuffer.byteOffset + fileBuffer.byteLength
    );
    const fileStore = getStore(process.env.NETLIFY_DATASET_BLOB_STORE || "dataset-imports");
    const metadataStore = getStore(process.env.NETLIFY_DATASET_METADATA_STORE || "dataset-import-metadata");
    const uploadedAt = new Date().toISOString();
    const parsedUpload = await buildDatasetForUpload(request, fileBuffer);
    const path = objectPath(parsedUpload.dataset, request.fileName);

    await fileStore.set(path, fileArrayBuffer, {
      metadata: {
        datasetId: parsedUpload.dataset.id,
        fileName: request.fileName,
        fileType: parsedUpload.dataset.fileType,
        contentType: request.contentType || "application/octet-stream"
      }
    });

    const dataset: ImportedDatasetRecord = {
      ...parsedUpload.dataset,
      sourceType: "netlify",
      remote: {
        provider: "netlify",
        projectUrl: process.env.URL || process.env.DEPLOY_URL || "netlify",
        bucket: process.env.NETLIFY_DATASET_BLOB_STORE || "dataset-imports",
        objectPath: path,
        uploadedAt
      },
      importStatus: status(
        parsedUpload.dataset.rowCount > 0 ? "ready" : "metadata_only",
        parsedUpload.dataset.rowCount > 0
          ? parsedUpload.parsedServerSide ? "Parsed and stored by Netlify" : "Uploaded to Netlify"
          : "Uploaded to Netlify, labels only",
        [
          parsedUpload.dataset.rowCount > 0
            ? parsedUpload.parsedServerSide
              ? "The original source file was parsed in the Netlify function, stored in Netlify Blobs, and persisted to Netlify Database when available."
              : "The original source file is stored in Netlify Blobs and parsed rows are available in the workspace."
            : "The original source file is stored in Netlify Blobs, but respondent rows were not readable yet.",
          parsedUpload.parserWarning ? `Parser note: ${parsedUpload.parserWarning}` : null
        ].filter(Boolean).join(" ")
      )
    };

    const databaseResult = await writeImportedDatasetToDatabase(dataset);
    const currentImportStatus = dataset.importStatus ?? status(
      dataset.rowCount > 0 ? "ready" : "metadata_only",
      dataset.rowCount > 0 ? "Uploaded to Netlify" : "Uploaded to Netlify, labels only",
      "The dataset import completed."
    );
    const storedDataset: ImportedDatasetRecord = databaseResult.warning
      ? {
        ...dataset,
        importStatus: {
          ...currentImportStatus,
          detail: `${currentImportStatus.detail} Database note: ${databaseResult.warning}`,
          updatedAt: new Date().toISOString()
        }
      }
      : dataset;
    const responseDataset = thinDatasetForClient(storedDataset);

    await metadataStore.setJSON(`datasets/${responseDataset.id}.json`, responseDataset, {
      metadata: {
        datasetId: responseDataset.id,
        fileType: responseDataset.fileType,
        rowCount: responseDataset.rowCount,
        fieldCount: responseDataset.fieldCount
      }
    });

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({
        dataset: responseDataset,
        storage: {
          provider: "netlify",
          stored: true,
          objectPath: path,
          database: databaseResult.stored ? "stored" : "not_stored",
          databaseWarning: databaseResult.warning
        }
      })
    };
  } catch (error) {
    return errorResponse(500, "Netlify dataset import failed.", [error instanceof Error ? error.message : "Unknown error"]);
  }
};
