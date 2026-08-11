import { describe, expect, it } from "vitest";
import type { DatasetConnectionProfile } from "../../../../shared/types/dataSource";
import { buildLiveDatasetSourceDescriptorForConnection } from "../datasetConnectionModel";

function connection(overrides: Partial<DatasetConnectionProfile> = {}): DatasetConnectionProfile {
  return {
    id: "connection_snowflake",
    provider: "snowflake",
    label: "Snowflake",
    description: "Warehouse connection",
    status: "setup_scaffold",
    statusLabel: "Provider foundation ready",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides
  };
}

describe("dataset connection model", () => {
  it("builds a live source descriptor from a verified connection", () => {
    const source = buildLiveDatasetSourceDescriptorForConnection(
      connection({
        status: "sync_ready",
        verification: {
          status: "verified",
          statusLabel: "Verified",
          checkedAt: "2026-08-02T00:00:00.000Z",
          diagnostics: ["Read-only query succeeded."],
          nextStep: "Register source."
        },
        connectionSummary: {
          database: "SURVEY",
          schema: "PUBLIC"
        }
      })
    );

    expect(source).toMatchObject({
      connectionId: "connection_snowflake",
      objectPath: "SURVEY.PUBLIC.RESPONSES",
      syncMode: "live_query",
      status: "available",
      sourceRef: {
        id: "live:snowflake:connection_snowflake:default",
        kind: "live_connection",
        provider: "snowflake",
        datasetId: "live_snowflake_default"
      }
    });
  });

  it("keeps unverified connection sources honest", () => {
    const source = buildLiveDatasetSourceDescriptorForConnection(
      connection({
        status: "configured",
        verification: {
          status: "ready_to_verify",
          statusLabel: "Ready for server verification",
          checkedAt: "2026-08-02T00:00:00.000Z",
          diagnostics: ["Environment variables are present."],
          nextStep: "Run non-production verification."
        }
      })
    );

    expect(source).toMatchObject({
      status: "needs_verification",
      statusLabel: "Needs server verification before live queries"
    });
  });
});
