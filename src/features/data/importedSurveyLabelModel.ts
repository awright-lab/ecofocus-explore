import type { ImportedDatasetField } from "../../../shared/types/dashboard";

export interface ImportedSurveyQuestionLabel {
  code: string | null;
  hasExplicitCode: boolean;
  text: string;
  prompt: string | null;
  fullLabel: string;
}

export function parseImportedSurveyQuestionLabel(field: ImportedDatasetField | null | undefined): ImportedSurveyQuestionLabel {
  const fullLabel = field?.variableLabel?.trim() || field?.label?.trim() || field?.sourceColumn || "selected field";
  const codeMatch = fullLabel.match(/^([A-Za-z][A-Za-z0-9_]*):\s*(.+)$/);
  const code = codeMatch?.[1] ?? field?.sourceColumn ?? null;
  const body = codeMatch?.[2]?.trim() || fullLabel;
  const splitBody = body.split(/\s+-\s+/);
  const text = splitBody[0]?.trim() || body;
  const prompt = splitBody.length > 1 ? splitBody.slice(1).join(" - ").trim() : null;

  return {
    code,
    hasExplicitCode: Boolean(codeMatch),
    text,
    prompt,
    fullLabel
  };
}

export function importedSurveyQuestionDisplayLabel(field: ImportedDatasetField | null | undefined) {
  const parsed = parseImportedSurveyQuestionLabel(field);
  return parsed.hasExplicitCode && parsed.code && parsed.text && !parsed.text.startsWith(`${parsed.code}:`)
    ? `${parsed.code}: ${parsed.text}`
    : parsed.text || parsed.fullLabel;
}

export function importedSurveyQuestionPrompt(field: ImportedDatasetField | null | undefined) {
  return parseImportedSurveyQuestionLabel(field).prompt;
}
