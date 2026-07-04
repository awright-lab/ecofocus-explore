import type { ImportedDatasetRecord } from "../../../shared/types/dashboard";
import { importDatasetFile } from "./datasetImportModel";
import { storeImportedDatasetInNetlify, type NetlifyDatasetStoreResult } from "./netlifyDatasetStore";
import { storeImportedDatasetInSupabase, type SupabaseDatasetStoreResult } from "./supabaseDatasetStore";

export interface WorkspaceDatasetImportResult {
  dataset?: ImportedDatasetRecord;
  error?: string;
  storage: Pick<SupabaseDatasetStoreResult | NetlifyDatasetStoreResult, "stored" | "warning"> & { provider: "local" | "netlify" | "supabase" };
}

function envValue(key: string) {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {};
  const processEnv = (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
  return (env[key] ?? processEnv[key] ?? "").trim();
}

function importProvider(): "local" | "netlify" | "supabase" {
  const provider = envValue("VITE_DATASET_IMPORT_PROVIDER").toLowerCase();
  if (provider === "local" || provider === "supabase" || provider === "netlify") return provider;
  return "netlify";
}

export async function importDatasetForWorkspace(file: File): Promise<WorkspaceDatasetImportResult> {
  const parsed = await importDatasetFile(file);
  if (parsed.error || !parsed.dataset) {
    return {
      error: parsed.error ?? "Dataset import failed.",
      storage: { provider: "local", stored: false }
    };
  }

  const provider = importProvider();
  if (provider === "local") {
    return {
      dataset: parsed.dataset,
      storage: { provider: "local", stored: false }
    };
  }

  const stored = provider === "supabase"
    ? await storeImportedDatasetInSupabase(file, parsed.dataset)
    : await storeImportedDatasetInNetlify(file, parsed.dataset);
  return {
    dataset: stored.dataset,
    storage: {
      provider,
      stored: stored.stored,
      warning: stored.warning
    }
  };
}

export function importedDatasetImportFeedback(dataset: ImportedDatasetRecord, storageWarning?: string) {
  const storagePrefix = dataset.remote?.provider ? "Uploaded" : "Imported";
  const rowLabel = dataset.rowCount > 0
    ? `${dataset.rowCount.toLocaleString()} rows and ${dataset.fieldCount} fields`
    : `${dataset.fieldCount} fields, but no respondent rows were readable yet`;
  return [
    `${storagePrefix} ${dataset.title} with ${rowLabel}.`,
    storageWarning ? `Storage note: ${storageWarning}` : null
  ].filter(Boolean).join(" ");
}
