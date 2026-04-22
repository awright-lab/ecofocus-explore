import type { AnalyticsQueryRequest, AnalyticsQueryResponse } from "../../shared/types/analytics";

export async function runAnalyticsQuery(query: AnalyticsQueryRequest): Promise<AnalyticsQueryResponse> {
  const response = await fetch("/.netlify/functions/analytics-query", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(query)
  });

  const payload = await response.json();

  if (!response.ok) {
    const message = payload?.details?.length ? `${payload.error}: ${payload.details.join(" ")}` : payload.error;
    throw new Error(message || "Analytics query failed.");
  }

  return payload as AnalyticsQueryResponse;
}
