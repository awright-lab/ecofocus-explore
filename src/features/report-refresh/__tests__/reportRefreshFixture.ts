import {importDatasetBuffer} from '../../data/datasetImportModel';
import {runImportedDatasetQuery} from '../../data/importedDatasetAnalytics';
import {normalizeImportedDataset,normalizeDashboard} from '../../document/documentModel';
import {initialDashboard} from '../../document/documentSeeds';
import {createCanvasElement} from '../../builder/builderDocumentCommands';
import {reviewNarrative} from '../../narratives/narrativeEvidence';
import type {Metric} from '../../../../shared/types/analytics';
import type {ReportRefreshContext} from '../reportRefreshModel';
export async function fixture(metric:Metric='count'):Promise<ReportRefreshContext>{
 const parse=async(text:string,id:string)=>{const {dataset}=await importDatasetBuffer(new TextEncoder().encode(text).buffer,`${id}.csv`);if(!dataset)throw Error('fixture');dataset.id=id;dataset.importedAt=id==='old'?'2026-10-01T12:00:00.000Z':'2026-11-01T12:00:00.000Z';dataset.title=id==='old'?'October study':'November study';dataset.sourceRef=undefined;return dataset;};
 const old=await parse('Region,Amount,Banner\nNorth,10,A\nNorth,20,A\nNorth,30,B\nSouth,40,B','old'),next=await parse('Region,Amount,Banner\nNorth,20,A\nSouth,40,A\nSouth,60,B\nSouth,80,B\nEast,100,B','new');
 for(const study of[old,next])for(const field of study.fields){field.type=field.sourceColumn==='Amount'?'numeric':'categorical';field.modelingRole=field.sourceColumn==='Amount'?'candidate_measure':'candidate_dimension';}
 // Different generated IDs are legitimate when physical column order changes between imports.
 next.fields.forEach((field,index)=>field.id=`new-field-${index}`);
 Object.assign(old,normalizeImportedDataset(old,0));Object.assign(next,normalizeImportedDataset(next,1));
 const result=runImportedDatasetQuery({dataset:old,field:old.fields[0],measureField:metric==='average'||metric==='sum'?old.fields[1]:null,metric,chartType:'table'});
 const draft=structuredClone(initialDashboard);draft.id='old-report';draft.title='October findings';draft.importedDatasets=[];draft.pages=draft.pages.slice(0,1);draft.pages[0].tiles=[{...draft.pages[0].tiles[0],id:'source',query:structuredClone(result.query),result,visualization:'table',source:{kind:'importedField',id:'original-source',label:'Region',datasetId:'old',fieldId:old.fields[0].id}}];draft.pages[0].tiles[0].appearance.barStyles={};draft.pages[0].tiles[0].appearance.axisLabelOverrides={};delete draft.pages[0].tiles[0].appearance.reportColorSlots;delete draft.pages[0].tiles[0].appearance.dotPlotIntervals;draft.pages[0].elements=[];
 const element=createCanvasElement('text',draft.pages[0]);element.content='North is the largest group in October.';draft.pages[0].elements=[element];const row=result.table.find(row=>row.label==='North')!;element.evidence=reviewNarrative(element,draft.pages,[{tileId:'source',rowId:row.optionId,columnId:result.columns[0].id}]);
 return{draft:normalizeDashboard(draft),studies:[old,next]};
}

export async function embeddedFixture(){const ctx=await fixture(),extra=structuredClone(ctx.studies[0]);extra.id='embedded-third';extra.title='Retained additional study';extra.importedAt='2026-09-01T12:00:00.000Z';extra.sourceRef=undefined;ctx.draft.importedDatasets=[normalizeImportedDataset(extra,0)];return ctx;}
