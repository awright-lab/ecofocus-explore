import type { DashboardDraft, DashboardTile, ImportedDatasetRecord } from "../../../shared/types/dashboard";
import type { ComparisonReviewPlan } from "../../../shared/types/reportInsights";
import { analysisSettingsMatch } from "../../../shared/analytics/queryFreshness";
import { comparisonStudyIssue } from "./comparisonReviewModel";
import { recoveryImportSignature } from "../document/recoveredImportModel";
import { normalizeDatasetSourceRefForImportedDataset } from "../data/datasetSourceRegistry";
import { assertSavedImportedTileSource } from "../data/savedImportedQuery";
import type { DatasetSourceRef } from "../../../shared/types/dataSource";
export interface SuggestionContext { draft: DashboardDraft; studies: ImportedDatasetRecord[] }
export type ComparisonSourceSuggestion = { available: false; issue: string } | { available: true; originKey: string; sourceTitle: string; outcome: { label: string; column: string }; group?: { label: string; column: string }; plan: ComparisonReviewPlan };
const receipts = new WeakMap<object, { origin: string; context: string; plan: string }>();
export function emptyComparisonReviewPlan(reportId: string): ComparisonReviewPlan { return { reportId, datasetId: "", importedAt: "", idFieldId: "", idBinding: "", groupFieldId: "", groupBinding: "", outcomeFieldId: "", outcomeBinding: "", audienceId: "", reference: "", targets: [], eventCodes: [], excludedCodes: [], alpha: 0.05, design: "unknown", question: "", methodology: "" }; }
export function comparisonPlanHasWork(p: ComparisonReviewPlan) { return Boolean(p.datasetId || p.importedAt || p.idFieldId || p.idBinding || p.groupFieldId || p.groupBinding || p.outcomeFieldId || p.outcomeBinding || p.audienceId || p.reference || p.targets.length || p.eventCodes.length || p.excludedCodes.length || p.alpha !== 0.05 || p.design !== "unknown" || p.question || p.methodology); }
function own(value: object, key: string): unknown { const d = Object.getOwnPropertyDescriptor(value, key); if (!d || !Object.hasOwn(d, "value") || !d.enumerable) throw Error("Source-field suggestions require readable ordinary workspace data."); return d.value; }
function metadata(study: ImportedDatasetRecord) {
 if (![Object.prototype, null].includes(Object.getPrototypeOf(study)) || Object.getOwnPropertySymbols(study).length) throw Error("Source metadata is unsupported for a field suggestion.");
 const entries = Object.getOwnPropertyNames(study).map(key => [key, own(study, key)] as const);
 const text = recoveryImportSignature(Object.fromEntries(entries.filter(([key]) => key !== "rows" && key !== "previewRows")));
 const fixed = { ...JSON.parse(text), rows: own(study, "rows"), previewRows: own(study, "previewRows") } as ImportedDatasetRecord;
 if (Object.hasOwn(fixed, "rowStorage")) throw Error("Use a decoded original study before suggesting source fields.");
 const issue = comparisonStudyIssue(fixed); if (issue) throw Error(issue);
 return { fixed, text };
}
function routing(ref: DatasetSourceRef) { return recoveryImportSignature(Object.keys(ref).filter(key => key !== "label" && ref[key as keyof DatasetSourceRef] !== undefined).sort().map(key => [key, ref[key as keyof DatasetSourceRef]])); }
function prepare(context: SuggestionContext, originKey: string) {
 if (originKey.length > 2048) throw Error("Choose an existing report analysis.");
 const ids: unknown = JSON.parse(originKey); if (!Array.isArray(ids) || ids.length !== 2 || ids.some(id => typeof id !== "string" || !id || id.length > 512)) throw Error("Choose an existing report analysis.");
 const pages = context.draft.pages.filter(p => own(p, "id") === ids[0]); if (pages.length !== 1) throw Error("The source page is missing or ambiguous.");
 const matches = pages[0].tiles.filter(t => own(t, "id") === ids[1]); if (matches.length !== 1) throw Error("The source analysis is missing or ambiguous.");
 const tileText = recoveryImportSignature(matches[0]), tile = JSON.parse(tileText) as DashboardTile, query = tile.result.query, source = query.sourceIdentity;
 if (tile.source?.kind !== "importedField") throw Error("Choose an imported-field analysis with recorded source roles.");
 if (tile.hidden || tile.derivedOutput || !["count", "percent_selected"].includes(query.metric) || query.authoredVariableSet || tile.result.metadataRefs.authoredVariableSet?.applied || query.weight || tile.result.weighting.applied || query.comparisonMode === "wave") throw Error("Suggest fields from an ordinary, unweighted local response analysis. Derived, weighted, authored and wave outputs are not substituted.");
 if (tile.result.table.length * tile.result.columns.length > 5000) throw Error("Field suggestions support recorded analyses of at most 5,000 cells. Manual comparison fields remain available.");
 if (source?.kind !== "imported" || source.queryKind === "measure" || source.groupingScope || source.measureFieldId || !source.datasetImportedAt || !Number.isFinite(Date.parse(source.datasetImportedAt))) throw Error("Refresh an ordinary imported response analysis with a recorded import event before using its field roles.");
 if (source.audience || source.intersectionAudience || source.filterFieldId || source.filterValue !== undefined || query.filters.length || query.breakBy !== "SUMMARY" || query.comparisonDatasets?.length) throw Error("Filtered or audience-scoped analyses need an explicit comparison plan. Their population is not silently changed to the full study.");
 if (!analysisSettingsMatch(tile.query, query) || tile.result.metadataRefs.source?.kind !== "imported" || !analysisSettingsMatch({ ...query, sourceIdentity: tile.result.metadataRefs.source }, query)) throw Error("The displayed analysis has pending or conflicting settings. Refresh it before suggesting fields.");
 const studies = context.studies.filter(s => own(s, "id") === source.datasetId); if (studies.length !== 1) throw Error("The source study is missing or ambiguous.");
 const { fixed: study, text: studyText } = metadata(studies[0]); if (source.datasetImportedAt !== study.importedAt) throw Error("The study import changed. Refresh the source analysis; no field identity was rebound.");
 const expected = normalizeDatasetSourceRefForImportedDataset(study), references = [tile.source?.sourceRef, tile.query.sourceRef, tile.query.sourceIdentity?.sourceRef, query.sourceRef, source.sourceRef, tile.result.metadataRefs.source.sourceRef];
 for (const ref of references) if (ref !== undefined && (!ref || ref.kind !== "imported_file" || ref.provider !== "local_file" || ref.datasetId !== study.id || routing(ref) !== routing(expected))) throw Error("The analysis has conflicting source references. A live or managed source is not replayed as local data.");
 assertSavedImportedTileSource(query, tile.source);
 const field = study.fields.find(f => f.id === source.primaryFieldId), group = source.bannerFieldId ? study.fields.find(f => f.id === source.bannerFieldId) : undefined;
 if (!field || source.bannerFieldId && !group) throw Error("A recorded source field is unavailable. Review the current study before suggesting roles.");
 if (![field, ...(group ? [group] : [])].every(f => ["text", "categorical"].includes(f.type) || f.modelingRole === "candidate_dimension") || field.id === group?.id) throw Error("Choose separate single-choice outcome and group categories; numeric means are not event rates.");
 if (study.title.length > 512 || [field, ...(group ? [group] : [])].some(f => f.id.length > 256 || f.sourceColumn.length > 256 || f.label.length > 512 || (f.variableLabel?.length ?? 0) > 512)) throw Error("Source identity text is too large for a safe field suggestion. Inspect the current source manually.");
 const plan = { ...emptyComparisonReviewPlan(context.draft.id), datasetId: study.id, importedAt: study.importedAt, outcomeFieldId: field.id, outcomeBinding: recoveryImportSignature(field), groupFieldId: group?.id ?? "", groupBinding: group ? recoveryImportSignature(group) : "" };
 const view: Extract<ComparisonSourceSuggestion, { available: true }> = { available: true, originKey, sourceTitle: study.title, outcome: { label: field.variableLabel || field.label, column: field.sourceColumn }, group: group ? { label: group.variableLabel || group.label, column: group.sourceColumn } : undefined, plan };
 return { view, binding: recoveryImportSignature({ reportId: context.draft.id, originKey, tileText, studyText }) };
}
export function suggestComparisonSourceFields(context: SuggestionContext, originKey: string): ComparisonSourceSuggestion {
 try { const { view, binding } = prepare(context, originKey); receipts.set(view, { origin: originKey, context: binding, plan: recoveryImportSignature(view.plan) }); return view; }
 catch (error) { return { available: false, issue: error instanceof Error ? error.message : "Source fields could not be suggested safely. Manual field selection remains available." }; }
}
export function acceptComparisonSourceFields(suggestion: ComparisonSourceSuggestion, context: SuggestionContext): ComparisonReviewPlan {
 const receipt = receipts.get(suggestion); if (!suggestion.available || !receipt) throw Error("Review an original field suggestion before using it.");
 const current = prepare(context, receipt.origin);
 if (current.binding !== receipt.context || recoveryImportSignature(suggestion.plan) !== receipt.plan || recoveryImportSignature(current.view.plan) !== receipt.plan) throw Error("The source fields or analysis changed while this suggestion was open. Review the current suggestion again; the working plan was kept.");
 return JSON.parse(receipt.plan) as ComparisonReviewPlan;
}
