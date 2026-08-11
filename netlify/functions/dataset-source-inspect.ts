import type { Handler } from "@netlify/functions";
import { inspectSnowflakeSource } from "../../shared/analytics/providers/snowflakeSourceInspection";
import type {
  DatasetConnectionProfile,
  LiveDatasetSourceInspectionReport,
  LiveDatasetSourceInspectionRequest
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

function report(
  payload: LiveDatasetSourceInspectionRequest,
  status: LiveDatasetSourceInspectionReport["status"],
  statusLabel: string,
  diagnostics: string[],
  nextStep: string
): LiveDatasetSourceInspectionReport {
  return {
    provider: payload.provider,
    connectionId: payload.connectionId,
    sourceRefId: payload.sourceRefId,
    objectPath: payload.objectPath,
    objectType: payload.objectType,
    status,
    statusLabel,
    inspectedAt: new Date().toISOString(),
    fields: [],
    diagnostics,
    nextStep
  };
}

function isSupportedProvider(value: unknown): value is DatasetConnectionProfile["provider"] {
  return value === "snowflake" || value === "supabase" || value === "postgres" || value === "netlify";
}

function normalizePayload(value: unknown): LiveDatasetSourceInspectionRequest | null {
  if (!value || typeof value !== "object") return null;
  const payload = value as Partial<LiveDatasetSourceInspectionRequest>;

  if (
    !isSupportedProvider(payload.provider)
    || !payload.connectionId
    || !payload.sourceRefId
    || !payload.objectPath
    || !payload.objectType
  ) {
    return null;
  }

  return {
    provider: payload.provider,
    connectionId: payload.connectionId,
    sourceRefId: payload.sourceRefId,
    objectPath: payload.objectPath,
    objectType: payload.objectType,
    limit: payload.limit
  };
}

async function inspectSource(payload: LiveDatasetSourceInspectionRequest): Promise<LiveDatasetSourceInspectionReport> {
  if (payload.provider === "snowflake") {
    return inspectSnowflakeSource(payload);
  }

  return report(
    payload,
    "unsupported",
    "Inspection pending",
    [`${payload.provider} source inspection is not implemented yet.`],
    "Use Snowflake for the first live schema inspection bridge, or keep this source as a planned connection."
  );
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
      return errorResponse(400, "Missing source inspection fields.", [
        "provider, connectionId, sourceRefId, objectPath, and objectType are required."
      ]);
    }

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify(await inspectSource(payload))
    };
  } catch (error) {
    return errorResponse(500, "Dataset source inspection failed.", [error instanceof Error ? error.message : "Unknown error"]);
  }
};
