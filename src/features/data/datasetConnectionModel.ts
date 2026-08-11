import type { DatasetConnectionProfile } from "../../../shared/types/dataSource";

export interface DatasetConnectionOption {
  provider: DatasetConnectionProfile["provider"];
  label: string;
  description: string;
  bestFor: string;
  statusLabel: string;
}

export const datasetConnectionOptions: DatasetConnectionOption[] = [
  {
    provider: "snowflake",
    label: "Snowflake",
    description: "Connect governed warehouse tables for live survey or operational datasets.",
    bestFor: "Enterprise warehouse sync",
    statusLabel: "Provider foundation ready"
  },
  {
    provider: "supabase",
    label: "Supabase",
    description: "Use a Postgres-backed project for workspace datasets and future app-owned tables.",
    bestFor: "Workspace database",
    statusLabel: "Storage path available"
  },
  {
    provider: "postgres",
    label: "Postgres",
    description: "Prepare for direct SQL-backed datasets using the same source contract.",
    bestFor: "Custom database source",
    statusLabel: "Adapter planned"
  },
  {
    provider: "netlify",
    label: "Netlify Database",
    description: "Store larger imported datasets outside browser storage for smoother analysis.",
    bestFor: "Hosted imported rows",
    statusLabel: "Import storage available"
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
