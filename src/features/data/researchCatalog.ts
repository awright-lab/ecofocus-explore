import type { ImportedDatasetField, ImportedDatasetRecord } from "../../../shared/types/dashboard";
import type { QuestionMetadata } from "../../../shared/metadata/ecofocus2025";
import { researchSearchMatcher } from "./researchSearch";
import { importedFieldDisplayLabel, importedFieldAnswerChoices } from "./datasetModelingModel";
import { buildImportedFieldSuitability } from "./importedDatasetAnalytics";

export type ResearchCatalogEntry = {
  key: string;
  studyId: string;
  studyTitle: string;
  label: string;
  code: string;
  topic: string;
  concepts: string[];
  wording: string;
  answers: string[];
  kind: "imported" | "sample";
  field?: ImportedDatasetField;
  question?: QuestionMetadata;
  available: boolean;
};

export function importedResearchCatalog(studies: ImportedDatasetRecord[]): ResearchCatalogEntry[] {
  return studies.flatMap(study => study.fields.map(field => ({
    key: JSON.stringify(["imported", study.id, field.id]), studyId: study.id, studyTitle: study.title,
    label: importedFieldDisplayLabel(field), code: field.sourceColumn,
    wording: field.variableLabel || field.label, topic: field.researchTopic?.trim() || "Uncategorized",
    concepts: field.researchConcepts ?? [],
    // Only declared answer labels; sampleValues/raw respondent values are never indexed.
    answers: Object.values(field.valueLabels ?? {}), kind: "imported" as const, field,
    available: buildImportedFieldSuitability(field).recommendedQueryMode !== "modeling" && field.nonEmptyCount > 0
  })));
}

export function sampleResearchCatalog(studyId: string, title: string, questions: QuestionMetadata[]): ResearchCatalogEntry[] {
  return questions.map(question => ({ key: JSON.stringify(["sample", studyId, question.id]), studyId,
    studyTitle: title, label: question.shortLabel, code: question.sourceColumn, wording: question.label,
    topic: question.topic, concepts: [], answers: question.options.map(option => option.label),
    kind: "sample", question, available: true }));
}

export function filterResearchCatalog(entries: ResearchCatalogEntry[], query: string, studyId = "", topic = "") {
  const matches = researchSearchMatcher(query);
  return entries.filter(entry => (!studyId || entry.studyId === studyId) && (!topic || entry.topic === topic) &&
    matches([entry.wording, entry.label, entry.code, entry.studyTitle, entry.topic, ...entry.concepts, ...entry.answers]));
}

export function parseResearchLabels(topic: string, concepts: string) {
  const researchTopic = topic.trim();
  const researchConcepts = [...new Set(concepts.split(",").map(value => value.trim()).filter(Boolean))];
  if (researchTopic.length > 120) throw new Error("Keep the topic within 120 characters.");
  if (researchConcepts.length > 20 || researchConcepts.some(value => value.length > 80)) throw new Error("Use up to 20 concepts, each within 80 characters.");
  return { researchTopic, researchConcepts };
}

export function researchAnswerPreview(entry: ResearchCatalogEntry) {
  return entry.field ? importedFieldAnswerChoices(entry.field).slice(0, 8).map(answer => answer.label) : entry.answers.slice(0, 8);
}
