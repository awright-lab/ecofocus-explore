import type { AnalyticsQueryResponse,ChartType,Metric } from "../../../shared/types/analytics";
import type { DashboardDraft,DashboardPage,DashboardTile,ImportedDatasetRecord,ImportedDatasetField } from "../../../shared/types/dashboard";
import { defaultAppearance } from "../builder/builderConstants";
import { defaultElementStyle,defaultPageDesign } from "../document/documentSeeds";
import { makePageId,makeTileId,makeElementId } from "../document/documentModel";
import { audienceSourceIssue,compileAudience,previewAudience } from "../audiences/audienceModel";
import { runImportedDatasetQuery } from "../data/importedDatasetAnalytics";
import { buildGuidedStoryPages,captureStoryFinding } from "../narratives/guidedStoryModel";
import { reviewNarrative } from "../narratives/narrativeEvidence";
import { buildPageVisualSvg } from "../export/pageVisualExport";
export interface JourneySetup {
 reportId:string;question:string;headline:string;datasetId:string;importedAt:string;
 fieldId:string;purpose:"responses"|"compare"|"measure";measureId:string;bannerId:string;
 metric:Metric;chartType:ChartType;audienceId:string;
 fieldBindings?: {study:Pick<ImportedDatasetRecord,"id"|"importedAt"|"sourceType"|"sourceRef"|"fileName"|"fileType"|"rowCount"|"fieldCount">;grouping:ImportedDatasetField;measure:ImportedDatasetField|null;comparison:ImportedDatasetField|null};
}
export interface JourneyDraft { setup:JourneySetup;takeaway:string;implication:string;rowId:string;columnId:string }
export interface JourneyPreview { setup:JourneySetup;sourcePage:DashboardPage;result:AnalyticsQueryResponse;population:{included:number;excluded:number;unknown:number;total:number} }
export function currentJourneyFieldBindings(setup:Pick<JourneySetup,"fieldId"|"purpose"|"measureId"|"bannerId">,dataset:ImportedDatasetRecord|undefined):JourneySetup["fieldBindings"] {
 const find=(id:string)=>dataset?.fields.filter(field=>field.id===id)??[];
 const grouping=find(setup.fieldId),measure=setup.purpose==="measure"?find(setup.measureId):[],comparison=setup.purpose==="compare"?find(setup.bannerId):[];
 if(grouping.length!==1||setup.purpose==="measure"&&measure.length!==1||setup.purpose==="compare"&&comparison.length!==1)return undefined;
 return structuredClone({study:{id:dataset!.id,importedAt:dataset!.importedAt,sourceType:dataset!.sourceType,sourceRef:dataset!.sourceRef,fileName:dataset!.fileName,fileType:dataset!.fileType,rowCount:dataset!.rowCount,fieldCount:dataset!.fieldCount},grouping:grouping[0],measure:measure[0]??null,comparison:comparison[0]??null});
}
export function journeyFieldBindingIssue(setup:JourneySetup,dataset:ImportedDatasetRecord|undefined):string|null {
 if(!setup.fieldBindings)return null;
 const current=currentJourneyFieldBindings(setup,dataset);
 if(JSON.stringify(current)===JSON.stringify(setup.fieldBindings))return null;
 const roles=["grouping","measure","comparison"]as const;
 const details=roles.filter(role=>JSON.stringify(current?.[role])!==JSON.stringify(setup.fieldBindings![role])).map(role=>`${role}: recorded raw column ${setup.fieldBindings![role]?.sourceColumn??"None"}; current ${current?.[role]?.sourceColumn??"Unavailable"}`);
 if(JSON.stringify(current?.study)!==JSON.stringify(setup.fieldBindings.study))details.unshift("Recorded study source or coverage changed");
 return `Selected field mappings or metadata changed after planning. Review the current bindings before previewing. ${details.join(". ")}.`;
}
export function journeyConfig(draft:DashboardDraft,studies:ImportedDatasetRecord[],setup:JourneySetup) {
 if(setup.reportId!==draft.id)throw new Error("The report changed. Start this question in the current report.");
 if(!setup.question.trim()||setup.question.length>160||!setup.headline.trim()||setup.headline.length>80)throw new Error("Write a business question up to 160 characters and a deliverable title up to 80 characters.");
 const matches=studies.filter(study=>study.id===setup.datasetId);if(matches.length!==1)throw new Error("Choose one unambiguous imported study.");
 const dataset=matches[0],issue=audienceSourceIssue(dataset);if(issue)throw new Error(issue);
 if(dataset.remote)throw new Error("This workflow requires a complete local study; remote sources are not executed.");
 if(dataset.rowCount>50000)throw new Error("This guided workflow currently supports up to 50,000 local rows.");
 if(!Number.isFinite(Date.parse(setup.importedAt))||dataset.importedAt!==setup.importedAt)throw new Error("The selected study was replaced. Choose it again and review a new preview; your wording is preserved.");
 const bindingIssue=journeyFieldBindingIssue(setup,dataset);if(bindingIssue)throw new Error(bindingIssue);
 function field(id:string,role:string){const matches=dataset.fields.filter(field=>field.id===id);if(matches.length!==1)throw new Error(`Choose an available ${role} field.`);return matches[0];}
 const grouping=field(setup.fieldId,"grouping"),measure=setup.purpose==="measure"?field(setup.measureId,"numeric"):null,banner=setup.purpose==="compare"?field(setup.bannerId,"comparison"):null;
 if(!["responses","compare","measure"].includes(setup.purpose)||!(setup.purpose==="measure"?["average","sum"]:["count","percent_selected"]).includes(setup.metric))throw new Error("Choose a metric that matches the stated research purpose.");
 if(setup.purpose!=="measure"&&setup.measureId||setup.purpose!=="compare"&&setup.bannerId)throw new Error("The plan contains an inactive numeric or comparison field. Review its settings again.");
 const audienceMatches=(draft.savedAudiences??[]).filter(audience=>audience.id===setup.audienceId),audience=setup.audienceId?audienceMatches[0]:undefined;
 if(setup.audienceId&&audienceMatches.length!==1)throw new Error("The chosen audience is missing or ambiguous. Select an audience explicitly.");
 if(audience)compileAudience(audience,dataset);
 const config={dataset,field:grouping,measureField:measure,bannerField:banner,audience,metric:setup.metric,chartType:setup.chartType};
 return {config,population:audience?previewAudience(audience,dataset):{included:dataset.rows.length,excluded:0,unknown:0,total:dataset.rows.length}};
}
export function prepareJourney(draft:DashboardDraft,studies:ImportedDatasetRecord[],setup:JourneySetup,ids?:{pageId:string;tileId:string;questionId:string;scopeId:string}):JourneyPreview {
 const {config,population}=journeyConfig(draft,studies,setup),result=runImportedDatasetQuery(config);
 const sourceIds=ids??{pageId:makePageId(),tileId:makeTileId(),questionId:makeElementId(),scopeId:makeElementId()};
 const tile:DashboardTile={locked:false,hidden:false,id:sourceIds.tileId,name:setup.headline.trim(),title:`${result.metric.label} by ${config.field.label}`,source:{kind:"importedField",id:`${config.dataset.id}:${config.field.id}`,label:config.field.label,datasetId:config.dataset.id,fieldId:config.field.id},query:result.query,result,visualization:setup.chartType,layout:{x:64,y:248,width:1152,height:464,zIndex:1},appearance:{...structuredClone(defaultAppearance),titleX:24,titleY:18,titleWidth:1050,titleFontSize:18,showBases:true,showNotes:false}};
 const sourcePage:DashboardPage={...defaultPageDesign(),id:sourceIds.pageId,title:`Evidence: ${setup.headline.trim()}`,order:Math.max(-1,...draft.pages.map(page=>page.order))+1,showCanvasGrid:false,provenance:{status:"custom",masterStatus:"none"},tiles:[tile],elements:[{id:sourceIds.questionId,name:"Business question",type:"text",hidden:false,locked:false,content:setup.question.trim(),layout:{x:64,y:32,width:1152,height:72,zIndex:2},style:{...defaultElementStyle("text"),fontSize:24,padding:0,lineHeight:1.2,textColor:"#245a46",fontWeight:"700"}},{id:sourceIds.scopeId,name:"Analysis scope",type:"text",hidden:false,locked:false,content:`Study: ${config.dataset.title}. Audience: ${config.audience?.label??"All respondents"}. Includes ${population.included} of ${population.total} rows; ${population.unknown} have unknown audience membership. Unweighted; valid-response cell bases may differ.`,layout:{x:64,y:114,width:1152,height:112,zIndex:2},style:{...defaultElementStyle("text"),fontSize:11,padding:0,lineHeight:1.3,textColor:"#41594e"}}]};
 return {setup:structuredClone(setup),sourcePage,result,population};
}
export function buildJourneyPages(draft:DashboardDraft,studies:ImportedDatasetRecord[],preview:JourneyPreview,wording:Pick<JourneyDraft,"takeaway"|"implication"|"rowId"|"columnId">) {
 const source=preview.sourcePage,oldTile=source.tiles[0];if(!oldTile||source.elements.length!==2)throw new Error("The preview is incomplete. Preview this question again.");
 const ids=[source.id,oldTile.id,...source.elements.map(element=>element.id)],existing=new Set(draft.pages.flatMap(page=>[page.id,...page.tiles.map(tile=>tile.id),...page.elements.map(element=>element.id)]));
 if(ids.some(id=>typeof id!=="string"||!id.trim()||existing.has(id))||new Set(ids).size!==ids.length)throw new Error("This preview conflicts with existing report objects. Preview it again; no pages were added.");
 const fresh=prepareJourney(draft,studies,preview.setup,{pageId:source.id,tileId:oldTile.id,questionId:source.elements[0].id,scopeId:source.elements[1].id});
 if(JSON.stringify(fresh.result)!==JSON.stringify(preview.result)||JSON.stringify(oldTile.result)!==JSON.stringify(preview.result))throw new Error("The study, audience or calculated results changed after preview. Preview again before reviewing the deliverable.");
 const combined={...draft,pages:[...draft.pages,fresh.sourcePage]},evidence=captureStoryFinding(combined.pages,{tileId:oldTile.id,rowId:wording.rowId,columnId:wording.columnId});
 fresh.sourcePage.elements[1].evidence=reviewNarrative(fresh.sourcePage.elements[1],combined.pages,[evidence]);
 const story=buildGuidedStoryPages(combined,{reportId:draft.id,title:preview.setup.headline.trim(),findings:[{evidence,takeaway:wording.takeaway,implication:wording.implication}]});
 buildPageVisualSvg(fresh.sourcePage);
 return [fresh.sourcePage,...story];
}
