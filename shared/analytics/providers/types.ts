import type { AnalyticsQueryRequest, AnalyticsQueryResponse } from "../../types/analytics";

export interface AnalyticsProvider {
  id: string;
  runQuery(query: AnalyticsQueryRequest): Promise<AnalyticsQueryResponse>;
}
