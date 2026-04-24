import { mockAnalyticsProvider } from "./mockProvider";
import { snowflakeAnalyticsProvider } from "./snowflakeProvider";
import type { AnalyticsProvider } from "./types";

export type AnalyticsProviderId = "mock" | "snowflake";

export function getAnalyticsProvider(providerId = process.env.ANALYTICS_DATA_PROVIDER ?? "mock"): AnalyticsProvider {
  if (providerId === "snowflake") {
    return snowflakeAnalyticsProvider;
  }

  if (providerId === "mock") {
    return mockAnalyticsProvider;
  }

  throw new Error(`Unsupported analytics provider: ${providerId}.`);
}

export function getAnalyticsProviderReadiness(providerId = process.env.ANALYTICS_DATA_PROVIDER ?? "mock") {
  return getAnalyticsProvider(providerId).getReadiness?.() ?? {
    configured: true,
    summary: "Provider readiness not reported."
  };
}
