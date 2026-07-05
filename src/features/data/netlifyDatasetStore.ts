import type { ImportedDatasetField, ImportedDatasetRecord } from "../../../shared/types/dashboard";

export interface NetlifyDatasetStoreResult {
  stored: boolean;
  dataset?: ImportedDatasetRecord;
  warning?: string;
}

export interface NetlifyDatasetFieldListResult {
  datasetId: string;
  fields: ImportedDatasetField[];
  total: number;
  offset: number;
  limit: number;
}

async function fileToBase64(file: File) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function localStatus(dataset: ImportedDatasetRecord, warning?: string): ImportedDatasetRecord["importStatus"] {
  return {
    status: dataset.rowCount > 0 ? "local_ready" : "metadata_only",
    label: dataset.rowCount > 0 ? "Stored locally" : "Labels only",
    detail: warning
      ? `Netlify upload was unavailable, so this import stayed local. ${warning}`
      : dataset.rowCount > 0
        ? "This imported dataset is stored in the local workspace."
        : "This imported dataset has labels/metadata but no readable respondent rows.",
    updatedAt: new Date().toISOString()
  };
}

function thinRemoteDatasetForBrowser(dataset: ImportedDatasetRecord): ImportedDatasetRecord {
  if (dataset.remote?.provider !== "netlify") return dataset;
  const previewRows = dataset.previewRows?.length ? dataset.previewRows : dataset.rows.slice(0, 50);
  const fieldPreview = dataset.fields.slice(0, 80);
  const note = "Full imported rows are stored server-side; this browser workspace keeps metadata and preview rows for performance.";
  const fieldNote = dataset.fields.length > fieldPreview.length
    ? "Full imported field metadata is loaded from Netlify Database as needed in the Data Library."
    : null;
  return {
    ...dataset,
    fields: fieldPreview,
    rows: [],
    previewRows,
    notes: [
      ...dataset.notes,
      dataset.notes.includes(note) ? null : note,
      fieldNote && !dataset.notes.includes(fieldNote) ? fieldNote : null
    ].filter(Boolean) as string[]
  };
}

function isFieldListError(payload: unknown): payload is { error?: string; details?: string[] } {
  return Boolean(payload && typeof payload === "object" && "error" in payload);
}

export async function listImportedDatasetFieldsFromNetlify(options: {
  datasetId: string;
  offset: number;
  limit: number;
  search?: string;
}): Promise<NetlifyDatasetFieldListResult> {
  const params = new URLSearchParams({
    datasetId: options.datasetId,
    offset: String(options.offset),
    limit: String(options.limit)
  });
  if (options.search?.trim()) params.set("search", options.search.trim());

  const response = await fetch(`/.netlify/functions/imported-dataset-fields?${params.toString()}`);
  const payload = await response.json().catch(() => null) as unknown;
  if (!response.ok || !payload || isFieldListError(payload)) {
    const detail = isFieldListError(payload) && payload.details?.length ? ` ${payload.details.join(" ")}` : "";
    throw new Error(`${isFieldListError(payload) ? payload.error : `Imported dataset fields failed with ${response.status}.`}${detail}`);
  }
  return payload as NetlifyDatasetFieldListResult;
}

export async function storeImportedDatasetInNetlify(file: File, dataset?: ImportedDatasetRecord): Promise<NetlifyDatasetStoreResult> {
  try {
    const response = await fetch("/.netlify/functions/dataset-import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        dataset,
        fileName: file.name,
        fileType: dataset?.fileType,
        contentType: file.type || "application/octet-stream",
        contentBase64: await fileToBase64(file)
      })
    });
    const payload = await response.json().catch(() => null) as
      | { dataset?: ImportedDatasetRecord; storage?: { stored?: boolean }; error?: string; details?: string[] }
      | null;

    if (!response.ok || !payload?.dataset) {
      const details = payload?.details?.length ? ` ${payload.details.join(" ")}` : "";
      throw new Error(`${payload?.error ?? `Netlify import failed with ${response.status}.`}${details}`);
    }

    return {
      stored: Boolean(payload.storage?.stored),
      dataset: thinRemoteDatasetForBrowser(payload.dataset)
    };
  } catch (error) {
    const warning = error instanceof Error ? error.message : "Netlify import endpoint is unavailable.";
    if (!dataset) {
      return {
        stored: false,
        warning
      };
    }

    return {
      stored: false,
      warning,
      dataset: {
        ...dataset,
        importStatus: localStatus(dataset, warning)
      }
    };
  }
}
