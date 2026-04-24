import { runMockAnalyticsQuery } from "../../mock/analytics";
import type { AnalyticsProvider } from "./types";

export const mockAnalyticsProvider: AnalyticsProvider = {
  id: "mock",
  label: "Mock provider",
  getReadiness() {
    return {
      configured: true,
      summary: "Mock analytics provider is ready."
    };
  },
  async runQuery(query) {
    return runMockAnalyticsQuery(query);
  }
};
