export interface PreparationStep {
  id: string;
  fieldId: string;
  sourceColumn: string;
  kind: "trim" | "lowercase" | "uppercase" | "collapse_spaces" | "recode";
  from: string[];
  to: string;
}
export interface StudyPreparation {
  version: 1;
  sourceDatasetId: string;
  sourceImportedAt: string;
  sourceFingerprint: string;
  steps: PreparationStep[];
}

export function assertStudyPreparation(value: unknown): asserts value is StudyPreparation | undefined {
  if (value === undefined) return;
  const object = (item: unknown): item is Record<string, unknown> => !!item && typeof item === "object" && !Array.isArray(item);
  const fail = () => { throw Error("The saved data-preparation history is damaged. Saved data has not been changed."); };
  if (!object(value) || value.version !== 1 || typeof value.sourceDatasetId !== "string" || !value.sourceDatasetId || typeof value.sourceImportedAt !== "string" || !Number.isFinite(Date.parse(value.sourceImportedAt)) || typeof value.sourceFingerprint !== "string" || !/^[a-f0-9]{64}$/.test(value.sourceFingerprint) || !Array.isArray(value.steps) || value.steps.length < 1 || value.steps.length > 30) fail();
  const recipe = value as unknown as StudyPreparation, ids = new Set<string>();
  for (const step of recipe.steps) {
    if (!object(step) || ![step.id, step.fieldId, step.sourceColumn].every(item => typeof item === "string" && item.length > 0 && item.length <= 256) || ids.has(step.id) || !["trim", "lowercase", "uppercase", "collapse_spaces", "recode"].includes(step.kind) || !Array.isArray(step.from) || step.from.length > 100 || step.from.some(item => typeof item !== "string" || item.length > 512) || new Set(step.from).size !== step.from.length || typeof step.to !== "string" || step.to.length > 512 || (step.kind === "recode" ? step.from.length < 1 : step.from.length !== 0 || step.to !== "")) fail();
    ids.add(step.id);
  }
}
