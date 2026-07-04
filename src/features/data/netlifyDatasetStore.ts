import type { ImportedDatasetRecord } from "../../../shared/types/dashboard";

export interface NetlifyDatasetStoreResult {
  stored: boolean;
  dataset?: ImportedDatasetRecord;
  warning?: string;
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
      dataset: payload.dataset
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
