import { afterEach, expect, it, vi } from "vitest";
import { runLocalAnalysisJob, type LocalAnalysisWorker } from "../localAnalysisJob";
import { calculateLocalAnalysis, type LocalAnalysisRequest } from "../localAnalysisModel";
import { runImportedDatasetQuery } from "../importedDatasetAnalytics";
import { allRespondentsGroupingField } from "../numericSummaryScope";
import { guidedPreviewFixture } from "./guidedPreviewFixture";
afterEach(() => vi.useRealTimers());
function worker(auto = true) { const w: LocalAnalysisWorker = { onmessage: null, onerror: null, onmessageerror: null, terminate: vi.fn(), postMessage: vi.fn(request => { if (auto) queueMicrotask(() => { try { w.onmessage?.({ data: { type: "complete", result: calculateLocalAnalysis(request) } } as MessageEvent); } catch (error) { w.onmessage?.({ data: { type: "failed", message: (error as Error).message } } as MessageEvent); } }); }) }; return w; }
async function execute(config: Parameters<typeof runLocalAnalysisJob>[0]) { const w = worker(); vi.useFakeTimers(); const pending = runLocalAnalysisJob(config, { signal: new AbortController().signal, createWorker: () => w }); await vi.runAllTimersAsync(); return { accepted: await pending, w }; }
it.each(["count", "percent_selected", "column_percent", "average", "sum"] as const)("keeps the complete actual source/result identity and precision for %s", async metric => {
  const f = await guidedPreviewFixture(120); f.config.metric = metric; if (metric === "average" || metric === "sum") f.config.measureField = f.dataset.fields[2]; const before = structuredClone(f.dataset), expected = runImportedDatasetQuery(f.config); const { accepted, w } = await execute(f.config);
  expect(accepted.result).toEqual(expected); expect(accepted.sourceStillCurrent()).toBe(true); expect(f.dataset).toEqual(before); expect(w.terminate).toHaveBeenCalledOnce();
  expect(accepted.result.query.sourceIdentity?.kind === "imported" && accepted.result.query.sourceIdentity.datasetId).toBe(f.dataset.id);
  expect(accepted.result.query.sourceIdentity?.kind === "imported" && accepted.result.query.sourceIdentity.primaryFieldId).toBe(f.config.field.id);
});
it.each(["measure", "breakout", "filter"] as const)("keeps real reserved-ID %s separate from virtual overall grouping", async role => {
  const f = await guidedPreviewFixture(120), physical = f.dataset.fields[role === "measure" ? 2 : role === "breakout" ? 1 : 3]; physical.id = "__ecofocus_all_respondents__";
  f.config = { ...f.config, field: allRespondentsGroupingField(f.dataset), groupingScope: "all_respondents", measureField: f.dataset.fields[2], bannerField: role === "breakout" ? physical : null, filter: role === "filter" ? { field: physical, value: "Keep" } : null, metric: "average" };
  const expected = runImportedDatasetQuery(f.config), { accepted } = await execute(f.config); expect(accepted.result).toEqual(expected);
});
it("refuses a physical object reused as a virtual overall grouping", async () => {
  const f = await guidedPreviewFixture(), createWorker = vi.fn(() => worker()); f.config = { ...f.config, field: f.dataset.fields[2], measureField: f.dataset.fields[2], groupingScope: "all_respondents", metric: "average" };
  await expect(runLocalAnalysisJob(f.config, { signal: new AbortController().signal, createWorker })).rejects.toThrow("separate virtual"); expect(createWorker).not.toHaveBeenCalled();
});
it("accepts case-fallback row keys without altering the full source", async () => {
  const f = await guidedPreviewFixture(); f.dataset.rows = f.dataset.rows.map(row => Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]))); const before = structuredClone(f.dataset), expected = runImportedDatasetQuery(f.config); const { accepted } = await execute(f.config); expect(accepted.result).toEqual(expected); expect(f.dataset).toEqual(before);
});
it.each(["row", "field", "sourceRef", "replacement"] as const)("rejects a changed %s before accepting worker output", async kind => {
  const f = await guidedPreviewFixture(), w = worker(false); let latest = f.config; vi.useFakeTimers(); const pending = runLocalAnalysisJob(f.config, { signal: new AbortController().signal, getCurrentConfig: () => latest, createWorker: () => w }); const rejected = expect(pending).rejects.toThrow("changed"); await vi.advanceTimersByTimeAsync(10);
  const request = vi.mocked(w.postMessage).mock.calls[0][0], result = calculateLocalAnalysis(request);
  if (kind === "row") f.dataset.rows[0][f.config.field.sourceColumn] = "Altered";
  if (kind === "field") f.config.field.label += " changed";
  if (kind === "sourceRef") f.dataset.sourceRef = { id: "different-source", kind: "imported_file", provider: "local_file", label: "Different", datasetId: f.dataset.id };
  if (kind === "replacement") latest = { ...f.config, dataset: structuredClone(f.dataset) };
  w.onmessage?.({ data: { type: "complete", result } } as MessageEvent); await rejected; expect(w.terminate).toHaveBeenCalledOnce();
});
it("cancels preparation and ignores a late worker reply", async () => {
  const f = await guidedPreviewFixture(1000), w = worker(false), abort = new AbortController(); vi.useFakeTimers(); const pending = runLocalAnalysisJob(f.config, { signal: abort.signal, createWorker: () => w }); const rejected = expect(pending).rejects.toThrow("canceled"); await vi.advanceTimersByTimeAsync(20); const late = w.onmessage; abort.abort(); await rejected; expect(w.terminate).toHaveBeenCalledOnce(); expect(w.onmessage).toBeNull(); late?.({ data: { type: "complete", result: {} } } as MessageEvent);
});
it("rejects a preview-projection result rather than rebinding its identity", async () => {
  const f = await guidedPreviewFixture(), w = worker(false); vi.useFakeTimers(); const pending = runLocalAnalysisJob(f.config, { signal: new AbortController().signal, createWorker: () => w }); const rejected = expect(pending).rejects.toThrow(); await vi.advanceTimersByTimeAsync(10); const request = vi.mocked(w.postMessage).mock.calls[0][0], result = calculateLocalAnalysis(request); if (result.metadataRefs.source?.kind === "imported") result.metadataRefs.source.datasetId = "guided-preview-projection"; w.onmessage?.({ data: { type: "complete", result } } as MessageEvent); await rejected;
});
it("rejects a worker label rewrite even when identifiers still match", async () => {
  const f = await guidedPreviewFixture(), w = worker(false); vi.useFakeTimers(); const pending = runLocalAnalysisJob(f.config, { signal: new AbortController().signal, createWorker: () => w }); const rejected = expect(pending).rejects.toThrow(/source identity|incomplete or mismatched/); await vi.advanceTimersByTimeAsync(10); const result = calculateLocalAnalysis(vi.mocked(w.postMessage).mock.calls[0][0]); if (result.metadataRefs.source?.kind === "imported") result.metadataRefs.source.primaryFieldLabel = "Wrong wording"; w.onmessage?.({ data: { type: "complete", result } } as MessageEvent); await rejected;
});
it("keeps cancellation settling even when worker termination throws", async () => { const f = await guidedPreviewFixture(), w = worker(false), abort = new AbortController(); w.terminate = () => { throw Error("Synthetic termination failure"); }; vi.useFakeTimers(); const pending = runLocalAnalysisJob(f.config, { signal: abort.signal, createWorker: () => w }); const rejected = expect(pending).rejects.toThrow("canceled"); await vi.advanceTimersByTimeAsync(10); abort.abort(); await rejected; expect(w.onmessage).toBeNull(); });
it('yields preparation and can cancel before a worker exists',async()=>{const f=await guidedPreviewFixture(6000),abort=new AbortController(),createWorker=vi.fn();vi.useFakeTimers();const p=runLocalAnalysisJob(f.config,{signal:abort.signal,createWorker,onProgress:()=>abort.abort()}),rejected=expect(p).rejects.toMatchObject({name:'AbortError'});await vi.runAllTimersAsync();await rejected;expect(createWorker).not.toHaveBeenCalled();});
it.each(['constructor','post','runtime','deserialize','malformed','timeout'] as const)('refuses %s failures without sampling or foreground fallback',async kind=>{const f=await guidedPreviewFixture(),before=structuredClone(f.dataset),w=worker(false);if(kind==='post')w.postMessage=()=>{throw Error('blocked');};vi.useFakeTimers();const p=runLocalAnalysisJob(f.config,{signal:new AbortController().signal,createWorker:()=>{if(kind==='constructor')throw Error('blocked');return w;}}),rejected=expect(p).rejects.toThrow();await vi.advanceTimersByTimeAsync(kind==='timeout'?31000:1000);if(kind==='runtime')w.onerror!({} as ErrorEvent);if(kind==='deserialize')w.onmessageerror!({} as MessageEvent);if(kind==='malformed')w.onmessage!({data:{type:'complete',result:{}}} as MessageEvent);await rejected;expect(f.dataset).toEqual(before);});
it('bounds repeated long physical column keys before worker allocation',async()=>{const f=await guidedPreviewFixture(300),key='Long'.repeat(25000),field=f.dataset.fields[0];for(const row of f.dataset.rows){row[key]=row[field.sourceColumn];delete row[field.sourceColumn];}field.sourceColumn=key;const createWorker=vi.fn();vi.useFakeTimers();const p=runLocalAnalysisJob(f.config,{signal:new AbortController().signal,createWorker}),rejected=expect(p).rejects.toThrow('20 MiB');await vi.runAllTimersAsync();await rejected;expect(createWorker).not.toHaveBeenCalled();expect(f.dataset.rows).toHaveLength(300);});
it('matches complete 50,000-row counts and precision with original source unchanged',async()=>{const f=await guidedPreviewFixture(50000),before=JSON.stringify(f.dataset),expected=runImportedDatasetQuery(f.config),{accepted}=await execute(f.config);expect(accepted.result).toEqual(expected);expect(JSON.stringify(f.dataset)).toBe(before);});
