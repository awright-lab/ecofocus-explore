import { ImportedSourceColumnAmbiguityError } from "./importedRawValue";
import type { ImportedDatasetField, ImportedDatasetRecord } from "../../../shared/types/dashboard";
import { importedRawFieldValue } from "./importedDatasetAnalytics";
export const fieldProfileWorkerThreshold = 5_000;
export type ColumnProfileProgress = { phase: "preparing"; prepared: number; total: number } | { phase: "calculating"; total: number };
export interface ColumnProfileWorker<Request> {
  postMessage: (message: Request) => void;
  terminate: () => void;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent) => void) | null;
}
export function runColumnProfileJob<Profile, Request>(dataset: ImportedDatasetRecord, field: ImportedDatasetField, options: {
  signal: AbortSignal; onProgress?: (progress: ColumnProfileProgress) => void; createWorker: () => ColumnProfileWorker<Request>;
  request: (values: string[]) => Request; accept: (profile: unknown, rowCount: number) => profile is Profile; title: string;
}): Promise<Profile> {
  return new Promise((resolve, reject) => {
    const rows = dataset.rows.length ? dataset.rows : dataset.previewRows;
    let worker: ColumnProfileWorker<Request> | null = null, timer: ReturnType<typeof setTimeout> | undefined, finished = false;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    function finish(error?: Error, profile?: Profile) {
      if (finished) return; finished = true;
      if (timer !== undefined) clearTimeout(timer);
      if (deadline !== undefined) clearTimeout(deadline);
      options.signal.removeEventListener("abort", cancel); worker?.terminate();
      if (error) reject(error); else resolve(profile!);
    }
    function cancel() { finish(new DOMException(`${options.title} canceled.`, "AbortError")); }
    if (options.signal.aborted) { cancel(); return; }
    options.signal.addEventListener("abort", cancel, { once: true });
    if (rows.length < dataset.rowCount) { finish(new Error("Complete respondent rows are unavailable. A partial preview cannot establish study-wide statistics.")); return; }
    const values: string[] = [];
    function prepare() {
      if (finished) return;
      try {
        const end = Math.min(rows.length, values.length + 2_000);
        for (let index = values.length; index < end; index += 1) values.push(importedRawFieldValue(rows[index], field));
        options.onProgress?.({ phase: "preparing", prepared: values.length, total: rows.length });
        if (finished) return;
        if (values.length < rows.length) { timer = setTimeout(prepare, 0); return; }
        worker = options.createWorker();
        worker.onmessage = event => {
          if (finished) return;
          const data = event.data;
          if (data?.type !== "complete" || !options.accept(data.profile, rows.length)) {
            finish(new Error(`The background ${options.title} failed. Retry without changing the study.`)); return;
          }
          finish(undefined, data.profile);
        };
        worker.onerror = worker.onmessageerror = () => finish(new Error(`Background ${options.title} is unavailable in this browser. Your study has not been changed.`));
        options.onProgress?.({ phase: "calculating", total: rows.length });
        if (!finished) worker.postMessage(options.request(values));
      } catch(error) { finish(error instanceof ImportedSourceColumnAmbiguityError ? error : new Error(`Background ${options.title} could not start. Your study has not been changed.`)); }
    }
    // Yield before copying selected values; never clone the entire study into a worker.
    deadline = setTimeout(() => finish(new Error(`Background ${options.title} stopped responding after 30 seconds. Your study has not been changed. Retry the summary.`)), 30_000);
    timer = setTimeout(prepare, 0);
  });
}
