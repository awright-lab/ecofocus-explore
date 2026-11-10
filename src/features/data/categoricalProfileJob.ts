import { validCategoricalProfileReply } from "./profileReplyValidation";
import type { ImportedDatasetField, ImportedDatasetRecord } from "../../../shared/types/dashboard";
import type { ImportedCategoricalProfile } from "./importedCategoricalProfile";
import { runColumnProfileJob, type ColumnProfileProgress, type ColumnProfileWorker } from "./columnProfileJob";
export type CategoricalProfileWorker = ColumnProfileWorker<{ values: string[]; field: ImportedDatasetField }>;
export function runCategoricalProfileJob(dataset: ImportedDatasetRecord, field: ImportedDatasetField, options: {
  signal: AbortSignal; onProgress?: (progress: ColumnProfileProgress) => void; createWorker?: () => CategoricalProfileWorker;
}): Promise<ImportedCategoricalProfile> {
  return runColumnProfileJob(dataset, field, { ...options, title: "category summary", request: values => ({ values, field }),
    createWorker: options.createWorker ?? (() => new Worker(new URL("./categoricalProfile.worker.ts", import.meta.url), { type: "module" })),
    accept: validCategoricalProfileReply });
}
