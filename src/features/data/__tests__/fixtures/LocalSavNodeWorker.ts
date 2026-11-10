import { Worker as NodeWorker } from "node:worker_threads";
import { fileURLToPath, URL as NodeURL } from "node:url";
import type { LocalCsvWorker } from "../../localCsvImportJob";
import type { CsvImportRequest, CsvImportMessage } from "../../localCsvImportProtocol";
/** Test transport: actual application worker module, Node threads, in-memory TS loader. */
export class LocalSavNodeWorker implements LocalCsvWorker {
  static instances: LocalSavNodeWorker[] = [];
  onmessage: LocalCsvWorker["onmessage"] = null; onerror: LocalCsvWorker["onerror"] = null; onmessageerror: LocalCsvWorker["onmessageerror"] = null;
  ready = false; stopped = false; domParserAvailable = true; queue: CsvImportRequest[] = []; termination: Promise<number> | null = null;
  thread: NodeWorker;
  constructor(url = new NodeURL("../../localSavImport.worker.ts", import.meta.url)) {
    if (!String(url).includes("localSavImport.worker.ts")) throw Error(`Expected explicit local SPSS worker, got ${url}`);
    this.thread = new NodeWorker(new NodeURL("./localSavWorkerHarness.mjs", import.meta.url), { workerData: { root: fileURLToPath(new NodeURL("../../../../../", import.meta.url)) } }); LocalSavNodeWorker.instances.push(this);
    this.thread.on("message", message => { if (this.stopped) return; if (message.type === "test-worker-ready") { this.ready = true; this.domParserAvailable = message.domParserAvailable; for (const item of this.queue.splice(0)) this.thread.postMessage(item); } else this.onmessage?.({ data: message } as MessageEvent<CsvImportMessage>); });
    this.thread.on("error", error => this.onerror?.(error as unknown as ErrorEvent));
  }
  postMessage(message: CsvImportRequest) { if (this.stopped) return; if (this.ready) this.thread.postMessage(message); else this.queue.push(message); }
  terminate() { this.stopped = true; this.queue = []; this.termination ??= this.thread.terminate(); }
}
