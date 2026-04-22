import { runMockAnalyticsQuery } from "../../mock/analytics";
import type { AnalyticsProvider } from "./types";

export const mockAnalyticsProvider: AnalyticsProvider = {
  id: "mock",
  async runQuery(query) {
    return runMockAnalyticsQuery(query);
  }
};
