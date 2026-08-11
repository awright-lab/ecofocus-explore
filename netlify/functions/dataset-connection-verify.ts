import type { Handler } from "@netlify/functions";
import { getSnowflakeReadiness } from "../../shared/analytics/providers/snowflakeConfig";
import type {
  DatasetConnectionProfile,
  DatasetConnectionVerificationReport,
  DatasetConnectionVerificationRequest
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

function envPresent(name: string) {
  return Boolean(process.env[name]?.trim());
}

function report(
  provider: DatasetConnectionProfile["provider"],
  status: DatasetConnectionVerificationReport["status"],
  statusLabel: string,
  diagnostics: string[],
  nextStep: string,
  connectionId?: string
): DatasetConnectionVerificationReport {
  return {
    provider,
    connectionId,
    status,
    statusLabel,
    checkedAt: new Date().toISOString(),
    diagnostics,
    nextStep
  };
}

function verifySnowflake(connectionId?: string): DatasetConnectionVerificationReport {
  const readiness = getSnowflakeReadiness(process.env);
  if (!readiness.configured) {
    return report(
      "snowflake",
      "not_configured",
      "Missing server environment",
      [`Missing Snowflake environment variables: ${readiness.missingEnvVars.join(", ")}.`],
      "Add Snowflake credentials and read-only warehouse settings to Netlify environment variables, then run full non-production verification.",
      connectionId
    );
  }

  return report(
    "snowflake",
    "ready_to_verify",
    "Ready for server verification",
    [
      "Snowflake server environment variables are present.",
      "This readiness check does not execute warehouse SQL; full read-only verification should run next."
    ],
    "Run the existing non-production Snowflake verification before exposing live tables in the workspace.",
    connectionId
  );
}

function verifySupabase(connectionId?: string): DatasetConnectionVerificationReport {
  const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  const missing = required.filter((name) => !envPresent(name));
  if (missing.length) {
    return report(
      "supabase",
      "not_configured",
      "Missing server environment",
      [`Missing Supabase server environment variables: ${missing.join(", ")}.`],
      "Add Supabase server-side credentials before workspace database sync can be verified.",
      connectionId
    );
  }

  return report(
    "supabase",
    "ready_to_verify",
    "Ready for server verification",
    ["Supabase server environment variables are present."],
    "Add a bounded table-access check for workspace dataset storage before enabling sync.",
    connectionId
  );
}

function verifyPostgres(connectionId?: string): DatasetConnectionVerificationReport {
  const required = ["POSTGRES_DATABASE_URL"];
  const missing = required.filter((name) => !envPresent(name));
  if (missing.length) {
    return report(
      "postgres",
      "not_configured",
      "Missing server environment",
      [`Missing Postgres server environment variables: ${missing.join(", ")}.`],
      "Add a read-only Postgres connection URL and table allowlist before verification.",
      connectionId
    );
  }

  return report(
    "postgres",
    "ready_to_verify",
    "Ready for server verification",
    ["Postgres connection URL is present."],
    "Add read-only table allowlist verification before exposing direct Postgres sources.",
    connectionId
  );
}

function verifyNetlify(connectionId?: string): DatasetConnectionVerificationReport {
  if (!envPresent("NETLIFY_DATABASE_URL")) {
    return report(
      "netlify",
      "not_configured",
      "Missing Netlify Database",
      ["NETLIFY_DATABASE_URL is not present for this server environment."],
      "Connect Netlify Database for hosted imported rows and rerun dataset imports.",
      connectionId
    );
  }

  return report(
    "netlify",
    "ready_to_verify",
    "Ready for import storage checks",
    ["Netlify Database environment appears available."],
    "Run a bounded imported-row storage check before relying on hosted dataset rows.",
    connectionId
  );
}

function verifyConnection(payload: DatasetConnectionVerificationRequest): DatasetConnectionVerificationReport {
  if (payload.provider === "snowflake") return verifySnowflake(payload.connectionId);
  if (payload.provider === "supabase") return verifySupabase(payload.connectionId);
  if (payload.provider === "postgres") return verifyPostgres(payload.connectionId);
  if (payload.provider === "netlify") return verifyNetlify(payload.connectionId);

  return report(
    payload.provider,
    "unsupported",
    "Unsupported provider",
    [`${payload.provider} does not have a verification scaffold yet.`],
    "Choose Snowflake, Supabase, Postgres, or Netlify Database."
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
    const payload = JSON.parse(event.body) as DatasetConnectionVerificationRequest;
    if (!payload.provider) return errorResponse(400, "Missing connection provider.");

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify(verifyConnection(payload))
    };
  } catch (error) {
    return errorResponse(500, "Dataset connection verification failed.", [error instanceof Error ? error.message : "Unknown error"]);
  }
};
