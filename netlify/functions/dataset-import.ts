import { getDatabase, MissingDatabaseConnectionError } from "@netlify/database";
import { connectLambda, getStore } from "@netlify/blobs";
import type { Handler } from "@netlify/functions";
import type { ImportedDatasetField, ImportedDatasetRecord } from "../../shared/types/dashboard";
import { importDatasetBuffer, importedFileExtension } from "../../src/features/data/datasetImportModel";

const jsonHeaders = {
  "Content-Type": "application/json"
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
    const responseDataset: ImportedDatasetRecord = databaseResult.warning
      ? {
        ...dataset,
        importStatus: {
          ...currentImportStatus,
          detail: `${currentImportStatus.detail} Database note: ${databaseResult.warning}`,
          updatedAt: new Date().toISOString()
        }
      }
      : dataset;

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
