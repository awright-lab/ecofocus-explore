import { validNumericProfileReply } from "./profileReplyValidation";
import type { ImportedDatasetField, ImportedDatasetRecord } from "../../../shared/types/dashboard";
import type { ImportedNumericProfile } from "./importedNumericProfile";
import { runColumnProfileJob, fieldProfileWorkerThreshold, type ColumnProfileProgress, type ColumnProfileWorker } from "./columnProfileJob";
export const numericProfileWorkerThreshold = fieldProfileWorkerThreshold;
export type NumericProfileProgress = ColumnProfileProgress;
export type NumericProfileWorker = ColumnProfileWorker<{ values: string[] }>;
export function runNumericProfileJob(dataset: ImportedDatasetRecord, field: ImportedDatasetField, options: {
  signal: AbortSignal; onProgress?: (progress: NumericProfileProgress) => void; createWorker?: () => NumericProfileWorker;
}): Promise<ImportedNumericProfile> {
  return runColumnProfileJob(dataset, field, { ...options, title: "numeric summary", request: values => ({ values }),
    createWorker: options.createWorker ?? (() => new Worker(new URL("./numericProfile.worker.ts", import.meta.url), { type: "module" })),
    accept: validNumericProfileReply });
}
