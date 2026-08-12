import type { LiveDatasetSourceDescriptor } from "../../../shared/types/dataSource";
import type { LiveAnalyticsSourceIdentity } from "../../../shared/types/analytics";
import { buildLiveDatasetSourceFieldModelingSummary } from "./liveDatasetFieldModel";
import { buildLiveDatasetSourceQueryDefinitionSummary } from "./liveDatasetQueryDefinitionModel";

export interface LiveDatasetSourceReadinessView {
  statusLabel: string;
  modeLabel: string;
  structureLabel: string;
  readinessNote: string;
  stageLabels: string[];
  canCreateQuery: boolean;
  actionLabel: string;
}

export interface LiveDatasetQueryDraft {
  sourceIdentity: LiveAnalyticsSourceIdentity;
  canCreateQuery: boolean;
  reason: string;
}

export function liveSourceIdentity(source: LiveDatasetSourceDescriptor): LiveAnalyticsSourceIdentity {
  return {
    kind: "live",
    sourceRef: source.sourceRef,
    connectionId: source.connectionId,
    provider: source.sourceRef.provider,
    datasetLabel: source.label,
    objectPath: source.objectPath,
    objectType: source.objectType,
    syncMode: source.syncMode,
    rowCountEstimate: source.rowCountEstimate,
    fieldCount: source.fieldCount
  };
}

export function buildLiveDatasetSourceReadinessView(source: LiveDatasetSourceDescriptor): LiveDatasetSourceReadinessView {
  const structureParts = [
    source.rowCountEstimate !== undefined ? `${source.rowCountEstimate.toLocaleString()} est. rows` : null,
    source.fieldCount !== undefined ? `${source.fieldCount.toLocaleString()} fields` : null
  ].filter(Boolean);

  const base = {
    modeLabel: source.syncMode === "live_query" ? "Live source" : "Snapshot source",
    structureLabel: structureParts.length ? structureParts.join(" · ") : source.inspection?.fields.length ? `${source.inspection.fields.length.toLocaleString()} inspected fields` : "Mapping saved",
    stageLabels: ["Server readiness", "Source mapping", "Query support pending"],
    canCreateQuery: false,
    actionLabel: "Manage setup"
  };

  if (source.status === "available") {
    if (source.inspection?.status === "inspected") {
      const fieldModeling = buildLiveDatasetSourceFieldModelingSummary(source);
      const definitionSummary = buildLiveDatasetSourceQueryDefinitionSummary(source);
      const hasModeledFields = fieldModeling.modeledFields > 0;
      const hasDefinitions = definitionSummary.savedCount > 0;
      return {
        ...base,
        statusLabel: hasDefinitions ? definitionSummary.statusLabel : hasModeledFields ? fieldModeling.statusLabel : "Fields inspected",
        stageLabels: [
          "Server readiness",
          "Source mapping",
          "Fields inspected",
          hasModeledFields ? "Field roles modeled" : "Field roles pending",
          ...(hasDefinitions ? ["Query definitions saved"] : []),
          "Query support pending"
        ],
        readinessNote: hasDefinitions
          ? definitionSummary.guidance
          : hasModeledFields
          ? "Field roles are modeled as source metadata. Live query creation still needs the live query definition pass."
          : "Field metadata is inspected. Map analytical roles before live query creation is enabled."
      };
    }

    return {
      ...base,
      statusLabel: "Mapped source",
      readinessNote: "Source mapping is saved. Query creation is pending provider-specific dataset support."
    };
  }

  if (source.status === "needs_verification") {
    return {
      ...base,
      statusLabel: "Needs server check",
      stageLabels: ["Server readiness needed", "Source mapping saved", "Query support pending"],
      readinessNote: "Run server verification before enabling live query setup."
    };
  }

  if (source.status === "unsupported") {
    return {
      ...base,
      statusLabel: "Query support pending",
      stageLabels: ["Server readiness", "Source mapping", "Provider support pending"],
      readinessNote: "Provider support is not available yet."
    };
  }

  return {
    ...base,
    statusLabel: "Unavailable",
    stageLabels: ["Connection setup needed", "Source mapping pending", "Query support pending"],
    readinessNote: "Connection setup is incomplete."
  };
}

export function buildLiveDatasetQueryDraft(source: LiveDatasetSourceDescriptor): LiveDatasetQueryDraft {
  const readiness = buildLiveDatasetSourceReadinessView(source);
  return {
    sourceIdentity: liveSourceIdentity(source),
    canCreateQuery: readiness.canCreateQuery,
    reason: readiness.canCreateQuery
      ? "Ready to create a live-source query."
      : readiness.readinessNote
  };
}
