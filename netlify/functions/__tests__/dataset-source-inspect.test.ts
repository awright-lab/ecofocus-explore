import { afterEach, describe, expect, it, vi } from "vitest";
import { handler } from "../dataset-source-inspect";

function event(body: unknown, method = "POST") {
  return {
    httpMethod: method,
    body: body === null ? null : JSON.stringify(body)
  };
}

const payload = {
  provider: "snowflake",
  connectionId: "connection_snowflake",
  sourceRefId: "live:snowflake:connection_snowflake:default",
  objectPath: "SURVEY.PUBLIC.RESPONSES",
  objectType: "table"
};

describe("dataset source inspection function", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects non-POST requests", async () => {
    const response = await handler(event(null, "GET") as never, {} as never, undefined as never);

    expect(response?.statusCode).toBe(405);
  });

  it("rejects missing source inspection fields", async () => {
    const response = await handler(event({ provider: "snowflake" }) as never, {} as never, undefined as never);
    const body = JSON.parse(response?.body ?? "{}") as { error: string; details: string[] };

    expect(response?.statusCode).toBe(400);
    expect(body.error).toBe("Missing source inspection fields.");
    expect(body.details[0]).toContain("provider, connectionId, sourceRefId");
  });

  it("reports missing Snowflake server environment without executing inspection SQL", async () => {
    [
      "SNOWFLAKE_ACCOUNT",
      "SNOWFLAKE_USERNAME",
      "SNOWFLAKE_PASSWORD",
      "SNOWFLAKE_WAREHOUSE",
      "SNOWFLAKE_DATABASE",
      "SNOWFLAKE_SCHEMA",
      "SNOWFLAKE_ROLE"
    ].forEach((name) => vi.stubEnv(name, ""));

    const response = await handler(event(payload) as never, {} as never, undefined as never);
    const body = JSON.parse(response?.body ?? "{}") as { status: string; statusLabel: string; diagnostics: string[] };

    expect(response?.statusCode).toBe(200);
    expect(body.status).toBe("failed");
    expect(body.statusLabel).toBe("Missing server environment");
    expect(body.diagnostics[0]).toContain("Missing Snowflake environment variables");
  });

  it("reports unsupported providers honestly", async () => {
    const response = await handler(
      event({
        ...payload,
        provider: "supabase",
        sourceRefId: "live:supabase:connection_supabase:default"
      }) as never,
      {} as never,
      undefined as never
    );
    const body = JSON.parse(response?.body ?? "{}") as { status: string; statusLabel: string; diagnostics: string[] };

    expect(response?.statusCode).toBe(200);
    expect(body.status).toBe("unsupported");
    expect(body.statusLabel).toBe("Inspection pending");
    expect(body.diagnostics[0]).toContain("supabase source inspection is not implemented yet");
  });

  it("reports query source inspection as unsupported", async () => {
    const response = await handler(event({ ...payload, objectType: "query" }) as never, {} as never, undefined as never);
    const body = JSON.parse(response?.body ?? "{}") as { status: string; statusLabel: string };

    expect(response?.statusCode).toBe(200);
    expect(body.status).toBe("unsupported");
    expect(body.statusLabel).toBe("Query inspection pending");
  });
});
