import type { DashboardCanvasElement, DashboardDraft, DashboardPage } from "../../../shared/types/dashboard";
import type { NarrativeEvidenceLink } from "../../../shared/types/narrative";
import { defaultElementStyle, defaultPageDesign } from "../document/documentSeeds";
import { makeElementId, makePageId } from "../document/documentModel";
import { buildPageVisualSvg } from "../export/pageVisualExport";
import { captureNarrativeCell, reviewNarrative } from "./narrativeEvidence";
import { analysisSettingsMatch } from "../../../shared/analytics/queryFreshness";

export interface StoryFinding { evidence: NarrativeEvidenceLink; takeaway: string; implication: string }
export interface GuidedStoryPlan { reportId: string; title: string; findings: StoryFinding[] }
export function captureStoryFinding(pages:DashboardPage[], reference:Pick<NarrativeEvidenceLink,"tileId"|"rowId"|"columnId">) {
  const captured=captureNarrativeCell(pages,reference),tile=pages.flatMap(page=>page.tiles).find(tile=>tile.id===reference.tileId)!,result=tile.result;
  const format=["count","average","sum"].includes(result.metric.id)?"number":"percent";
  if(!["count","average","sum","column_percent","percent_selected"].includes(result.metric.id)||result.query.metric!==result.metric.id||result.metric.valueFormat!==format||result.weighting.applied!==(result.query.weight!==null)||result.weighting.id!==result.query.weight)throw new Error("Refresh this source: its recorded metric or weighting context is inconsistent.");
  if(result.query.sourceIdentity&&(!result.metadataRefs.source||!analysisSettingsMatch({...result.query,sourceIdentity:result.metadataRefs.source},result.query)))throw new Error("Refresh this source: its recorded study context is inconsistent.");
  return captured;
}

export function storyFindingCurrent(finding: StoryFinding, pages: DashboardPage[]) {
  try { return JSON.stringify(captureStoryFinding(pages, finding.evidence).snapshot) === JSON.stringify(finding.evidence.snapshot); }
  catch { return false; }
}
export function storyMethodology(link: NarrativeEvidenceLink) {
  const context=JSON.parse(link.snapshot.context),query=context.query,source=query.sourceIdentity,weighted=context.weighting.applied||query.weight;
  const details=[`Recorded metric: ${context.metric.label}.`, `${weighted?"Recorded weighted total":"Recorded sample base"}: ${link.snapshot.base}.`, `Weight: ${context.weighting.label}.`];
  if(source?.kind==="imported") details.push(`Study: ${source.datasetLabel??source.datasetId}.`, `Grouping: ${source.primaryFieldLabel}.`, ...(source.measureFieldLabel?[`Number: ${source.measureFieldLabel}.`]:[]), `Breakout: ${source.bannerFieldLabel??"None"}.`, `Filter: ${source.filterFieldLabel?`${source.filterFieldLabel} is ${source.filterValue}`:"None"}.`, `Audience: ${source.audience?.label??"All respondents"}.`, `Import event: ${source.datasetImportedAt??"Not recorded"}. No immutable content version is recorded.`);
  else details.push(`Recorded dataset: ${query.dataset}.`, `Breakout: ${query.breakBy}.`, `Filters: ${query.filters.map((filter:{field:string;values:string[]})=>`${filter.field}: ${filter.values.join(" or ")}`).join("; ")||"None"}.`, `Comparison datasets: ${query.comparisonDatasets?.join(", ")||"None"}.`, source?.sourceRef?.kind==="seeded_demo"?"Illustrative sample.":source?"This builder has not verified the recorded live connection.":"Source identity is unconfirmed; cached output may be illustrative. Verify it before sharing.");
  details.push("This records source context; it does not authenticate the data or establish causality.");
  return details.join(" ");
}
function text(name:string,content:string,y:number,height:number,size:number,color="#17211b"):DashboardCanvasElement {
  return {id:makeElementId(),name,type:"text",hidden:false,locked:false,content,layout:{x:64,y,width:1152,height,zIndex:2},style:{...defaultElementStyle("text"),fontSize:size,fontWeight:"400",textColor:color,padding:0,lineHeight:1.3}};
}
export function buildGuidedStoryPages(draft: DashboardDraft, plan: GuidedStoryPlan):DashboardPage[] {
  if(plan.reportId!==draft.id)throw new Error("The report changed. Close the story builder and choose its findings again.");
  if(!plan.title.trim()||plan.title.length>80||!plan.findings.length||plan.findings.length>6)throw new Error("Give the story a title of up to 80 characters and select one to six findings.");
  const keys=new Set<string>(),order=Math.max(-1,...draft.pages.map(page=>page.order))+1;
  const pages=plan.findings.map((finding,index)=>{
    const key=JSON.stringify([finding.evidence.tileId,finding.evidence.rowId,finding.evidence.columnId]);
    if(keys.has(key))throw new Error("The story contains the same finding twice.");keys.add(key);
    if(!storyFindingCurrent(finding,draft.pages))throw new Error("A selected result or its context changed. Remove it and select the current finding before creating the story.");
    if(!finding.takeaway.trim()||finding.takeaway.length>240||!finding.implication.trim()||finding.implication.length>240)throw new Error("Write a takeaway and an implication for each finding, up to 240 characters each.");
    const title=text("Story title",`${plan.title.trim()}${plan.findings.length>1?` · ${index+1} / ${plan.findings.length}`:""}`,44,88,30,"#245a46");title.style.fontWeight="700";
    const claim=text("Evidence-linked takeaway",finding.takeaway.trim(),174,230,22);claim.evidence=reviewNarrative(claim,draft.pages,[finding.evidence]);
    const implication=text("Authored implication",`Implication — your interpretation\n${finding.implication.trim()}`,420,148,18);implication.evidence=reviewNarrative(implication,draft.pages,[finding.evidence]);
    const method=text("Recorded methodology",storyMethodology(finding.evidence),590,158,11,"#41594e");method.evidence=reviewNarrative(method,draft.pages,[finding.evidence]);
    const page:DashboardPage={...defaultPageDesign(),id:makePageId(),title:`${plan.title.trim()} — ${index+1}`,order:order+index,showCanvasGrid:false,provenance:{status:"custom",masterStatus:"none"},tiles:[],elements:[title,text("Finding section label","FINDING AND RECORDED EVIDENCE",140,24,12,"#39784d"),claim,implication,method]};
    // The same text reconstruction used by PDF must fit before any page is added.
    // Oversize source citations/methodology fail visibly rather than truncating.
    buildPageVisualSvg(page);
    return page;
  });
  const ids=new Set(draft.pages.flatMap(page=>[page.id,...page.elements.map(element=>element.id),...page.tiles.map(tile=>tile.id)]));
  for(const page of pages)for(const id of [page.id,...page.elements.map(element=>element.id)]){if(ids.has(id))throw new Error("A new story object identifier collided. Try again; no pages were added.");ids.add(id);}
  return pages;
}
