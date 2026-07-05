import type { AnalyticsQueryResponse } from "../../../shared/types/analytics";
import { type ImportedDatasetQueryConfig, runImportedDatasetQuery } from "./importedDatasetAnalytics";

function isImportedQueryError(payload: unknown): payload is { error?: string; details?: string[] } {
  return Boolean(payload && typeof payload === "object" && "error" in payload);
}

export async function runImportedDatasetQueryForRuntime(config: ImportedDatasetQueryConfig): Promise<AnalyticsQueryResponse> {
  if (config.dataset.remote?.provider !== "netlify") {
    return runImportedDatasetQuery(config);
  }

  const response = await fetch("/.netlify/functions/imported-dataset-query", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      ...config,
      dataset: {
        ...config.dataset,
        rows: []
      }
    })
  });

  const payload = await response.json().catch(() => null) as unknown;
  if (!response.ok || !payload || isImportedQueryError(payload)) {
    const detail = isImportedQueryError(payload) && payload.details?.length ? ` ${payload.details.join(" ")}` : "";
    throw new Error(`${isImportedQueryError(payload) ? payload.error : `Imported dataset query failed with ${response.status}.`}${detail}`);
  }

  return payload as AnalyticsQueryResponse;
}
