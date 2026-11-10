import { expect, it } from "vitest";
import { File } from "node:buffer";
import { runLocalSavImport } from "../localCsvImportJob";
import { savNumbers } from "./fixtures/savNumberFixture";
import { LocalSavNodeWorker } from "./fixtures/LocalSavNodeWorker";
it.each([0, 1])("runs the actual SPSS worker entry without DOMParser or fetch, retaining all1250rows for compression%s", async compression => {
  const worker = new LocalSavNodeWorker(), values = Array.from({ length: 1250 }, (_, i) => i % 7), source = new File([new Uint8Array(savNumbers(values, { compression }))], "actual-worker-synthetic.sav");
  try { const dataset = await runLocalSavImport(source as unknown as globalThis.File, { signal: new AbortController().signal, createWorker: () => worker }); expect(worker.domParserAvailable).toBe(false); expect(dataset.rows.map(r => r.AMOUNT)).toEqual(values.map(String)); expect(dataset.rows.map(r => r.ID)).toEqual(values.map((_, i) => String(i + 1))); expect(dataset.fileType).toBe("sav"); expect(dataset.rowCount).toBe(1250); }
  finally { worker.terminate(); await worker.termination; }
}, 20000);
