export type DatasetSourceKind = "seeded_demo" | "imported_file" | "workspace_database" | "live_connection";
export type DatasetSourceProvider = "ecofocus_demo" | "local_file" | "netlify" | "supabase" | "snowflake" | "postgres";

export interface DatasetSourceRef {
  id: string;
  kind: DatasetSourceKind;
  provider: DatasetSourceProvider;
  label: string;
  datasetId: string;
  connectionId?: string;
  remoteRecordId?: string;
  objectPath?: string;
}
