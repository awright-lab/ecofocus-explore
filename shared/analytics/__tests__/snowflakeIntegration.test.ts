import { describe, expect, it } from "vitest";
import { verifySnowflakeIntegration } from "../providers/snowflakeVerification";

const describeLiveSnowflake = process.env.SNOWFLAKE_VERIFY_INTEGRATION === "1" ? describe : describe.skip;

describeLiveSnowflake("Snowflake non-production integration verification", () => {
  it("verifies the configured Snowflake provider path against a real non-production target", async () => {
    const report = await verifySnowflakeIntegration();

    expect(report.status).toBe("passed");
    expect(report.nonProductionOnly).toBe(true);
    expect(report.steps.every((step) => step.status === "passed")).toBe(true);
  });
});
