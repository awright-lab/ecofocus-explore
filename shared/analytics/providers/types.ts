import type { AnalyticsQueryRequest, AnalyticsQueryResponse } from "../../types/analytics";

export interface AnalyticsProviderReadiness {
  configured: boolean;
  summary: string;
  missingEnvVars?: string[];
}

export interface AnalyticsProvider {
  id: string;
  label: string;
  getReadiness?(): AnalyticsProviderReadiness;
  runQuery(query: AnalyticsQueryRequest): Promise<AnalyticsQueryResponse>;
}
