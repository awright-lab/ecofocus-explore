import type { AnalyticsQueryRequest, AnalyticsQueryResponse } from "../../shared/types/analytics";

export async function runAnalyticsQuery(query: AnalyticsQueryRequest, options: {signal?:AbortSignal} = {}): Promise<AnalyticsQueryResponse> {
  const response = await fetch("/.netlify/functions/analytics-query", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(query),
    ...(options.signal ? {signal:options.signal} : {})
  });

  const payload = await response.json();

  if (!response.ok) {
    const message = payload?.details?.length ? `${payload.error}: ${payload.details.join(" ")}` : payload.error;
    throw new Error(message || "Analytics query failed.");
  }

  return payload as AnalyticsQueryResponse;
}
