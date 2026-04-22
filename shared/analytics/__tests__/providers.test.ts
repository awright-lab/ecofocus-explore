import { describe, expect, it } from "vitest";
import { getAnalyticsProvider } from "../providers";

describe("getAnalyticsProvider", () => {
  it("defaults to the mock provider", () => {
    expect(getAnalyticsProvider().id).toBe("mock");
  });

  it("returns the snowflake provider when requested", () => {
    expect(getAnalyticsProvider("snowflake").id).toBe("snowflake");
  });

  it("rejects unknown providers", () => {
    expect(() => getAnalyticsProvider("unknown")).toThrow("Unsupported analytics provider: unknown.");
  });
});
