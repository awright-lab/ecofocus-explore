import type { ImportedDatasetRecord } from "../../../shared/types/dashboard";
import { readSavedStudies } from "../document/workspaceStorageValidation";
import {
  localCsvLimits, localCsvHeaderChars, localCsvMaxBytes, localCsvPacketChars, localCsvExpandedRowsChars,
  type CsvImportMessage, type CsvImportRequest, type LocalCsvHeader,
} from "./localCsvImportProtocol";

export type LocalCsvProgress = { phase: "reading" } | { phase: "parsing" } | { phase: "receiving"; received: number; total: number };
export interface LocalCsvWorker {
  postMessage(message: CsvImportRequest): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<CsvImportMessage>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent) => void) | null;
}
const headerKeys = new Set(["id", "title", "sourceType", "fileName", "fileType", "importMetadata", "importedAt", "rowCount", "fieldCount", "fields", "modelingStatus", "notes"]);

export function runLocalCsvImport(file: File, options: {
  signal: AbortSignal;
  onProgress?: (progress: LocalCsvProgress) => void;
  createWorker?: () => LocalCsvWorker;
}): Promise<ImportedDatasetRecord> {
  return new Promise((resolve, reject) => {
    let worker: LocalCsvWorker | undefined, finished = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let header: LocalCsvHeader | undefined, previewIndexes: number[] = [];
    let rows: ImportedDatasetRecord["rows"] = [], sequence = 0, phase = 0, expandedCharacters = 2;
    function finish(error?: Error, dataset?: ImportedDatasetRecord) {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      options.signal.removeEventListener("abort", cancel);
      if (worker) { worker.onmessage = worker.onerror = worker.onmessageerror = null; worker.terminate(); }
      rows = []; header = undefined; previewIndexes = [];
      if (error) reject(error); else resolve(dataset!);
    }
    function cancel() { finish(new DOMException("Local import canceled. No study was added.", "AbortError")); }
    function armTimeout() { clearTimeout(timeout); timeout = setTimeout(() => finish(new Error("Local import stopped responding. Keep the source file and try again.")), 60_000); }
    if (options.signal.aborted) { cancel(); return; }
    if (!file.name.toLowerCase().endsWith(".csv") || file.size < 1 || file.size > localCsvMaxBytes) {
      finish(new Error("Choose a CSV file up to 16 MiB for local import.")); return;
    }
    options.signal.addEventListener("abort", cancel);
    try {
      worker = options.createWorker ? options.createWorker() : new Worker(new URL("./localCsvImport.worker.ts", import.meta.url), { type: "module" });
      worker.onerror = worker.onmessageerror = () => finish(new Error("Background import is unavailable. No study was added. Keep the source file."));
      worker.onmessage = event => {
        if (finished) return;
        try {
          const data = event.data;
          if (!data || typeof data !== "object") throw new Error("Invalid import response.");
          if (data.type === "error") throw new Error(typeof data.message === "string" ? data.message.slice(0, 2_000) : "Local import failed.");
          if (data.type === "phase") {
            const expected = phase === 0 ? "reading" : phase === 1 ? "parsing" : null;
            if (data.phase !== expected) throw new Error("Unexpected import phase.");
            phase += 1; options.onProgress?.({ phase: data.phase });
          } else if (data.type === "header") {
            if (phase !== 2 || header || typeof data.json !== "string" || data.json.length > localCsvHeaderChars) throw new Error("Invalid import metadata.");
            const value = JSON.parse(data.json) as LocalCsvHeader;
            if (!value || typeof value !== "object" || Object.keys(value).some(key => !headerKeys.has(key))) throw new Error("Unexpected import metadata.");
            const checked = readSavedStudies([{ ...value, rows: [], previewRows: [] }], "v2")[0];
            if (checked.sourceType !== "local_file" || checked.fileType !== "csv" || checked.fileName !== file.name ||
                checked.rowCount < 1 || checked.rowCount > localCsvLimits.maxRows || checked.fieldCount !== checked.fields.length ||
                checked.fieldCount < 1 || checked.fieldCount > localCsvLimits.maxFields || checked.rowCount > Math.floor(localCsvLimits.maxCells / checked.fieldCount)) throw new Error("Invalid import dimensions.");
            if (!Array.isArray(data.previewIndexes) || data.previewIndexes.length > 50 ||
                new Set(data.previewIndexes).size !== data.previewIndexes.length ||
                data.previewIndexes.some(index => !Number.isSafeInteger(index) || index < 0 || index >= checked.rowCount)) throw new Error("Invalid import preview.");
            header = value; previewIndexes = data.previewIndexes; phase = 3;
            options.onProgress?.({ phase: "receiving", received: 0, total: header.rowCount });
          } else if (data.type === "rows") {
            if (phase !== 3 || !header || data.sequence !== sequence || data.start !== rows.length || typeof data.json !== "string" || data.json.length > localCsvPacketChars) throw new Error("Incomplete or out-of-order import data.");
            const additionalCharacters = data.json.length - 2 + (rows.length ? 1 : 0);
            if (additionalCharacters < 0 || additionalCharacters > localCsvExpandedRowsChars - expandedCharacters) throw new Error("Expanded CSV rows exceed the local import limit. No study was added.");
            expandedCharacters += additionalCharacters;
            const batch: unknown = JSON.parse(data.json);
            if (!Array.isArray(batch) || !batch.length || batch.length > 500 || rows.length + batch.length > header.rowCount) throw new Error("Invalid import batch.");
            const columns = header.fields.map(field => field.sourceColumn);
            for (const row of batch) {
              if (!row || typeof row !== "object" || Array.isArray(row) || Object.keys(row).length !== columns.length ||
                  columns.some(column => !Object.hasOwn(row, column) || typeof row[column] !== "string" || row[column].length > localCsvLimits.maxValueChars)) throw new Error("Invalid imported row.");
              rows.push(row);
            }
            options.onProgress?.({ phase: "receiving", received: rows.length, total: header.rowCount });
            if (!finished) worker!.postMessage({ type: "ack", sequence: sequence++ });
          } else if (data.type === "complete") {
            if (phase !== 3 || !header || rows.length !== header.rowCount) throw new Error("The import ended before all rows arrived.");
            const dataset: ImportedDatasetRecord = { ...header, rows, previewRows: previewIndexes.map(index => rows[index]) };
            finish(undefined, dataset); return;
          } else throw new Error("Unknown import response.");
          if (!finished) armTimeout();
        } catch (error) { finish(error instanceof Error ? error : new Error("Local import failed. No study was added.")); }
      };
      armTimeout();
      worker.postMessage({ type: "start", file, name: file.name });
    } catch { finish(new Error("Background import could not start. No study was added. Keep the source file.")); }
  });
}
