import type { ImportedDatasetRecord } from "../../../shared/types/dashboard";

export interface SupabaseDatasetStoreConfig {
  enabled: boolean;
  url: string;
  anonKey: string;
  bucket: string;
  datasetTable: string;
}

export interface SupabaseDatasetStoreResult {
  stored: boolean;
  dataset: ImportedDatasetRecord;
  warning?: string;
}

function envValue(key: string) {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {};
  const processEnv = (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
  return (env[key] ?? processEnv[key] ?? "").trim();
}

function normalizeSupabaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function makeObjectPath(dataset: ImportedDatasetRecord) {
  const safeName = dataset.fileName.replace(/[^a-zA-Z0-9._-]+/g, "_");
  return `workspace-imports/${dataset.id}/${safeName}`;
}

function remoteStatus(
  status: NonNullable<ImportedDatasetRecord["importStatus"]>["status"],
  label: string,
  detail: string
): ImportedDatasetRecord["importStatus"] {
  return {
    status,
    label,
    detail,
    updatedAt: new Date().toISOString()
  };
}

export function getSupabaseDatasetStoreConfig(): SupabaseDatasetStoreConfig {
  const url = normalizeSupabaseUrl(envValue("VITE_SUPABASE_URL"));
  const anonKey = envValue("VITE_SUPABASE_ANON_KEY");
  return {
    enabled: Boolean(url && anonKey),
    url,
    anonKey,
    bucket: envValue("VITE_SUPABASE_DATASET_BUCKET") || "dataset-imports",
    datasetTable: envValue("VITE_SUPABASE_DATASET_TABLE") || "imported_datasets"
  };
}

function supabaseHeaders(config: SupabaseDatasetStoreConfig, contentType?: string) {
  return {
    apikey: config.anonKey,
    Authorization: `Bearer ${config.anonKey}`,
    ...(contentType ? { "Content-Type": contentType } : {})
  };
}

async function uploadDatasetFile(config: SupabaseDatasetStoreConfig, objectPath: string, file: File) {
  const response = await fetch(`${config.url}/storage/v1/object/${config.bucket}/${objectPath}`, {
    method: "POST",
    headers: {
      ...supabaseHeaders(config),
      "Content-Type": file.type || "application/octet-stream",
      "x-upsert": "true"
    },
    body: file
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Supabase file upload failed with ${response.status}.`);
  }
}

async function upsertDatasetRecord(config: SupabaseDatasetStoreConfig, dataset: ImportedDatasetRecord) {
  const response = await fetch(`${config.url}/rest/v1/${config.datasetTable}?on_conflict=id`, {
    method: "POST",
    headers: {
      ...supabaseHeaders(config, "application/json"),
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify({
      id: dataset.id,
      title: dataset.title,
      file_name: dataset.fileName,
      file_type: dataset.fileType,
      row_count: dataset.rowCount,
      field_count: dataset.fieldCount,
      import_status: dataset.importStatus,
      import_metadata: dataset.importMetadata,
      remote: dataset.remote,
      fields: dataset.fields,
      preview_rows: dataset.previewRows,
      notes: dataset.notes,
      imported_at: dataset.importedAt
    })
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Supabase dataset record save failed with ${response.status}.`);
  }
  const payload = await response.json().catch(() => []) as Array<{ id?: string }>;
  return payload[0]?.id;
}

export async function storeImportedDatasetInSupabase(file: File, dataset: ImportedDatasetRecord): Promise<SupabaseDatasetStoreResult> {
  const config = getSupabaseDatasetStoreConfig();
  const localStatus = remoteStatus(
    dataset.rowCount > 0 ? "local_ready" : "metadata_only",
    dataset.rowCount > 0 ? "Stored locally" : "Labels only",
    dataset.rowCount > 0
      ? "Supabase is not configured, so this imported dataset is stored in the local workspace."
      : "Supabase is not configured, and this SAV import only contains readable labels/metadata."
  );

  if (!config.enabled) {
    return {
      stored: false,
      dataset: {
        ...dataset,
        importStatus: localStatus
      }
    };
  }

  const objectPath = makeObjectPath(dataset);
  const uploadedAt = new Date().toISOString();
  try {
    await uploadDatasetFile(config, objectPath, file);
    const remoteDataset: ImportedDatasetRecord = {
      ...dataset,
      sourceType: "supabase",
      remote: {
        provider: "supabase",
        projectUrl: config.url,
        bucket: config.bucket,
        objectPath,
        uploadedAt
      },
      importStatus: remoteStatus(
        dataset.rowCount > 0 ? "ready" : "metadata_only",
        dataset.rowCount > 0 ? "Uploaded and ready" : "Uploaded, labels only",
        dataset.rowCount > 0
          ? "The source file is stored in Supabase and parsed rows are available in the workspace."
          : "The source file is stored in Supabase for future server-side parsing, but this browser pass only read labels/metadata."
      )
    };
    const recordId = await upsertDatasetRecord(config, remoteDataset);
    return {
      stored: true,
      dataset: {
        ...remoteDataset,
        remote: remoteDataset.remote ? { ...remoteDataset.remote, recordId: recordId ?? remoteDataset.remote.recordId } : remoteDataset.remote
      }
    };
  } catch (error) {
    return {
      stored: false,
      warning: error instanceof Error ? error.message : "Supabase dataset storage failed.",
      dataset: {
        ...dataset,
        importStatus: remoteStatus(
          dataset.rowCount > 0 ? "local_ready" : "metadata_only",
          dataset.rowCount > 0 ? "Stored locally after upload failed" : "Labels only; upload failed",
          error instanceof Error ? error.message : "Supabase dataset storage failed, so the import remained local."
        )
      }
    };
  }
}
