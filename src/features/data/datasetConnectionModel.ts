import type { DatasetConnectionProfile, LiveDatasetSourceDescriptor, LiveDatasetSourceStatus } from "../../../shared/types/dataSource";

export interface DatasetConnectionOption {
  provider: DatasetConnectionProfile["provider"];
  label: string;
  description: string;
  bestFor: string;
  statusLabel: string;
  setupRequirements: string[];
  nextStep: string;
}

export const datasetConnectionOptions: DatasetConnectionOption[] = [
  {
    provider: "snowflake",
    label: "Snowflake",
    description: "Connect governed warehouse tables for live survey or operational datasets.",
    bestFor: "Enterprise warehouse sync",
    statusLabel: "Provider foundation ready",
    setupRequirements: ["Account and warehouse", "Database and schema", "Read-only role", "Allowed tables or views"],
    nextStep: "Add a server-side verification step that checks read-only access before exposing live tables."
  },
  {
    provider: "supabase",
    label: "Supabase",
    description: "Use a Postgres-backed project for workspace datasets and future app-owned tables.",
    bestFor: "Workspace database",
    statusLabel: "Storage path available",
    setupRequirements: ["Project URL", "Service role secret on the server", "Dataset table or storage bucket", "Row and field metadata tables"],
    nextStep: "Promote uploaded datasets into managed workspace tables and verify queryable row access."
  },
  {
    provider: "postgres",
    label: "Postgres",
    description: "Prepare for direct SQL-backed datasets using the same source contract.",
    bestFor: "Custom database source",
    statusLabel: "Adapter planned",
    setupRequirements: ["Host and database", "Read-only user", "Schema and table allowlist", "Query timeout policy"],
    nextStep: "Add a generic Postgres adapter after the source registry supports verified table descriptors."
  },
  {
    provider: "netlify",
    label: "Netlify Database",
    description: "Store larger imported datasets outside browser storage for smoother analysis.",
    bestFor: "Hosted imported rows",
    statusLabel: "Import storage available",
    setupRequirements: ["Netlify Database URL", "Import functions deployed", "Dataset row table", "Field paging endpoint"],
    nextStep: "Use this for uploaded file storage; it is not a general live warehouse connector yet."
  }
];

export function buildDatasetConnectionProfiles(now = new Date().toISOString()): DatasetConnectionProfile[] {
  return datasetConnectionOptions.map((option) => ({
    id: `connection_${option.provider}`,
    provider: option.provider,
    label: option.label,
    description: option.description,
    status: "setup_scaffold",
    statusLabel: option.statusLabel,
    createdAt: now,
    updatedAt: now
  }));
}

export function datasetConnectionOption(provider: DatasetConnectionProfile["provider"]) {
  return datasetConnectionOptions.find((option) => option.provider === provider) ?? datasetConnectionOptions[0];
}

function liveSourceStatusForConnection(connection: DatasetConnectionProfile): LiveDatasetSourceStatus {
  if (connection.verification?.status === "verified" || connection.status === "sync_ready") return "available";
  if (connection.verification?.status === "ready_to_verify" || connection.status === "configured") return "needs_verification";
  if (connection.verification?.status === "unsupported") return "unsupported";
  return "unavailable";
}

function liveSourceStatusLabel(status: LiveDatasetSourceStatus, connection: DatasetConnectionProfile) {
  if (status === "available") return "Ready for live source setup";
  if (status === "needs_verification") return "Needs server verification before live queries";
  if (status === "unsupported") return "Provider not supported yet";
  return connection.verification?.statusLabel ?? "Connection setup incomplete";
}

function defaultObjectPathForConnection(connection: DatasetConnectionProfile) {
  const database = connection.connectionSummary?.database ?? "ANALYTICS";
  const schema = connection.connectionSummary?.schema ?? "PUBLIC";
  if (connection.provider === "snowflake") return `${database}.${schema}.RESPONSES`;
  if (connection.provider === "netlify") return "workspace.imported_datasets";
  if (connection.provider === "supabase") return "public.imported_datasets";
  return "public.responses";
}

export function buildLiveDatasetSourceDescriptorForConnection(connection: DatasetConnectionProfile): LiveDatasetSourceDescriptor {
  const status = liveSourceStatusForConnection(connection);
  const objectPath = defaultObjectPathForConnection(connection);
  const datasetId = `live_${connection.id.replace(/^connection_/, "")}_default`;
  const label = `${connection.label} source`;

  return {
    connectionId: connection.id,
    objectType: "table",
    objectPath,
    label,
    syncMode: connection.provider === "netlify" ? "snapshot" : "live_query",
    status,
    statusLabel: liveSourceStatusLabel(status, connection),
    sourceRef: {
      id: `live:${connection.provider}:${connection.id}:default`,
      kind: "live_connection",
      provider: connection.provider,
      label,
      datasetId,
      connectionId: connection.id,
      objectPath
    }
  };
}
