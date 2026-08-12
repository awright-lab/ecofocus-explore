import type { Handler } from "@netlify/functions";
import { runSnowflakeLiveQueryDefinition } from "../../shared/analytics/providers/snowflakeLiveQueryDefinition";
import type {
  DatasetConnectionProfile,
  LiveDatasetQueryDefinition,
  LiveDatasetQueryExecutionReport,
  LiveDatasetQueryExecutionRequest,
  LiveDatasetSourceDescriptor
} from "../../shared/types/dataSource";

const jsonHeaders = {
  "Content-Type": "application/json"
};

function errorResponse(statusCode: number, error: string, details?: string[]) {
  return {
    statusCode,
    headers: jsonHeaders,
    body: JSON.stringify({ error, details })
  };
}

function isSupportedProvider(value: unknown): value is DatasetConnectionProfile["provider"] {
  return value === "snowflake" || value === "supabase" || value === "postgres" || value === "netlify";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function normalizePayload(value: unknown): LiveDatasetQueryExecutionRequest | null {
  if (!isObject(value)) return null;
  const source = value.source as LiveDatasetSourceDescriptor | undefined;
  const definition = value.definition as LiveDatasetQueryDefinition | undefined;
  const provider = value.provider ?? source?.sourceRef.provider;
  const connectionId = value.connectionId ?? source?.connectionId;

  if (!isSupportedProvider(provider) || !connectionId || !source || !definition) return null;

  return {
    provider,
    connectionId: String(connectionId),
    source,
    definition,
    limit: typeof value.limit === "number" ? value.limit : undefined
  };
}

async function runLiveQuery(payload: LiveDatasetQueryExecutionRequest): Promise<LiveDatasetQueryExecutionReport> {
  if (payload.provider === "snowflake") {
    return runSnowflakeLiveQueryDefinition(payload);
  }

  return {
    provider: payload.provider,
    connectionId: payload.connectionId,
    sourceRefId: payload.source.sourceRef.id,
    definitionId: payload.definition.id,
    status: "unsupported",
    statusLabel: "Provider execution pending",
    diagnostics: [`${payload.provider} live query execution is not implemented yet.`],
    nextStep: "Use Snowflake for the first saved live query-definition execution path.",
    result: null
  };
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return errorResponse(405, "Method not allowed. Use POST.");
  }

  if (!event.body) {
    return errorResponse(400, "Missing request body.");
  }

  try {
    const payload = normalizePayload(JSON.parse(event.body));
    if (!payload) {
      return errorResponse(400, "Missing live query execution fields.", [
        "source and definition are required; provider and connectionId may be inferred from the source."
      ]);
    }

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify(await runLiveQuery(payload))
    };
  } catch (error) {
    return errorResponse(500, "Live dataset query failed.", [error instanceof Error ? error.message : "Unknown error"]);
  }
};
