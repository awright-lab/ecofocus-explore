import type { ImportedDatasetField, ImportedDatasetRecord } from "../../../shared/types/dashboard";
import type { SavedImportedAudience } from "../../../shared/types/audience";
import { currentJourneyFieldBindings, type JourneySetup } from "./questionJourneyModel";
import { audienceSourceIssue, compileAudience } from "../audiences/audienceModel";
import { getImportedDatasetQuerySupport } from "../data/importedDatasetAnalytics";
import { importedFieldDisplayLabel } from "../data/datasetModelingModel";

export type SuggestedPlanFields = Pick<JourneySetup, "datasetId" | "importedAt" | "fieldId" | "purpose" | "measureId" | "bannerId" | "metric" | "chartType" | "audienceId" | "fieldBindings">;
export type LocalQuestionSuggestion = { status: "clarify"; message: string } | {
  status: "ready";
  question: string;
  plan: SuggestedPlanFields;
  sourceBindings: {
    study: Pick<ImportedDatasetRecord, "id" | "importedAt" | "sourceType" | "sourceRef" | "fileName" | "fileType" | "rowCount" | "fieldCount">;
    grouping: ImportedDatasetField;
    measure: ImportedDatasetField | null;
    comparison: ImportedDatasetField | null;
  };
  audienceDefinition?: SavedImportedAudience;
  summary: Array<{ label: string; value: string; reason: string }>;
};

function name(value: string) { return value.normalize("NFKC").trim().replace(/^["“]|["”]$/g, "").replace(/[?!.]+$/, "").toLowerCase().replace(/[\s_-]+/g, " "); }
function fieldAliases(field: ImportedDatasetField) { return [field.label, field.sourceColumn, field.variableLabel, importedFieldDisplayLabel(field), ...(field.researchConcepts ?? [])].filter((value): value is string => Boolean(value)).map(name); }

// Grammar operators only apply outside balanced double-quoted names. Never
// strip quotes first: doing so can silently turn a field name into a query.
function splitOutsideNames(text: string, operators: string[]): [string, string] | null {
  if (/(^|\s)['\u2018]/.test(text)) throw Error("Use balanced double quotes for field and audience names, or choose the fields manually.");
  let closing = "";
  const positions: Array<{ start: number; end: number }> = [];
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === "\\" && /["\u201c\u201d]/.test(text[index + 1] ?? "")) throw Error("Escaped quotes in names need a manual field choice.");
    if (closing) {
      if (char === closing) closing = "";
      else if (/["\u201c\u201d]/.test(char)) throw Error("Use matching double quotes around each complete field or audience name.");
      continue;
    }
    if (char === '"' || char === "\u201c") { closing = char === '"' ? '"' : "\u201d"; continue; }
    if (char === "\u201d") throw Error("Use matching double quotes around each complete field or audience name.");
    const match = text.slice(index).match(/^\s+(for|by|across)\s+/i);
    if (match) {
      if (operators.includes(match[1].toLowerCase())) positions.push({ start: index, end: index + match[0].length });
      index += match[0].length - 1;
    }
  }
  if (closing) throw Error("A quoted name is unfinished. Close its double quotes or choose the fields manually.");
  if (positions.length > 1) throw Error("Multiple unquoted audience or grouping operators need clarification. Quote complete field names or choose the fields manually.");
  if (!positions.length) return null;
  const position = positions[0];
  return [text.slice(0, position.start).trim(), text.slice(position.end).trim()];
}

/** Local, bounded grammar over declared metadata. No inference service or query execution. */
export function suggestLocalQuestion(question: string, dataset: ImportedDatasetRecord | undefined, audiences: SavedImportedAudience[] = []): LocalQuestionSuggestion {
  const clarify = (message: string): LocalQuestionSuggestion => ({ status: "clarify", message });
  if (!dataset) return clarify("Choose a study before translating a question.");
  const sourceIssue = audienceSourceIssue(dataset);
  if (sourceIssue || dataset.remote || dataset.rowCount > 50000) return clarify(sourceIssue ?? "The planner currently needs a complete local study with at most 50,000 rows.");
  if (!Number.isFinite(Date.parse(dataset.importedAt))) return clarify("This study has no valid recorded import event. Choose a current imported study.");
  if (dataset.fields.some(field => !field.id.trim() || !field.sourceColumn.trim()) || new Set(dataset.fields.map(field => field.id)).size !== dataset.fields.length || new Set(dataset.fields.map(field => field.sourceColumn)).size !== dataset.fields.length) return clarify("The study has conflicting field identities. Review its metadata before planning an analysis.");
  const text = question.trim().replace(/[?!.]+$/, "").trim();
  if (!text || question.length > 160) return clarify("Write a question of at most 160 characters, naming the fields to analyze.");
  let kind: "count" | "percent_selected" | "average" | "sum", tail: string;
  const numeric = text.match(/^(?:(?:what is|show(?: me)?) (?:the )?)?(average|mean|sum|total)(?: of)? (.+)$/i);
  const percent = text.match(/^(?:what (?:percentage|percent|share|proportion) of|show(?: me)? (?:the )?(?:percentage|percent|share|proportion)(?: of)?) (.+)$/i);
  const count = text.match(/^(?:how many responses (?:to|for)|count responses (?:to|for)|how many|count(?: of)?|show(?: me)? (?:the )?(?:count|number)(?: of)?) (.+)$/i);
  if (numeric) { kind = /^(average|mean)$/i.test(numeric[1]) ? "average" : "sum"; tail = numeric[2]; }
  else if (percent) { kind = "percent_selected"; tail = percent[1].replace(/^responses (?:to|for) /i, ""); }
  else if (count) { kind = "count"; tail = count[1]; }
  else return clarify("Name a count, percentage, average or total and its fields. Broader business questions need an explicit analysis choice; the planner will not invent one.");

  let audience: SavedImportedAudience | undefined;
  let audiencePart: [string, string] | null;
  try { audiencePart = splitOutsideNames(tail, ["for"]); } catch (error) { return clarify((error as Error).message); }
  if (audiencePart) {
    tail = audiencePart[0];
    const requested = name(audiencePart[1]), all = ["all respondents", "everyone", "all"].includes(requested);
    const matches = audiences.filter(item => name(item.label) === requested);
    if (matches.length > 1 || all && matches.length) return clarify("That audience name is ambiguous. Rename it or select the audience explicitly in the editable plan.");
    if (!all && matches.length !== 1) return clarify(`No unique saved audience is named “${audiencePart[1]}”. Name a saved audience exactly, or use “for all respondents”.`);
    audience = matches[0];
    if (audience && audiences.filter(item => item.id === audience!.id).length !== 1) return clarify("That saved audience has an ambiguous identity. Review the audience library before planning.");
    if (audience) try { compileAudience(audience, dataset); } catch { return clarify("That saved audience does not match the current study import. Review its source before using it."); }
  }
  let by: [string, string] | null;
  try { by = splitOutsideNames(tail, ["by", "across"]); } catch (error) { return clarify((error as Error).message); }
  const isMeasure = kind === "average" || kind === "sum";
  if (isMeasure && !by) return clarify("Name both the numeric measure and grouping, for example “Average Spend by Region”.");
  function resolve(phrase: string, role: string): ImportedDatasetField {
    const raw = phrase.match(/^column (.+)$/i);
    const matches = dataset!.fields.filter(field => raw ? name(field.sourceColumn) === name(raw[1]) : fieldAliases(field).includes(name(phrase)));
    if (!matches.length) throw Error(`No declared field or concept exactly matches “${phrase}” for ${role}. Use its question wording, field code or declared concept, or choose it manually.`);
    if (matches.length > 1) throw Error(`“${phrase}” matches more than one field for ${role}. Use “column [raw name]” to identify its raw column explicitly, or choose it manually.`);
    return matches[0];
  }
  try {
    const primary = resolve(isMeasure ? by![1] : by?.[0] ?? tail, "grouping");
    const measure = isMeasure ? resolve(by![0], "numeric measure") : null;
    const banner = !isMeasure && by ? resolve(by[1], "comparison") : null;
    const support = getImportedDatasetQuerySupport(dataset, primary, { measureField: measure, bannerField: banner, audience, metric: kind, chartType: "table" });
    if (!support.executable) return clarify(support.reason);
    const purpose = isMeasure ? "measure" : banner ? "compare" : "responses";
    return {
      status: "ready", question,
      plan: { datasetId: dataset.id, importedAt: dataset.importedAt, fieldId: primary.id, purpose, measureId: measure?.id ?? "", bannerId: banner?.id ?? "", metric: kind, chartType: "table", audienceId: audience?.id ?? "", fieldBindings: currentJourneyFieldBindings({ fieldId: primary.id, purpose, measureId: measure?.id ?? "", bannerId: banner?.id ?? "" }, dataset) },
      sourceBindings: structuredClone({ study: { id: dataset.id, importedAt: dataset.importedAt, sourceType: dataset.sourceType, sourceRef: dataset.sourceRef, fileName: dataset.fileName, fileType: dataset.fileType, rowCount: dataset.rowCount, fieldCount: dataset.fieldCount }, grouping: primary, measure, comparison: banner }),
      ...(audience ? { audienceDefinition: structuredClone(audience) } : {}),
      summary: [
        { label: "Study", value: dataset.title, reason: "Uses only the selected local study and its recorded import." },
        { label: "Import event", value: dataset.importedAt, reason: "Review the current recorded import; this is not immutable content authentication." },
        { label: "Grouping", value: importedFieldDisplayLabel(primary), reason: `Matched the named ${isMeasure ? "by/across grouping" : "response field"} to declared metadata; no respondent text was searched. Raw column: ${primary.sourceColumn}.` },
        ...(measure ? [{ label: "Numeric measure", value: importedFieldDisplayLabel(measure), reason: `The average/total request names this measure explicitly. Raw column: ${measure.sourceColumn}.` }] : []),
        ...(banner ? [{ label: "Comparison", value: importedFieldDisplayLabel(banner), reason: `The by/across phrase names this comparison field explicitly. Raw column: ${banner.sourceColumn}.` }] : []),
        { label: "Calculation", value: kind === "average" ? "Average" : kind === "sum" ? "Sum" : kind === "count" ? "Response count" : "Response percentage", reason: "Chosen from the question's explicit count, percentage, average or total wording. Unweighted; no statistical or causal test." },
        { label: "Audience", value: audience?.label ?? "All respondents", reason: audience ? "Matched an explicitly named saved audience with current import provenance." : "No saved audience was requested; this visible default includes all respondents. Review it before running." },
        { label: "Output", value: "Table of exact values", reason: "Start with an inspectable table; choose a chart in the editable plan if useful." },
      ],
    };
  } catch (error) { return clarify(error instanceof Error ? error.message : "This question needs an explicit field choice."); }
}

export function confirmLocalQuestionSuggestion(proposal: Extract<LocalQuestionSuggestion, { status: "ready" }>, question: string, dataset: ImportedDatasetRecord | undefined, audiences: SavedImportedAudience[]) {
  const current = suggestLocalQuestion(question, dataset, audiences);
  if (current.status !== "ready" || JSON.stringify(current) !== JSON.stringify(proposal)) throw Error("The question, study metadata or audience changed. Suggest and review a new plan before using it.");
  return structuredClone(current.plan);
}
