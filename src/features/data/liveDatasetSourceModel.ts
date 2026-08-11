import type { LiveDatasetSourceDescriptor } from "../../../shared/types/dataSource";

export interface LiveDatasetSourceReadinessView {
  statusLabel: string;
  structureLabel: string;
  readinessNote: string;
  canCreateQuery: boolean;
  actionLabel: string;
}

export function buildLiveDatasetSourceReadinessView(source: LiveDatasetSourceDescriptor): LiveDatasetSourceReadinessView {
  const structureParts = [
    source.rowCountEstimate !== undefined ? `${source.rowCountEstimate.toLocaleString()} est. rows` : null,
    source.fieldCount !== undefined ? `${source.fieldCount.toLocaleString()} fields` : null
  ].filter(Boolean);

  const base = {
    structureLabel: structureParts.length ? structureParts.join(" · ") : "Mapping saved",
    canCreateQuery: false,
    actionLabel: "Query soon"
  };

  if (source.status === "available") {
    return {
      ...base,
      statusLabel: "Ready",
      readinessNote: "Mapped source. Live query creation is not enabled yet."
    };
  }

  if (source.status === "needs_verification") {
    return {
      ...base,
      statusLabel: "Verify",
      readinessNote: "Server verification needed before live query setup."
    };
  }

  if (source.status === "unsupported") {
    return {
      ...base,
      statusLabel: "Unsupported",
      readinessNote: "Provider support is not available yet."
    };
  }

  return {
    ...base,
    statusLabel: "Unavailable",
    readinessNote: "Connection setup is incomplete."
  };
}
