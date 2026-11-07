import type { AnalyticsQueryResponse } from "../../../shared/types/analytics";
import { type ImportedDatasetQueryConfig, runImportedDatasetQuery } from "./importedDatasetAnalytics";
import { assertImportedQueryResponse, queryResponseObject } from "./importedQueryResponse";

export async function runImportedDatasetQueryForRuntime(config: ImportedDatasetQueryConfig, options: { signal?: AbortSignal } = {}): Promise<AnalyticsQueryResponse> {
  function checkCancellation() { if(options.signal?.aborted)throw new DOMException("Imported query canceled. No result from this request was accepted.","AbortError"); }
  checkCancellation();
  if (config.dataset.remote?.provider !== "netlify") {
    const result=runImportedDatasetQuery(config);checkCancellation();return result;
  }

  if(config.audience !== undefined) throw new Error("Server-backed audience queries are not supported. No query was sent and the current result has been kept.");

  if (config.groupingScope === "all_respondents") {
    throw new Error("All-respondent numeric summaries currently require complete browser data.");
  }

  const body=JSON.stringify({
      ...config,
      dataset: {
        ...config.dataset,
        rows: []
      }
    });
  checkCancellation();
  const response = await fetch("/.netlify/functions/imported-dataset-query", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body,
    ...(options.signal?{signal:options.signal}:{})
  });

  checkCancellation();
  const payload = await response.json().catch(() => null) as unknown;
  checkCancellation();
  if (!response.ok || queryResponseObject(payload) && Object.hasOwn(payload,"error")) {
    const error = queryResponseObject(payload) && typeof payload.error === "string" ? payload.error : `Imported dataset query failed with ${response.status}.`;
    const details = queryResponseObject(payload) && Array.isArray(payload.details) ? payload.details.filter((detail): detail is string => typeof detail === "string") : [];
    throw new Error(`${error}${details.length ? ` ${details.join(" ")}` : ""}`);
  }
  assertImportedQueryResponse(payload, config);
  checkCancellation();
  return payload;
}
