import type { LiveDatasetFieldDescriptor, LiveDatasetFieldRole, LiveDatasetSourceDescriptor } from "../../../shared/types/dataSource";

export interface LiveDatasetFieldModelingView {
  role: LiveDatasetFieldRole;
  roleLabel: string;
  typeLabel: string;
  readinessLabel: string;
  readinessTone: "ready" | "measure" | "metadata" | "review";
  helper: string;
  chips: string[];
}

export interface LiveDatasetSourceFieldModelingSummary {
  inspectedFields: number;
  modeledFields: number;
  dimensions: number;
  measures: number;
  dateFields: number;
  identifiers: number;
  filterReadyFields: number;
  bannerReadyFields: number;
  statusLabel: string;
  guidance: string;
  chips: string[];
}

export type LiveDatasetFieldModelingUpdate = Partial<Pick<
  LiveDatasetFieldDescriptor,
  "modelingRole" | "eligibleForFilter" | "eligibleForSegment" | "eligibleForBanner"
>>;

const identifierNamePattern = /(^|_)(id|uuid|record|respondent|case|serial|key)($|_)/i;

export const liveDatasetFieldRoleOptions: Array<{ id: LiveDatasetFieldRole; label: string; helper: string }> = [
  { id: "unmodeled", label: "Review", helper: "Keep as inspected metadata until a role is chosen." },
  { id: "dimension", label: "Group", helper: "Use as a categorical grouping, filter, segment, or breakout field later." },
  { id: "measure", label: "Measure", helper: "Use as a numeric value for averages or sums later." },
  { id: "date", label: "Date", helper: "Preserve for future date grouping or trend support." },
  { id: "identifier", label: "Identifier", helper: "Keep as row identity or lookup metadata, not analysis." }
];

export function liveDatasetFieldTypeLabel(type: LiveDatasetFieldDescriptor["type"]) {
  const labels: Record<LiveDatasetFieldDescriptor["type"], string> = {
    text: "Text",
    number: "Number",
    date: "Date",
    boolean: "Boolean",
    unknown: "Unknown"
  };
  return labels[type];
}

export function liveDatasetFieldRoleLabel(role: LiveDatasetFieldRole | undefined) {
  return liveDatasetFieldRoleOptions.find((option) => option.id === (role ?? "unmodeled"))?.label ?? "Review";
}

export function suggestedLiveDatasetFieldRole(field: LiveDatasetFieldDescriptor): LiveDatasetFieldRole {
  const rawName = field.rawName || field.id;

  if (identifierNamePattern.test(rawName)) return "identifier";
  if (field.type === "date") return "date";
  if (field.type === "number") return "measure";
  if (field.type === "text" || field.type === "boolean") return "dimension";

  return "unmodeled";
}

export function suggestedLiveDatasetFieldModeling(field: LiveDatasetFieldDescriptor): Required<Pick<
  LiveDatasetFieldDescriptor,
  "modelingRole" | "eligibleForFilter" | "eligibleForSegment" | "eligibleForBanner"
>> {
  const role = suggestedLiveDatasetFieldRole(field);
  const isDimension = role === "dimension";

  return {
    modelingRole: role,
    eligibleForFilter: isDimension,
    eligibleForSegment: isDimension,
    eligibleForBanner: isDimension
  };
}

export function buildLiveDatasetFieldModelingView(field: LiveDatasetFieldDescriptor): LiveDatasetFieldModelingView {
  const role = field.modelingRole ?? "unmodeled";
  const typeLabel = liveDatasetFieldTypeLabel(field.type);
  const roleLabel = liveDatasetFieldRoleLabel(role);
  const eligibility = [
    field.eligibleForFilter ? "Filter" : null,
    field.eligibleForSegment ? "Segment" : null,
    field.eligibleForBanner ? "Breakout" : null
  ].filter((item): item is string => Boolean(item));

  if (role === "dimension") {
    return {
      role,
      roleLabel,
      typeLabel,
      readinessLabel: "Modeled for grouping",
      readinessTone: "ready",
      helper: "This live field is marked as a grouping field for future live filters, segments, and breakouts.",
      chips: [typeLabel, roleLabel, ...eligibility]
    };
  }

  if (role === "measure") {
    return {
      role,
      roleLabel,
      typeLabel,
      readinessLabel: "Modeled as measure",
      readinessTone: "measure",
      helper: "This live field is marked as a numeric measure for future averages or sums.",
      chips: [typeLabel, roleLabel]
    };
  }

  if (role === "date" || role === "identifier") {
    return {
      role,
      roleLabel,
      typeLabel,
      readinessLabel: role === "date" ? "Date metadata" : "Identifier metadata",
      readinessTone: "metadata",
      helper:
        role === "date"
          ? "Date fields are preserved for future live trend/date grouping support."
          : "Identifier fields stay available as source metadata but should not drive analysis.",
      chips: [typeLabel, roleLabel]
    };
  }

  return {
    role,
    roleLabel,
    typeLabel,
    readinessLabel: "Needs modeling",
    readinessTone: "review",
    helper: "Choose whether this live field should behave as a group, measure, date, identifier, or remain metadata.",
    chips: [typeLabel, roleLabel]
  };
}

export function buildLiveDatasetSourceFieldModelingSummary(source: LiveDatasetSourceDescriptor): LiveDatasetSourceFieldModelingSummary {
  const fields = source.inspection?.fields ?? [];
  const views = fields.map((field) => buildLiveDatasetFieldModelingView(field));
  const modeledFields = views.filter((view) => view.role !== "unmodeled").length;
  const dimensions = views.filter((view) => view.role === "dimension").length;
  const measures = views.filter((view) => view.role === "measure").length;
  const dateFields = views.filter((view) => view.role === "date").length;
  const identifiers = views.filter((view) => view.role === "identifier").length;
  const filterReadyFields = fields.filter((field) => field.eligibleForFilter).length;
  const bannerReadyFields = fields.filter((field) => field.eligibleForBanner).length;
  const statusLabel = !fields.length
    ? "No inspected fields"
    : modeledFields === 0
      ? "Needs field modeling"
      : modeledFields === fields.length
        ? "Fields modeled"
        : "Partially modeled";
  const guidance = !fields.length
    ? "Inspect a table or view before modeling live fields."
    : modeledFields === 0
      ? "Apply suggested roles or model the most important fields before live query setup is enabled."
      : "Field roles are saved as source metadata. Live query creation remains pending the next query-definition pass.";

  return {
    inspectedFields: fields.length,
    modeledFields,
    dimensions,
    measures,
    dateFields,
    identifiers,
    filterReadyFields,
    bannerReadyFields,
    statusLabel,
    guidance,
    chips: [
      `${modeledFields}/${fields.length} modeled`,
      `${dimensions} groups`,
      `${measures} measures`,
      `${filterReadyFields} filters`,
      `${bannerReadyFields} breakouts`
    ]
  };
}

export function applySuggestedLiveDatasetFieldModeling(fields: LiveDatasetFieldDescriptor[]) {
  return fields.map((field) => ({
    ...field,
    ...suggestedLiveDatasetFieldModeling(field)
  }));
}

export function updateLiveDatasetFieldModeling(
  fields: LiveDatasetFieldDescriptor[],
  fieldId: string,
  updates: LiveDatasetFieldModelingUpdate
) {
  return fields.map((field) =>
    field.id === fieldId
      ? {
          ...field,
          ...updates,
          eligibleForFilter: updates.modelingRole === "dimension" ? updates.eligibleForFilter ?? field.eligibleForFilter ?? true : false,
          eligibleForSegment: updates.modelingRole === "dimension" ? updates.eligibleForSegment ?? field.eligibleForSegment ?? true : false,
          eligibleForBanner: updates.modelingRole === "dimension" ? updates.eligibleForBanner ?? field.eligibleForBanner ?? true : false
        }
      : field
  );
}
