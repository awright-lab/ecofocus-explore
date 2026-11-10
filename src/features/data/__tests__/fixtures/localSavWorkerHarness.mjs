import { parentPort, workerData } from "node:worker_threads";
import { registerHooks, createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
const require = createRequire(import.meta.url), ts = require("typescript"), root = path.resolve(workerData.root);
const inside = url => { if (!url.startsWith("file:")) return false; const name = path.resolve(fileURLToPath(url)); return name.startsWith(root + path.sep); };
registerHooks({
  resolve(specifier, context, next) {
    if ((specifier.startsWith(".") || specifier.startsWith("file:")) && context.parentURL) {
      const url = new URL(specifier, context.parentURL);
      if (inside(url.href)) { const name = fileURLToPath(url); for (const candidate of [name, name + ".ts"]) if (existsSync(candidate) && candidate.endsWith(".ts")) return { url: pathToFileURL(candidate).href, shortCircuit: true }; }
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (inside(url) && url.endsWith(".ts")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(fileURLToPath(url), "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText };
    return next(url, context);
  },
});
delete globalThis.DOMParser;
globalThis.fetch = () => { throw Error("A local SPSS worker must not fetch"); };
globalThis.self = { postMessage: message => parentPort.postMessage(message) };
await import(pathToFileURL(path.join(root, "src/features/data/localSavImport.worker.ts")).href);
parentPort.on("message", data => globalThis.self.onmessage({ data }));
parentPort.postMessage({ type: "test-worker-ready", domParserAvailable: typeof globalThis.DOMParser !== "undefined" });
