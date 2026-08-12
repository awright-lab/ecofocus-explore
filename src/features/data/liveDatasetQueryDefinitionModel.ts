import type {
  LiveDatasetFieldDescriptor,
  LiveDatasetQueryDefinition,
  LiveDatasetQueryDefinitionKind,
  LiveDatasetQueryDefinitionMetric,
  LiveDatasetSourceDescriptor
} from "../../../shared/types/dataSource";

export interface LiveDatasetQueryDefinitionDraft {
  canSave: boolean;
  kind: LiveDatasetQueryDefinitionKind | null;
  label: string;
  summary: string;
  reason: string;
  primaryField?: LiveDatasetFieldDescriptor;
  measureField?: LiveDatasetFieldDescriptor;
  breakoutField?: LiveDatasetFieldDescriptor;
  metric: LiveDatasetQueryDefinitionMetric;
  outputMode: LiveDatasetQueryDefinition["outputMode"];
}

export interface LiveDatasetQueryDefinitionReadiness {
  statusLabel: string;
  reason: string;
  nextStep: string;
  canExecute: false;
  tone: "pending" | "stale" | "blocked";
}

function nowId() {
  return new Date().toISOString().replace(/[^0-9]/g, "");
}

function fieldByRole(source: LiveDatasetSourceDescriptor, predicate: (field: LiveDatasetFieldDescriptor) => boolean) {
  return (source.inspection?.fields ?? []).find(predicate);
}

function fieldById(source: LiveDatasetSourceDescriptor, fieldId: string | undefined) {
  if (!fieldId) return undefined;
  return (source.inspection?.fields ?? []).find((field) => field.id === fieldId);
}

export function liveDatasetQueryDefinitionLabel(kind: LiveDatasetQueryDefinitionKind, primaryField: LiveDatasetFieldDescriptor, measureField?: LiveDatasetFieldDescriptor) {
  if (kind === "measure" && measureField) return `Average ${measureField.label} by ${primaryField.label}`;
  return `Responses by ${primaryField.label}`;
}

export function buildLiveDatasetQueryDefinitionDraft(source: LiveDatasetSourceDescriptor): LiveDatasetQueryDefinitionDraft {
  if (source.status !== "available") {
    return {
      canSave: false,
      kind: null,
      label: "Live query definition unavailable",
      summary: "The source is not available.",
      reason: "Verify or remap the live source before saving a query definition.",
      metric: "count",
      outputMode: "table"
    };
  }

  if (source.inspection?.status !== "inspected") {
    return {
      canSave: false,
      kind: null,
      label: "Inspect fields first",
      summary: "No inspected field metadata is available.",
      reason: "Inspect the table or view fields before saving a live query definition.",
      metric: "count",
      outputMode: "table"
    };
  }

  const groupField = fieldByRole(source, (field) => field.modelingRole === "dimension");
  const measureField = fieldByRole(source, (field) => field.modelingRole === "measure");

  if (!groupField) {
    return {
      canSave: false,
      kind: null,
      label: "Model a group field",
      summary: "Live query definitions need at least one field modeled as a group.",
      reason: "Mark a categorical/text field as Group before saving a first live table definition.",
      metric: "count",
      outputMode: "table"
    };
  }

  if (measureField) {
    return {
      canSave: true,
      kind: "measure",
      label: liveDatasetQueryDefinitionLabel("measure", groupField, measureField),
      summary: `Average ${measureField.label} grouped by ${groupField.label}.`,
      reason: "This definition is ready to save as metadata. Live execution still needs the provider query runner.",
      primaryField: groupField,
      measureField,
      metric: "average",
      outputMode: "table"
    };
  }

  return {
    canSave: true,
    kind: "categorical",
    label: liveDatasetQueryDefinitionLabel("categorical", groupField),
    summary: `Count responses grouped by ${groupField.label}.`,
    reason: "This definition is ready to save as metadata. Live execution still needs the provider query runner.",
    primaryField: groupField,
    metric: "count",
    outputMode: "table"
  };
}

export function createLiveDatasetQueryDefinition(source: LiveDatasetSourceDescriptor): LiveDatasetQueryDefinition | null {
  const draft = buildLiveDatasetQueryDefinitionDraft(source);
  if (!draft.canSave || !draft.kind || !draft.primaryField) return null;

  const timestamp = new Date().toISOString();
  return {
    id: `live_query_definition_${nowId()}`,
    label: draft.label,
    sourceRefId: source.sourceRef.id,
    kind: draft.kind,
    primaryFieldId: draft.primaryField.id,
    primaryFieldLabel: draft.primaryField.label,
    measureFieldId: draft.measureField?.id,
    measureFieldLabel: draft.measureField?.label,
    breakoutFieldId: draft.breakoutField?.id,
    breakoutFieldLabel: draft.breakoutField?.label,
    metric: draft.metric,
    outputMode: draft.outputMode,
    status: "execution_pending",
    statusLabel: "Execution pending",
    notes: [
      draft.summary,
      "Saved from live source field roles. Provider execution is intentionally not enabled in this scaffold."
    ],
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function liveDatasetQueryDefinitionSummary(definition: LiveDatasetQueryDefinition) {
  const metricLabel: Record<LiveDatasetQueryDefinitionMetric, string> = {
    count: "Count",
    percent: "% of rows",
    average: "Average",
    sum: "Sum"
  };

  return [
    definition.kind === "measure" && definition.measureFieldLabel
      ? `${metricLabel[definition.metric]} ${definition.measureFieldLabel}`
      : `${metricLabel[definition.metric]} ${definition.primaryFieldLabel}`,
    `Grouped by ${definition.primaryFieldLabel}`,
    definition.breakoutFieldLabel ? `Breakout: ${definition.breakoutFieldLabel}` : null,
    definition.statusLabel
  ].filter(Boolean).join(" · ");
}

export function buildLiveDatasetQueryDefinitionReadiness(
  source: LiveDatasetSourceDescriptor,
  definition: LiveDatasetQueryDefinition
): LiveDatasetQueryDefinitionReadiness {
  if (source.status !== "available") {
    return {
      statusLabel: "Source unavailable",
      reason: "The live source is not currently available.",
      nextStep: "Verify or remap the source before this definition can be executed later.",
      canExecute: false,
      tone: "blocked"
    };
  }

  if (source.inspection?.status !== "inspected") {
    return {
      statusLabel: "Needs field inspection",
      reason: "The source no longer has inspected field metadata.",
      nextStep: "Inspect fields again before relying on this saved definition.",
      canExecute: false,
      tone: "blocked"
    };
  }

  const primaryField = fieldById(source, definition.primaryFieldId);
  if (!primaryField) {
    return {
      statusLabel: "Primary field missing",
      reason: `${definition.primaryFieldLabel} is not present in the inspected field list.`,
      nextStep: "Refresh fields or remove this stale definition.",
      canExecute: false,
      tone: "stale"
    };
  }

  if (definition.kind === "categorical" && primaryField.modelingRole !== "dimension") {
    return {
      statusLabel: "Role changed",
      reason: `${definition.primaryFieldLabel} must be modeled as Group for this categorical definition.`,
      nextStep: "Model the primary field as Group or save a new definition.",
      canExecute: false,
      tone: "stale"
    };
  }

  if (definition.kind === "measure") {
    const measureField = fieldById(source, definition.measureFieldId);
    if (primaryField.modelingRole !== "dimension") {
      return {
        statusLabel: "Group role changed",
        reason: `${definition.primaryFieldLabel} must be modeled as Group for this measure definition.`,
        nextStep: "Model the grouping field as Group or save a new definition.",
        canExecute: false,
        tone: "stale"
      };
    }
    if (!measureField || measureField.modelingRole !== "measure") {
      return {
        statusLabel: "Measure field unavailable",
        reason: `${definition.measureFieldLabel ?? "The measure field"} must be present and modeled as Measure.`,
        nextStep: "Model the measure field again or save a new definition.",
        canExecute: false,
        tone: "stale"
      };
    }
  }

  if (definition.breakoutFieldId) {
    const breakoutField = fieldById(source, definition.breakoutFieldId);
    if (!breakoutField || breakoutField.modelingRole !== "dimension" || !breakoutField.eligibleForBanner) {
      return {
        statusLabel: "Breakout unavailable",
        reason: `${definition.breakoutFieldLabel ?? "The breakout field"} must be modeled as a banner-ready Group field.`,
        nextStep: "Update the breakout field role or save a new definition.",
        canExecute: false,
        tone: "stale"
      };
    }
  }

  return {
    statusLabel: "Execution pending",
    reason: "This live query definition matches the current modeled fields.",
    nextStep: "Add the provider query runner before creating live tables or charts from this definition.",
    canExecute: false,
    tone: "pending"
  };
}

export function buildLiveDatasetSourceQueryDefinitionSummary(source: LiveDatasetSourceDescriptor) {
  const definitions = source.queryDefinitions ?? [];
  const readiness = definitions.map((definition) => buildLiveDatasetQueryDefinitionReadiness(source, definition));
  const staleDefinitions = readiness.filter((item) => item.tone === "stale" || item.tone === "blocked").length;

  return {
    definitions,
    savedCount: definitions.length,
    staleCount: staleDefinitions,
    statusLabel:
      definitions.length === 0
        ? "No query definitions"
        : staleDefinitions > 0
          ? "Definitions need review"
          : "Definitions saved",
    guidance:
      definitions.length === 0
        ? "Save a live query definition from modeled fields before adding execution support."
        : staleDefinitions > 0
          ? "Some saved definitions no longer match the current inspected field roles."
          : "Live query definitions are saved as metadata. Execution still needs the provider query runner.",
    canExecute: false as const
  };
}
