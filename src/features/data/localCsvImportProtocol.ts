import { importDatasetBuffer, type DatasetImportLimits } from "./datasetImportModel";
import type { ImportedDatasetRecord } from "../../../shared/types/dashboard";
import { assertJsonSize } from "../../../shared/jsonSizeBudget";

export const localCsvExpandedRowsChars = 16 * 1024 * 1024;
export const localCsvLimits: DatasetImportLimits = {
  maxRows: 1_000_000, maxFields: 5_000, maxCells: 2_000_000,
  maxValueChars: 128 * 1024, maxPhysicalSlots: 32_768,
  maxExpandedRowJsonChars: localCsvExpandedRowsChars,
};
export const localCsvMaxBytes = 16 * 1024 * 1024;
export const localCsvPacketChars = 256 * 1024;
export const localCsvHeaderChars = 2 * 1024 * 1024;
export type CsvImportRequest = { type: "start"; file: Blob; name: string } | { type: "ack"; sequence: number };
export type CsvImportMessage =
  | { type: "phase"; phase: "reading" | "parsing" }
  | { type: "header"; json: string; previewIndexes: number[] }
  | { type: "rows"; sequence: number; start: number; json: string }
  | { type: "complete" }
  | { type: "error"; message: string };

// One job per worker. Each batch waits for acknowledgement so delivery cannot
// queue an entire study on the main thread. Cancellation terminates the worker.
export function createLocalCsvImportController(send: (message: CsvImportMessage) => void) {
  let started = false;
  let waiting: { sequence: number; resume: () => void } | undefined;
  function delivered(message: Extract<CsvImportMessage, { type: "rows" }>) {
    return new Promise<void>(resolve => {
      waiting = { sequence: message.sequence, resume: resolve };
      send(message);
    });
  }
  async function start(file: Blob, name: string) {
    try {
      if (!name.toLowerCase().endsWith(".csv") || !Number.isSafeInteger(file.size) || file.size < 1 || file.size > localCsvMaxBytes) {
        throw new Error("Choose a CSV file up to 16 MiB for local import.");
      }
      send({ type: "phase", phase: "reading" });
      const buffer = await file.arrayBuffer();
      if (buffer.byteLength !== file.size) throw new Error("The source file could not be read completely.");
      send({ type: "phase", phase: "parsing" });
      const result = await importDatasetBuffer(buffer, name, "csv", localCsvLimits);
      if (!result.dataset || result.error) throw new Error(result.error ?? "The CSV could not be read.");
      const dataset = result.dataset;
      const { rows, previewRows, fields, ...metadata } = dataset;
      // Serialize field by field, checking the budget before building a large
      // whole-header string. This header contains no respondent rows.
      const fieldParts: string[] = [];
      const metadataLimits = { maxChars: localCsvHeaderChars, maxNodes: 50_000, maxDepth: 32 };
      try { assertJsonSize(metadata, metadataLimits); }
      catch { throw new Error("Study metadata exceeds the local import limit."); }
      const header = JSON.stringify(metadata);
      let size = header.length + 32;
      for (const field of fields) {
        if (size >= localCsvHeaderChars) throw new Error("Study metadata exceeds the local import limit.");
        try { assertJsonSize(field, { ...metadataLimits, maxChars: localCsvHeaderChars - size }); }
        catch { throw new Error("Study metadata exceeds the local import limit."); }
        const part = JSON.stringify(field);
        size += part.length + 1;
        if (size > localCsvHeaderChars) throw new Error("Study metadata exceeds the local import limit.");
        fieldParts.push(part);
      }
      const json = `${header.slice(0, -1)},"fields":[${fieldParts.join(",")}]}`;
      if (json.length > localCsvHeaderChars) throw new Error("Study metadata exceeds the local import limit.");
      send({ type: "header", json, previewIndexes: previewRows.map(row => rows.indexOf(row)) });
      let parts: string[] = [], chars = 2, start = 0, sequence = 0;
      async function flush() {
        if (!parts.length) return;
        const count = parts.length;
        await delivered({ type: "rows", sequence: sequence++, start, json: `[${parts.join(",")}]` });
        start += count; parts = []; chars = 2;
      }
      for (const row of rows) {
        const part = JSON.stringify(row);
        if (part.length + 2 > localCsvPacketChars) throw new Error("A study row is too large for local import.");
        if (parts.length && (parts.length === 500 || chars + part.length + 1 > localCsvPacketChars)) await flush();
        parts.push(part); chars += part.length + 1;
      }
      await flush();
      send({ type: "complete" });
    } catch (error) {
      send({ type: "error", message: error instanceof Error ? error.message : "Local import failed. Keep the source file." });
    }
  }
  return (message: CsvImportRequest) => {
    if (message.type === "ack") {
      if (waiting && message.sequence === waiting.sequence) {
        const resume = waiting.resume; waiting = undefined; resume();
      }
    } else if (!started && message.type === "start") {
      started = true; void start(message.file, message.name);
    }
  };
}

export type LocalCsvHeader = Omit<ImportedDatasetRecord, "rows" | "previewRows">;
