import { afterEach, describe, expect, it, vi } from "vitest";
import { handler } from "../dataset-connection-verify";

function event(body: unknown, method = "POST") {
  return {
    httpMethod: method,
    body: body === null ? null : JSON.stringify(body)
  };
}

describe("dataset connection verification function", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects non-POST requests", async () => {
    const response = await handler(event(null, "GET") as never, {} as never, undefined as never);

    expect(response?.statusCode).toBe(405);
  });

  it("reports missing Snowflake server environment without executing verification SQL", async () => {
    [
      "SNOWFLAKE_ACCOUNT",
      "SNOWFLAKE_USERNAME",
      "SNOWFLAKE_PASSWORD",
      "SNOWFLAKE_WAREHOUSE",
      "SNOWFLAKE_DATABASE",
      "SNOWFLAKE_SCHEMA",
      "SNOWFLAKE_ROLE"
    ].forEach((name) => vi.stubEnv(name, ""));

    const response = await handler(event({ provider: "snowflake", connectionId: "connection_snowflake" }) as never, {} as never, undefined as never);
    const body = JSON.parse(response?.body ?? "{}") as { status: string; diagnostics: string[] };

    expect(response?.statusCode).toBe(200);
    expect(body.status).toBe("not_configured");
    expect(body.diagnostics[0]).toContain("Missing Snowflake environment variables");
  });

  it("reports unsupported providers honestly", async () => {
    const response = await handler(event({ provider: "unknown" }) as never, {} as never, undefined as never);
    const body = JSON.parse(response?.body ?? "{}") as { status: string; statusLabel: string };

    expect(response?.statusCode).toBe(200);
    expect(body.status).toBe("unsupported");
    expect(body.statusLabel).toBe("Unsupported provider");
  });
});
