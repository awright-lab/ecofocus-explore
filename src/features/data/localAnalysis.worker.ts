import { calculateLocalAnalysis, type LocalAnalysisRequest } from "./localAnalysisModel";
const scope = self as unknown as { onmessage: ((event: MessageEvent<LocalAnalysisRequest>) => void) | null; postMessage: (data: unknown) => void };
scope.onmessage = event => { try { scope.postMessage({ type: "complete", result: calculateLocalAnalysis(event.data) }); } catch (error) { scope.postMessage({ type: "failed", message: error instanceof Error ? error.message : "Background creation failed." }); } };
