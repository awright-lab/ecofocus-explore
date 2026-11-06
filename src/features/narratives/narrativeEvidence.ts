import type { NarrativeEvidence, NarrativeEvidenceLink } from "../../../shared/types/narrative";
import type { DashboardCanvasElement, DashboardPage } from "../../../shared/types/dashboard";
import { resultIdentityIssue } from "../../../shared/analytics/resultIdentities";
import { analysisSettingsMatch } from "../../../shared/analytics/queryFreshness";
import { analyticalCell } from "../../../shared/analytics/resultCells";
import { recordedCalculation } from "../../../shared/analytics/recordedCalculation";
import { withSafeInference } from "../../../shared/analytics/inferenceSafety";
import { audienceDefinitionIssue } from "../audiences/audienceModel";

type CellReference = Pick<NarrativeEvidenceLink,"tileId"|"rowId"|"columnId">;
function object(value: unknown): value is Record<string,unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function displayRecordedValue(value:number,format:unknown) { return `${value}${format==="percent"?"%":""}`; }
function contextStudyIds(context:Record<string,unknown>,strict=false):string[] {
  const query=object(context.query)?context.query:{},metadata=object(context.metadataRefs)?context.metadataRefs:{};
  const sources=[metadata.source,query.sourceIdentity].filter(object),ids:string[]=[];
  function add(value:unknown){if(typeof value==="string"&&value.trim())ids.push(value);else if(strict)throw new Error("The recorded study identity is invalid.");}
  for(const source of sources)if(source.kind==="imported")add(source.datasetId);
  for(const ref of [query.sourceRef,...sources.map(source=>source.sourceRef)])if(object(ref)&&["imported_file","workspace_database"].includes(String(ref.kind)))add(ref.datasetId);
  return [...new Set(ids)].sort();
}
export function narrativeStudyIds(evidence:unknown):string[] {
  if(!object(evidence)||!Array.isArray(evidence.links))return [];
  const ids:string[]=[];
  for(const link of evidence.links)if(object(link)&&object(link.snapshot)){
    const snapshot=link.snapshot;if(Array.isArray(snapshot.studyIds))ids.push(...snapshot.studyIds.filter((id):id is string=>typeof id==="string"&&!!id.trim()));
    if(typeof snapshot.context==="string")try{const context=JSON.parse(snapshot.context);if(object(context))ids.push(...contextStudyIds(context));}catch{/* Preserve every readable explicit reference even when other metadata is damaged. */}
  }
  return [...new Set(ids)];
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (object(value)) return `{${Object.entries(value).filter(([,value])=>value!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>`${JSON.stringify(key)}:${canonical(value)}`).join(",")}}`;
  return JSON.stringify(value);
}
export function narrativeEvidenceIssue(value: unknown): string | null {
  if (!object(value) || value.version !== 1 || typeof value.reviewedContent !== "string" || typeof value.reviewedAt !== "string" || !Number.isFinite(Date.parse(value.reviewedAt)) || !Array.isArray(value.links) || !value.links.length || value.links.length > 12) return "The recorded evidence links are damaged or unsupported. The original text and data have been kept.";
  const keys = new Set<string>();
  for (const link of value.links) {
    if (!object(link) || ![link.tileId,link.rowId,link.columnId].every(id=>typeof id==="string"&&id.length>0) || !object(link.snapshot)) return "An evidence link is incomplete. Review its source without changing the original text.";
    const snapshot = link.snapshot;
    if (![snapshot.pageTitle,snapshot.tileTitle,snapshot.rowLabel,snapshot.columnLabel,snapshot.displayValue,snapshot.context].every(text=>typeof text==="string") || typeof snapshot.value!=="number" || !Number.isFinite(snapshot.value) || typeof snapshot.base!=="number" || !Number.isFinite(snapshot.base) || snapshot.base<0 || !Array.isArray(snapshot.studyIds) || !snapshot.studyIds.every(id=>typeof id==="string"&&id.length>0) || (snapshot.context as string).length>131072) return "The recorded evidence snapshot is invalid. The original text and data have been kept.";
    try {
      const context=JSON.parse(snapshot.context as string);
      if(!object(context)||!object(context.query)||!object(context.metadataRefs)||!object(context.metric)||!["percent","number"].includes(String(context.metric.valueFormat)))return "The recorded analysis context has an invalid metric format or source settings.";
      if(snapshot.displayValue!==displayRecordedValue(snapshot.value,context.metric.valueFormat))return "The recorded evidence display value is inconsistent with its numeric value and metric format. Review the original source; the text and data were kept.";
      if(canonical([...snapshot.studyIds].sort())!==canonical(contextStudyIds(context,true)))return "The recorded evidence study references are inconsistent with its analysis context. The original text and data were kept.";
    } catch { return "The recorded analysis context is invalid."; }
    const key = canonical([link.tileId,link.rowId,link.columnId]);
    if (keys.has(key)) return "Evidence links contain duplicate source cells. Review the links.";
    keys.add(key);
  }
  return null;
}
export function assertNarrativeEvidence(pages: DashboardPage[]) {
  for (const page of pages) for (const element of page.elements) if (element.evidence !== undefined) {
    const issue = element.type!=="text" ? "Only text objects can retain evidence links." : narrativeEvidenceIssue(element.evidence);
    if (issue) throw new Error(issue);
  }
}
export function assertNarrativeLibraryEvidence(library: unknown) {
  if(!object(library))return;
  for(const key of ["compositionBlocks","compositionStarters"]){
    const blocks=library[key];if(!Array.isArray(blocks))continue;
    for(const block of blocks)if(object(block)&&Array.isArray(block.items))for(const item of block.items){
      if(!object(item)||item.kind!=="element"||!object(item.element)||item.element.evidence===undefined)continue;
      const issue=item.element.type!=="text"?"Only text objects can retain evidence links.":narrativeEvidenceIssue(item.element.evidence);
      if(issue)throw new Error(issue);
    }
  }
}
export function captureNarrativeCell(pages: DashboardPage[], reference: CellReference): NarrativeEvidenceLink {
  const matches = pages.flatMap(page=>page.tiles.filter(tile=>tile.id===reference.tileId).map(tile=>({page,tile})));
  if (matches.length!==1) throw new Error("The source analysis is missing or ambiguous. Restore it or choose a specific source again.");
  const {page,tile} = matches[0], result = withSafeInference(tile.result);
  const identityIssue = resultIdentityIssue(result);
  if (identityIssue) throw new Error(identityIssue);
  if (!analysisSettingsMatch(tile.query,result.query)) throw new Error("Refresh the source analysis before reviewing its evidence; edited settings have not been applied.");
  const audience = result.query.sourceIdentity?.kind==="imported"?result.query.sourceIdentity.audience:undefined;
  const metadataAudience = result.metadataRefs.source?.kind==="imported"?result.metadataRefs.source.audience:undefined;
  if (audience!==undefined&&audienceDefinitionIssue(audience) || metadataAudience!==undefined&&audienceDefinitionIssue(metadataAudience) || canonical(audience)!==canonical(metadataAudience)) throw new Error("The source audience context is invalid or inconsistent. Refresh the analysis first.");
  const row = result.table.find(row=>row.optionId===reference.rowId), column = result.columns.find(column=>column.id===reference.columnId);
  if (!row||!column) throw new Error("The linked result row or column is no longer present. Choose a specific cell again.");
  const cell = analyticalCell(result,row,column.id), base = row.bases[column.id];
  if (cell.status!=="available" || !Object.hasOwn(row.values,column.id) || !Object.hasOwn(row.bases,column.id) || !Number.isFinite(base) || base<0 || !result.weighting.applied&&!result.query.weight&&!Number.isSafeInteger(base)) throw new Error("This source cell is unavailable or has an invalid base. Refresh it before linking or reviewing a claim.");
  const {chartType:_chartType,...query} = result.query;
  const context = canonical({query,metadataRefs:result.metadataRefs,metric:result.metric,weighting:result.weighting,statistics:result.statistics,warnings:result.warnings,notes:result.notes,
    rowSourceKey:row.sourceCategoryKey,columnSourceKey:column.sourceCategoryKey,calculation:recordedCalculation(result,row,column.id)});
  if (context.length>131072) throw new Error("This result's recorded context is too large for an evidence link. Keep its full backup and use a smaller analysis.");
  const studyIds = contextStudyIds(JSON.parse(context),true);
  return {...reference,snapshot:{pageTitle:page.title,tileTitle:tile.title||tile.name,rowLabel:row.label,columnLabel:column.label,value:cell.value,base,
    displayValue:displayRecordedValue(cell.value,result.metric.valueFormat),studyIds,context}};
}
export function reviewNarrative(element: DashboardCanvasElement, pages: DashboardPage[], references: CellReference[]): NarrativeEvidence {
  if (element.type!=="text" || !element.content.trim()) throw new Error("Write the claim in a text object before linking evidence.");
  const evidence: NarrativeEvidence = {version:1,reviewedContent:element.content,reviewedAt:new Date().toISOString(),links:references.map(reference=>captureNarrativeCell(pages,reference))};
  const issue = narrativeEvidenceIssue(evidence);
  if (issue) throw new Error(issue);
  return evidence;
}
export function narrativeState(element: DashboardCanvasElement, pages: DashboardPage[]): {current:boolean; reasons:string[]} | null {
  if (element.evidence===undefined) return null;
  if (element.type!=="text") return {current:false,reasons:["Only text objects can retain evidence links."]};
  const issue = narrativeEvidenceIssue(element.evidence);
  if (issue) return {current:false,reasons:[issue]};
  const reasons = element.content!==element.evidence.reviewedContent?["The written claim changed since its evidence was reviewed."]:[];
  for (const link of element.evidence.links) {
    try {
      const current = captureNarrativeCell(pages,link).snapshot, previous = link.snapshot;
      if (current.value!==previous.value || current.base!==previous.base || current.displayValue!==previous.displayValue || canonical([...current.studyIds].sort())!==canonical([...previous.studyIds].sort()) || current.rowLabel!==previous.rowLabel || current.columnLabel!==previous.columnLabel || current.context!==previous.context) reasons.push(`The recorded result or context changed: ${previous.tileTitle} / ${previous.rowLabel} / ${previous.columnLabel}.`);
    } catch (error) { reasons.push(error instanceof Error?error.message:"The source evidence could not be checked."); }
  }
  return {current:reasons.length===0,reasons:[...new Set(reasons)]};
}
export function narrativeCitation(element: DashboardCanvasElement): string {
  if (element.evidence===undefined) return "";
  if (narrativeEvidenceIssue(element.evidence)) return "Evidence needs review: invalid recorded links.";
  return element.evidence.links.map(link=>{const s=link.snapshot,display=displayRecordedValue(s.value,JSON.parse(s.context).metric.valueFormat);return `Recorded evidence: ${s.pageTitle} / ${s.tileTitle} — ${s.rowLabel} / ${s.columnLabel} = ${display} (recorded base ${s.base}).`;}).join("\n");
}
export function narrativeDisplayText(element: DashboardCanvasElement) {
  const citation=narrativeCitation(element);
  return citation?`${element.content}\n${citation}`:element.content;
}
