import type { AnalyticsQueryResponse } from "../../../shared/types/analytics";
import { assertJsonSize, quotedJsonLength } from "../../../shared/jsonSizeBudget";
import { getImportedDatasetQuerySupport, type ImportedDatasetQueryConfig } from "./importedDatasetAnalytics";
import { importedRawFieldValue } from "./importedRawValue";
import { normalizeDatasetSourceRefForImportedDataset } from "./datasetSourceRegistry";
import { assertLocalAnalysisResult, localAnalysisLimits, localAnalysisMetadata, type LocalAnalysisRequest } from "./localAnalysisModel";
export type LocalAnalysisProgress = { phase: "preparing"; done: number; total: number } | { phase: "calculating"; total: number };
export interface LocalAnalysisControl { signal: AbortSignal; onProgress?: (progress: LocalAnalysisProgress) => void; getCurrentConfig?: () => ImportedDatasetQueryConfig | null }
export interface LocalAnalysisWorker { postMessage: (request: LocalAnalysisRequest) => void; terminate: () => void; onmessage: ((event: MessageEvent) => void) | null; onerror: ((event: ErrorEvent) => void) | null; onmessageerror: ((event: MessageEvent) => void) | null }
export interface LocalAnalysisAcceptance { result: AnalyticsQueryResponse; sourceStillCurrent: () => boolean }
function selection(config: ImportedDatasetQueryConfig) {
  const dataset = config.dataset;
  if (config.groupingScope === "all_respondents" && [config.measureField, config.bannerField, config.filter?.field].some(f => f && f === config.field)) throw Error("Use a separate virtual field for overall grouping; physical roles must remain distinct.");
  if (dataset.remote || dataset.sourceType !== "local_file" || config.audience !== undefined || !Array.isArray(dataset.rows) || !Array.isArray(dataset.fields) || !Number.isSafeInteger(dataset.rowCount) || dataset.rowCount < 1 || dataset.rowCount > localAnalysisLimits.rows || dataset.rows.length !== dataset.rowCount || !Number.isSafeInteger(dataset.fieldCount) || dataset.fieldCount > localAnalysisLimits.totalFields || dataset.fields.length !== dataset.fieldCount) throw Error("Background creation requires 1-50,000 complete local-file rows, up to 200 fields and no saved audience.");
  const chosen = [config.field, ...[config.measureField, config.bannerField, config.filter?.field].filter((f): f is NonNullable<typeof f> => !!f)];
  localAnalysisMetadata(chosen);
  const same = (a: typeof config.field, b: typeof config.field) => config.groupingScope === "all_respondents" && (a === config.field || b === config.field) ? a === b : a.id === b.id;
  const fields = chosen.filter((f, i, all) => all.findIndex(other => same(other, f)) === i);
  for (const f of chosen) { if (config.groupingScope === "all_respondents" && f === config.field) continue; const found = dataset.fields.filter(other => other.id === f.id); if (found.length !== 1 || localAnalysisMetadata(found[0]) !== localAnalysisMetadata(f)) throw Error("A selected creation field is missing, ambiguous or changed."); }
  const support = getImportedDatasetQuerySupport(dataset, config.field, { groupingScope: config.groupingScope, measureField: config.measureField, bannerField: config.bannerField, filter: config.filter, metric: config.metric, chartType: config.chartType }); if (!support.executable) throw Error(support.reason);
  const role = (f: typeof config.field | null | undefined) => f ? fields.findIndex(other => same(other, f)) : null;
  const metadata = { source: { id: dataset.id, title: dataset.title, sourceType: dataset.sourceType, fileName: dataset.fileName, fileType: dataset.fileType, importedAt: dataset.importedAt, rowCount: dataset.rowCount, fieldCount: dataset.fieldCount, sourceRef: normalizeDatasetSourceRefForImportedDataset(dataset) }, fields, group: 0, measure: role(config.measureField), banner: role(config.bannerField), filter: config.filter ? { field: role(config.filter.field)!, value: config.filter.value } : null, metric: config.metric, chartType: config.chartType, allRespondents: config.groupingScope === "all_respondents" };
  if (metadata.source.sourceRef.kind !== "imported_file") throw Error("Background creation will not reinterpret a remote or live source as a local file.");
  const text = localAnalysisMetadata(metadata); return { fields, text, metadata: JSON.parse(text) as typeof metadata };
}
export function runLocalAnalysisJob(config: ImportedDatasetQueryConfig, options: LocalAnalysisControl & { createWorker?: () => LocalAnalysisWorker }): Promise<LocalAnalysisAcceptance> {
  return new Promise((resolve, reject) => {
    let worker: LocalAnalysisWorker | null = null, finished = false; const timers = new Set<ReturnType<typeof setTimeout>>();
    function finish(error?: Error, accepted?: LocalAnalysisAcceptance) { if (finished) return; finished = true; for (const t of timers) clearTimeout(t); options.signal.removeEventListener("abort", cancel); if (worker) { worker.onmessage = worker.onerror = worker.onmessageerror = null; try { worker.terminate(); } catch { /* detached callbacks still refuse late results */ } } if (error) reject(error); else resolve(accepted!); }
    function cancel() { finish(new DOMException("Background creation canceled. Your setup, report and source were kept.", "AbortError")); }
    if (options.signal.aborted) { cancel(); return; } options.signal.addEventListener("abort", cancel, { once: true });
    try {
      const selected = selection(config), source = config.dataset.rows, values: string[][] = [], request: LocalAnalysisRequest = { ...selected.metadata, values }, encoder = new TextEncoder(); let bytes = 0, expanded = 0;
      const keyCost = selected.fields.reduce((sum, f, i) => sum + (request.allRespondents && i === request.group ? 0 : quotedJsonLength(f.sourceColumn) + 2), 2);
      function current() { try { const latest = options.getCurrentConfig ? options.getCurrentConfig() : config; if (!latest || latest.dataset.rows !== source || selection(latest).text !== selected.text || values.length !== source.length) return false; for (let i = 0; i < values.length; i++) for (let j = 0; j < selected.fields.length; j++) if ((request.allRespondents && j === request.group ? "" : importedRawFieldValue(source[i], selected.fields[j])) !== values[i][j]) return false; return true; } catch { return false; } }
      const preparationDeadline = setTimeout(() => finish(Error("Preparing background creation exceeded 30 seconds. Your selections were kept.")), 30000); timers.add(preparationDeadline);
      function prepare() {
        if (finished) return;
        try {
          const end = Math.min(source.length, values.length + 250);
          for (let i = values.length; i < end; i++) {
            if (!source[i] || typeof source[i] !== "object" || Array.isArray(source[i])) throw Error("A selected source row is malformed.");
            const row = selected.fields.map((f, j) => request.allRespondents && j === request.group ? "" : importedRawFieldValue(source[i], f));
            if (row.some(v => typeof v !== "string" || v.length > 20000)) throw Error("Selected creation values are oversized or not text.");
            const text = JSON.stringify(row); bytes += encoder.encode(text).length + 1; expanded += keyCost + text.length;
            if (bytes > localAnalysisLimits.sourceBytes || expanded > localAnalysisLimits.sourceBytes) throw Error("Selected creation values or expanded row keys exceed 20 MiB. Choose this-tab calculation or a smaller setup."); values.push(row);
          }
          options.onProgress?.({ phase: "preparing", done: values.length, total: source.length }); if (finished) return;
          if (values.length < source.length) { timers.add(setTimeout(prepare, 0)); return; }
          if (!current()) throw Error("The source or setup changed while preparing creation. Nothing was inserted; retry the current setup.");
          try { worker = options.createWorker ? options.createWorker() : new Worker(new URL("./localAnalysis.worker.ts", import.meta.url), { type: "module" }); } catch { throw Error("Background creation cannot start here. Choose this-tab calculation to retain the existing creation path."); }
          worker.onmessage = event => { if (finished) return; try { const data = event.data; assertJsonSize(data, { maxChars: localAnalysisLimits.resultChars + 1000, maxNodes: 150010, maxDepth: 34 }); if (data?.type === "failed") throw Error(typeof data.message === "string" ? data.message.slice(0, 500) : "Background creation failed."); if (data?.type !== "complete") throw Error("The worker returned no complete analysis."); assertLocalAnalysisResult(data.result, request); if (!current()) throw Error("The source or setup changed during calculation. Nothing was inserted; retry the current setup."); finish(undefined, { result: data.result, sourceStillCurrent: current }); } catch (error) { finish(error instanceof Error ? error : Error("No background result was accepted.")); } };
          worker.onerror = worker.onmessageerror = () => finish(Error("Background creation failed. Choose this-tab calculation or retry; nothing was inserted."));
          options.onProgress?.({ phase: "calculating", total: source.length }); if (finished) return; clearTimeout(preparationDeadline); timers.add(setTimeout(() => finish(Error("Background creation exceeded 30 seconds. Choose a smaller comparison or this-tab calculation.")), 30000)); worker.postMessage(request);
        } catch (error) { finish(error instanceof Error ? error : Error("Background creation failed.")); }
      }
      timers.add(setTimeout(prepare, 0));
    } catch (error) { finish(error instanceof Error ? error : Error("Background creation could not start.")); }
  });
}
