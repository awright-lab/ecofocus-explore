import type { DatasetConnectionProfile } from "../../../shared/types/dataSource";

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
