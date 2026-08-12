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

export type DatasetConnectionStatus = "setup_scaffold" | "configured" | "sync_ready" | "disabled";
export type LiveDatasetSourceStatus = "available" | "needs_verification" | "unavailable" | "unsupported";
export type DatasetConnectionVerificationStatus = "not_configured" | "ready_to_verify" | "verified" | "failed" | "unsupported";
export type LiveDatasetSourceInspectionStatus = "not_inspected" | "inspected" | "failed" | "unsupported";
export type LiveDatasetFieldRole = "unmodeled" | "dimension" | "measure" | "date" | "identifier";
export type LiveDatasetQueryDefinitionKind = "categorical" | "measure";
export type LiveDatasetQueryDefinitionMetric = "count" | "percent" | "average" | "sum";
export type LiveDatasetQueryDefinitionStatus = "definition_ready" | "execution_pending" | "unsupported";

export interface DatasetConnectionProfile {
  id: string;
  provider: Exclude<DatasetSourceProvider, "ecofocus_demo" | "local_file">;
  label: string;
  description: string;
  status: DatasetConnectionStatus;
  statusLabel: string;
  connectionSummary?: {
    account?: string;
    database?: string;
    schema?: string;
    projectUrl?: string;
  };
  verification?: {
    status: DatasetConnectionVerificationStatus;
    statusLabel: string;
    checkedAt: string;
    diagnostics: string[];
    nextStep: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface LiveDatasetSourceDescriptor {
  sourceRef: DatasetSourceRef;
  connectionId: string;
  objectType: "table" | "view" | "query";
  objectPath: string;
  label: string;
  rowCountEstimate?: number;
  fieldCount?: number;
  syncMode: "live_query" | "snapshot";
  status: LiveDatasetSourceStatus;
  statusLabel: string;
  queryDefinitions?: LiveDatasetQueryDefinition[];
  inspection?: {
    status: LiveDatasetSourceInspectionStatus;
    statusLabel: string;
    inspectedAt: string;
    fields: LiveDatasetFieldDescriptor[];
    diagnostics: string[];
    nextStep: string;
  };
}

export interface LiveDatasetQueryDefinition {
  id: string;
  label: string;
  sourceRefId: string;
  kind: LiveDatasetQueryDefinitionKind;
  primaryFieldId: string;
  primaryFieldLabel: string;
  measureFieldId?: string;
  measureFieldLabel?: string;
  breakoutFieldId?: string;
  breakoutFieldLabel?: string;
  metric: LiveDatasetQueryDefinitionMetric;
  outputMode: "table" | "chart";
  status: LiveDatasetQueryDefinitionStatus;
  statusLabel: string;
  notes: string[];
  createdAt: string;
  updatedAt: string;
}

export interface LiveDatasetFieldDescriptor {
  id: string;
  label: string;
  rawName: string;
  type: "text" | "number" | "date" | "boolean" | "unknown";
  modelingRole?: LiveDatasetFieldRole;
  eligibleForFilter?: boolean;
  eligibleForSegment?: boolean;
  eligibleForBanner?: boolean;
  nullable?: boolean;
  sourceType?: string;
  distinctEstimate?: number;
}

export interface DatasetConnectionVerificationRequest {
  provider: DatasetConnectionProfile["provider"];
  connectionId?: string;
}

export interface DatasetConnectionVerificationReport {
  provider: DatasetConnectionProfile["provider"];
  connectionId?: string;
  status: DatasetConnectionVerificationStatus;
  statusLabel: string;
  checkedAt: string;
  diagnostics: string[];
  nextStep: string;
}

export interface LiveDatasetSourceInspectionRequest {
  provider: DatasetConnectionProfile["provider"];
  connectionId: string;
  sourceRefId: string;
  objectPath: string;
  objectType: LiveDatasetSourceDescriptor["objectType"];
  limit?: number;
}

export interface LiveDatasetSourceInspectionReport {
  provider: DatasetConnectionProfile["provider"];
  connectionId: string;
  sourceRefId: string;
  objectPath: string;
  objectType: LiveDatasetSourceDescriptor["objectType"];
  status: LiveDatasetSourceInspectionStatus;
  statusLabel: string;
  inspectedAt: string;
  fields: LiveDatasetFieldDescriptor[];
  diagnostics: string[];
  nextStep: string;
}
