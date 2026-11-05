// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { importDatasetBuffer } from '../../../data/datasetImportModel';
import { importedFieldValues, runImportedDatasetQuery } from '../../../data/importedDatasetAnalytics';
import { GuidedDataQueryModal } from '../GuidedDataQueryModal';
import type { AnalysisAuthoringPanelProps } from '../AnalysisAuthoringPanel';
import type { ImportedDatasetRecord } from '../../../../../shared/types/dashboard';
import { defaultDataset, defaultQuestion } from '../../builderConstants';

async function csv(text:string,name='synthetic.csv') {
 const parsed=await importDatasetBuffer(new TextEncoder().encode(text).buffer,name);expect(parsed.error).toBeUndefined();return parsed.dataset!;
}
let host:HTMLDivElement, root:Root;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('Synthetic only: live services prohibited')));host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});
function select(label:string) {const node=Array.from(host.querySelectorAll('label')).find(node=>node.textContent!.trim().startsWith(label))?.querySelector('select');expect(node,label).toBeTruthy();return node!;}
function button(text:string){const node=Array.from(host.querySelectorAll('button')).find(node=>node.textContent!.trim()===text||node.querySelector('strong')?.textContent===text);expect(node,text).toBeTruthy();return node!;}
async function change(label:string,value:string){const node=select(label);await act(async()=>{node.value=value;node.dispatchEvent(new Event('change',{bubbles:true}));});}
function minimumProps(datasets:ImportedDatasetRecord[],overrides:Partial<AnalysisAuthoringPanelProps>={}):AnalysisAuthoringPanelProps {
 const noop=()=>{};
 return {
 importedDatasets:datasets,selectedQuestion:defaultQuestion,selectedVariableSet:null,filteredQuestions:defaultDataset.questions,question:defaultQuestion.id,
 setQuestion:noop,applyQuestionSelection:noop,breakBy:'SUMMARY',setBreakBy:noop,metric:'percent_selected',setMetric:noop,weight:null,setWeight:noop,
 filterField:null,setFilterField:noop,filterValue:'all',setFilterValue:noop,comparisonMode:'none',comparisonDatasets:[],setComparisonMode:noop,setComparisonDatasets:noop,toggleComparisonDataset:noop,
 selectedFilterDimension:null,selectedChartTypes:['table','vertical_bar','horizontal_bar','donut'],chartType:'vertical_bar',setChartType:noop,isLoading:false,
 query:{dataset:defaultDataset.id,question:defaultQuestion.id,breakBy:'SUMMARY',filters:[],weight:null,metric:'percent_selected',chartType:'vertical_bar'},
 addTileFromSourceWithVisualization:vi.fn(async()=> 'seeded-tile'),addTileFromImportedDatasetField:vi.fn(async()=> 'imported-tile'),importDataset:vi.fn(async()=>null),...overrides
 } as unknown as AnalysisAuthoringPanelProps;
}


describe('imported analysis creation accuracy',()=>{
 it('clears filters and breakouts after importing a new study, then creates from all new rows',async()=>{
  const first=await csv('Response,Region,Spend\nYes,North,10\nNo,North,20\nYes,South,30\n','first.csv');
  const second=await csv('Response,Region,Spend\nYes,South,100\nNo,West,200\n','second.csv');
  const create=vi.fn(async()=> 'tile');
  function Harness(){const[datasets,setDatasets]=useState([first]);const props=minimumProps(datasets,{addTileFromImportedDatasetField:create,importDataset:async()=>{setDatasets([first,second]);return second;}});return <GuidedDataQueryModal props={props} onClose={()=>{}}/>;}
  await act(async()=>root.render(<Harness/>));await act(async()=>button('Compare by a group').click());await change('Compare by',first.fields[1].id);await change('Limit to',first.fields[1].id);await change('Keep responses where','North');
  const input=host.querySelector<HTMLInputElement>('input[type="file"]')!;Object.defineProperty(input,'files',{value:[new File(['synthetic'],'second.csv')],configurable:true});await act(async()=>input.dispatchEvent(new Event('change',{bubbles:true})));
  expect(select('Imported dataset').value).toBe(second.id);expect(select('Limit to').value).toBe('none');expect(host.textContent).not.toContain('Filter: Region is North');expect(host.textContent).not.toContain('Keep responses where');
  await act(async()=>button('Create table').click());expect(create).toHaveBeenCalledOnce();
  const args=create.mock.calls[0] as unknown as [ImportedDatasetRecord,ImportedDatasetRecord['fields'][number], 'table','count',{filter:null;bannerField:null}];expect(args[0].id).toBe(second.id);expect(args[4].filter).toBeNull();expect(args[4].bannerField).toBeNull();
  const result=runImportedDatasetQuery({dataset:args[0],field:args[1],chartType:args[2],metric:'count',...args[4]});expect(result.table.reduce((n,row)=>n+row.values.summary,0)).toBe(2);
 });
 it('keeps the placeholder distinct from a literal all filter value and passes that value to creation',async()=>{
  const dataset=await csv('Answer,Region\nYes,all\nNo,North\nYes,all\n');const create=vi.fn(async()=> 'tile');await act(async()=>root.render(<GuidedDataQueryModal props={minimumProps([dataset],{addTileFromImportedDatasetField:create})} onClose={()=>{}}/>));
  await change('Limit to',dataset.fields[1].id);expect(select('Keep responses where').value).toBe('');expect(Array.from(select('Keep responses where').options).filter(o=>o.value==='all')).toHaveLength(1);
  await change('Keep responses where','all');expect(host.textContent).toContain('Filter: Region is all');await act(async()=>button('Create table').click());
  const args=create.mock.calls[0] as unknown as [ImportedDatasetRecord,ImportedDatasetRecord['fields'][number], 'table','count',{filter:{field:ImportedDatasetRecord['fields'][number];value:string}}];expect(args[4].filter.value).toBe('all');
  const result=runImportedDatasetQuery({dataset:args[0],field:args[1],chartType:args[2],metric:'count',...args[4]});expect(result.table.map(row=>[row.label,row.values.summary])).toEqual([['Yes',2]]);
 });
});
import { TileAnalysisQuerySection } from "../InspectorTileAnalysisSections";
import type { BuilderInspectorProps } from "../BuilderInspector";
import { initialDashboard } from "../../../document/documentSeeds";

it('preserves a literal all filter when rerunning an imported result in the inspector',async()=>{
 const dataset=await csv('Answer,Region\nYes,all\nNo,North\nYes,all\n');
 const result=runImportedDatasetQuery({dataset,field:dataset.fields[0],filter:{field:dataset.fields[1],value:'all'},metric:'count',chartType:'table'});
 const tile={...structuredClone(initialDashboard.pages[0].tiles[0]),query:result.query,result,visualization:'table' as const,source:{kind:'importedField' as const,id:dataset.id+':'+dataset.fields[0].id,label:'Answer',datasetId:dataset.id,fieldId:dataset.fields[0].id}};
 const update=vi.fn();const noop=()=>{};
 const props={selectedTile:tile,selectedTileQuestion:defaultDataset.questions.find(q=>q.id===result.query.question),savedVariableSets:[],savedBanners:[],savedFilters:[],savedWeights:[],importedDatasets:[dataset],updateSelectedTile:update,isLoading:false,recordSavedSettingOriginCue:noop,saveSelectedTileBanner:noop,saveSelectedTileFilter:noop,saveSelectedTileWeight:noop,onViewSavedSettingInLibrary:noop} as unknown as BuilderInspectorProps;
 await act(async()=>root.render(<TileAnalysisQuerySection {...props}/>));expect(select('Keep responses where').value).toBe('all');expect(Array.from(select('Keep responses where').options).filter(option=>option.value==='all')).toHaveLength(1);
 await act(async()=>button('Update imported result').click());expect(update).toHaveBeenCalledOnce();const next=update.mock.calls[0][0];expect(next.result.table.map((row:{label:string;values:{summary:number}})=>[row.label,row.values.summary])).toEqual([['Yes',2]]);expect(next.result.metadataRefs.source.filterValue).toBe('all');
});

function inspectorTile(dataset:ImportedDatasetRecord,result=runImportedDatasetQuery({dataset,field:dataset.fields[0],metric:'count',chartType:'table'})) {
 return {...structuredClone(initialDashboard.pages[0].tiles[0]),query:result.query,result,visualization:'table' as const,source:{kind:'importedField' as const,id:dataset.id+':'+dataset.fields[0].id,label:'Answer',datasetId:dataset.id,fieldId:dataset.fields[0].id}};
}
function inspectorProps(tile:ReturnType<typeof inspectorTile>,datasets:ImportedDatasetRecord[],update:ReturnType<typeof vi.fn>) {
 const noop=()=>{};
 return {selectedTile:tile,selectedTileQuestion:defaultDataset.questions.find(q=>q.id===tile.query.question),savedVariableSets:[],savedBanners:[],savedFilters:[],savedWeights:[],importedDatasets:datasets,updateSelectedTile:update,isLoading:false,recordSavedSettingOriginCue:noop,saveSelectedTileBanner:noop,saveSelectedTileFilter:noop,saveSelectedTileWeight:noop,onViewSavedSettingInLibrary:noop} as unknown as BuilderInspectorProps;
}
function compactRemote(dataset:ImportedDatasetRecord):ImportedDatasetRecord {
 return {...dataset,rows:[],previewRows:dataset.rows.slice(0,1),remote:{provider:'netlify',projectUrl:'',bucket:'',objectPath:'synthetic.csv',uploadedAt:dataset.importedAt}};
}

it('preserves the current analytical result when a remote update returns another study',async()=>{
 const dataset=await csv('Answer,Region\nYes,North\nNo,South\nYes,North\n'),tile=inspectorTile(dataset),before=structuredClone(tile),update=vi.fn();
 const response=structuredClone(tile.result);if(response.query.sourceIdentity?.kind!=='imported')throw Error('fixture');response.query.sourceIdentity.datasetId='wrong-study';
 vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(response),{status:200,headers:{'Content-Type':'application/json'}}));
 await act(async()=>root.render(<TileAnalysisQuerySection {...inspectorProps(tile,[compactRemote(dataset)],update)}/>));
 expect(button('Update imported result').disabled).toBe(false);await act(async()=>button('Update imported result').click());
 expect(host.textContent).toContain('incomplete or mismatched result');expect(update).not.toHaveBeenCalled();expect(tile).toEqual(before);expect(button('Update imported result').disabled).toBe(false);
});

it.each(['close panel','replace result'] as const)('ignores a pending imported update after %s',async(action)=>{
 const dataset=await csv('Answer,Region\nYes,North\nNo,South\nYes,North\n'),tile=inspectorTile(dataset),update=vi.fn();let resolve!:(value:Response)=>void;
 vi.mocked(fetch).mockImplementation(()=>new Promise<Response>(done=>{resolve=done;}));await act(async()=>root.render(<TileAnalysisQuerySection {...inspectorProps(tile,[compactRemote(dataset)],update)}/>));await act(async()=>button('Update imported result').click());
 const replacement=await csv('Answer,Region\nOther,West\nOther,West\n'),nextTile={...inspectorTile(replacement),id:tile.id},nextUpdate=vi.fn();
 await act(async()=>root.render(action==='close panel'?<div>Panel closed</div>:<TileAnalysisQuerySection {...inspectorProps(nextTile,[compactRemote(dataset),compactRemote(replacement)],nextUpdate)}/>));
 await act(async()=>resolve(new Response(JSON.stringify(tile.result),{status:200,headers:{'Content-Type':'application/json'}})));
 expect(update).not.toHaveBeenCalled();expect(nextUpdate).not.toHaveBeenCalled();if(action==='replace result')expect(select('Dataset').value).toBe(replacement.id);
});
it('does not apply an old query after the user changes its result options',async()=>{
 const dataset=await csv('Answer,Region\nYes,North\nNo,South\nYes,North\n'),tile=inspectorTile(dataset),update=vi.fn();let resolve!:(value:Response)=>void;
 vi.mocked(fetch).mockImplementation(()=>new Promise<Response>(done=>{resolve=done;}));await act(async()=>root.render(<TileAnalysisQuerySection {...inspectorProps(tile,[compactRemote(dataset)],update)}/>));await act(async()=>button('Update imported result').click());
 await change('Result values','percent_selected');await act(async()=>resolve(new Response(JSON.stringify(tile.result),{status:200,headers:{'Content-Type':'application/json'}})));
 expect(update).not.toHaveBeenCalled();expect(select('Result values').value).toBe('percent_selected');expect(button('Update imported result').disabled).toBe(false);
});
it('drops a pending imported update after an immediate editor context change without needing a render',async()=>{
 const dataset=await csv('Answer,Region\nYes,North\nNo,South\nYes,North\n'),tile=inspectorTile(dataset),update=vi.fn();let resolve!:(value:Response)=>void,version=0;
 vi.mocked(fetch).mockImplementation(()=>new Promise<Response>(done=>{resolve=done;}));const props={...inspectorProps(tile,[compactRemote(dataset)],update),getEditorContextVersion:()=>version};
 await act(async()=>root.render(<TileAnalysisQuerySection {...props}/>));await act(async()=>button('Update imported result').click());
 await act(async()=>{version+=2;resolve(new Response(JSON.stringify(tile.result),{status:200,headers:{'Content-Type':'application/json'}}));});
 expect(update).not.toHaveBeenCalled();expect(button('Update imported result').disabled).toBe(false);
});
it.each(['success','failure'] as const)('keeps a newer imported request running when an obsolete request ends with %s',async(outcome)=>{
 const dataset=await csv('Answer,Region\nYes,North\nNo,South\nYes,North\n'),tile=inspectorTile(dataset),update=vi.fn(),pending:Array<{resolve:(value:Response)=>void;reject:(error:Error)=>void}>=[];
 vi.mocked(fetch).mockImplementation(()=>new Promise<Response>((resolve,reject)=>pending.push({resolve,reject})));await act(async()=>root.render(<TileAnalysisQuerySection {...inspectorProps(tile,[compactRemote(dataset)],update)}/>));
 await act(async()=>button('Update imported result').click());await change('Result values','percent_selected');await act(async()=>button('Update imported result').click());expect(pending).toHaveLength(2);
 await act(async()=>{if(outcome==='success')pending[0].resolve(new Response(JSON.stringify(tile.result),{status:200}));else pending[0].reject(new Error('Obsolete imported error'));});
 expect(update).not.toHaveBeenCalled();expect(button('Updating...').disabled).toBe(true);expect(host.textContent).not.toContain('Obsolete imported error');
 const latest=runImportedDatasetQuery({dataset,field:dataset.fields[0],metric:'percent_selected',chartType:'table'});await act(async()=>pending[1].resolve(new Response(JSON.stringify(latest),{status:200})));
 expect(update).toHaveBeenCalledOnce();expect(update.mock.calls[0][0].result.metric.id).toBe('percent_selected');expect(button('Update imported result').disabled).toBe(false);
});
it('invalidates a pending imported edit even when its options change back before React rerenders',async()=>{
 const dataset=await csv('Answer\nYes\nNo\nYes\n'),tile=inspectorTile(dataset),update=vi.fn();let resolve!:(value:Response)=>void;
 vi.mocked(fetch).mockImplementation(()=>new Promise<Response>(done=>{resolve=done;}));await act(async()=>root.render(<TileAnalysisQuerySection {...inspectorProps(tile,[compactRemote(dataset)],update)}/>));await act(async()=>button('Update imported result').click());
 const metric=select('Result values');await act(async()=>{metric.value='percent_selected';metric.dispatchEvent(new Event('change',{bubbles:true}));metric.value='count';metric.dispatchEvent(new Event('change',{bubbles:true}));resolve(new Response(JSON.stringify(tile.result),{status:200}));});
 expect(update).not.toHaveBeenCalled();expect(select('Result values').value).toBe('count');expect(button('Update imported result').disabled).toBe(false);
});
it('requires an explicit replacement when a saved imported result is missing its grouping identity',async()=>{
 const dataset=await csv('Answer,Region\nYes,North\nNo,South\n'),tile=inspectorTile(dataset),update=vi.fn(),source=tile.result.metadataRefs.source;
 if(source?.kind!=='imported')throw Error('fixture');delete (source as Partial<typeof source>).primaryFieldId;
 await act(async()=>root.render(<TileAnalysisQuerySection {...inspectorProps(tile,[dataset],update)}/>));expect(select('Group responses by').value).toBe('');expect(button('Update imported result').disabled).toBe(true);expect(update).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();
 await change('Group responses by',dataset.fields[0].id);expect(button('Update imported result').disabled).toBe(false);
});

it.each(['grouping', 'comparison', 'filter', 'numeric'] as const)('preserves a saved result when its %s field is unavailable', async (role) => {
 const dataset=await csv('Answer,Region,Spend\nYes,North,10\nNo,South,20\nYes,South,30\n');
 const removed=role==='grouping'?dataset.fields[0]:role==='numeric'?dataset.fields[2]:dataset.fields[1];
 const result=runImportedDatasetQuery({dataset,field:dataset.fields[0],metric:role==='numeric'?'sum':'count',chartType:'table',
  ...(role==='numeric'?{measureField:dataset.fields[2]}:{}),...(role==='comparison'?{bannerField:dataset.fields[1]}:{}),
  ...(role==='filter'?{filter:{field:dataset.fields[1],value:'North'}}:{})});
 const tile=inspectorTile(dataset,result), original=structuredClone(tile), update=vi.fn();
 const changed={...dataset,fields:dataset.fields.filter(field=>field.id!==removed.id)};
 await act(async()=>root.render(<TileAnalysisQuerySection {...inspectorProps(tile,[changed],update)}/>));
 expect(host.querySelector('[role="alert"]')?.textContent).toContain(`selected ${role} field is no longer available`);
 expect(button('Update imported result').disabled).toBe(true);
 await act(async()=>button('Update imported result').click());expect(update).not.toHaveBeenCalled();expect(tile).toEqual(original);
 if(role==='grouping'){
  expect(select('Group responses by').value).toBe('');await change('Group responses by',dataset.fields[1].id);
 }else if(role==='comparison'){
  expect(select('Optional breakout').selectedOptions[0].textContent).toBe('Unavailable comparison field');await change('Optional breakout','none');
 }else if(role==='filter'){
  expect(select('Limit to').selectedOptions[0].textContent).toBe('Unavailable filter field');await change('Limit to','none');
 }else{
  await change('What do you want to show?','categorical');
  await change('Result values','count');
 }
 expect(button('Update imported result').disabled).toBe(false);await act(async()=>button('Update imported result').click());
 expect(update).toHaveBeenCalledOnce();const next=update.mock.calls[0][0].result;
 expect(next.table.reduce((sum:number,row:{values:{summary:number}})=>sum+row.values.summary,0)).toBe(3);
 expect(tile).toEqual(original);
});

it('does not silently run a stale saved filter against zero rows', async()=>{
 const dataset=await csv('Answer,Region\nYes,North\nNo,South\nYes,South\n');
 const result=runImportedDatasetQuery({dataset,field:dataset.fields[0],filter:{field:dataset.fields[1],value:'North'},metric:'count',chartType:'table'});
 const tile=inspectorTile(dataset,result), before=structuredClone(tile), update=vi.fn();
 const changed={...dataset,rows:dataset.rows.map(row=>({...row,Region:'South'}))};
 await act(async()=>root.render(<TileAnalysisQuerySection {...inspectorProps(tile,[changed],update)}/>));
 expect(select('Keep responses where').selectedOptions[0].textContent).toBe('Unavailable value: North');
 expect(button('Update imported result').disabled).toBe(true);expect(host.querySelector('[role="alert"]')?.textContent).toContain('filter value is no longer available');
 await change('Keep responses where','South');await act(async()=>button('Update imported result').click());
 expect(update.mock.calls[0][0].result.table.map((row:{label:string;values:{summary:number}})=>[row.label,row.values.summary])).toEqual([['Yes',2],['No',1]]);expect(tile).toEqual(before);
});

it('requires an explicit grouping choice for a missing requested field',async()=>{
 const dataset=await csv('Answer,Region\nYes,North\nNo,South\n'),create=vi.fn(async()=> 'tile');
 await act(async()=>root.render(<GuidedDataQueryModal props={minimumProps([dataset],{addTileFromImportedDatasetField:create})} launchContext={{importedDatasetId:dataset.id,importedFieldId:'missing-field'}} onClose={()=>{}}/>));
 expect(select('Group responses by').value).toBe('');expect(button('Create table').disabled).toBe(true);expect(host.querySelector('[role="alert"]')?.textContent).toContain('grouping field is no longer available');
 await change('Group responses by',dataset.fields[1].id);await act(async()=>button('Create table').click());expect((create.mock.calls[0] as unknown as [ImportedDatasetRecord,ImportedDatasetRecord['fields'][number]])[1].id).toBe(dataset.fields[1].id);
});

it('blocks field replacement while Analyze stays open and retains the input study',async()=>{
 const dataset=await csv('Answer,Region\nYes,North\nNo,South\n'),before=structuredClone(dataset),create=vi.fn(async()=> 'tile'),close=vi.fn();
 await act(async()=>root.render(<GuidedDataQueryModal props={minimumProps([dataset],{addTileFromImportedDatasetField:create})} onClose={close}/>));
 const changed={...dataset,fields:dataset.fields.slice(1)};
 await act(async()=>root.render(<GuidedDataQueryModal props={minimumProps([changed],{addTileFromImportedDatasetField:create})} onClose={close}/>));
 expect(select('Group responses by').value).toBe('');expect(button('Create table').disabled).toBe(true);expect(create).not.toHaveBeenCalled();expect(dataset).toEqual(before);
 await change('Group responses by',dataset.fields[1].id);expect(button('Create table').disabled).toBe(false);
});

it('retains explicit modeled-field snapshots supplied by the analysis launch action',async()=>{
 const dataset=await csv('Answer,Region\nYes,North\nNo,South\n'),create=vi.fn(async()=> 'tile');
 const modeled={...dataset.fields[0],id:'modeled-field'};
 await act(async()=>root.render(<GuidedDataQueryModal props={minimumProps([dataset],{addTileFromImportedDatasetField:create})} launchContext={{importedDatasetId:dataset.id,importedFieldId:modeled.id,importedFieldSnapshot:modeled}} onClose={()=>{}}/>));
 expect(select('Group responses by').value).toBe(modeled.id);expect(button('Create table').disabled).toBe(false);
 await act(async()=>button('Create table').click());expect((create.mock.calls[0] as unknown as [ImportedDatasetRecord,ImportedDatasetRecord['fields'][number]])[1].id).toBe(modeled.id);
});

it.each(['comparison','filter'] as const)('retains an unavailable %s constraint while Analyze stays open',async(role)=>{
 const dataset=await csv('Answer,Region\nYes,North\nNo,South\nYes,South\n'),create=vi.fn(async()=> 'tile'),close=vi.fn();
 const render=(value:ImportedDatasetRecord)=><GuidedDataQueryModal props={minimumProps([value],{addTileFromImportedDatasetField:create})} onClose={close}/>;
 await act(async()=>root.render(render(dataset)));
 if(role==='comparison'){await act(async()=>button('Compare by a group').click());await change('Compare by',dataset.fields[1].id);}
 else{await change('Limit to',dataset.fields[1].id);await change('Keep responses where','North');}
 await act(async()=>root.render(render({...dataset,fields:dataset.fields.slice(0,1)})));
 expect(button('Create table').disabled).toBe(true);expect(host.querySelector('[role="alert"]')?.textContent).toContain(`selected ${role} field is no longer available`);
 await act(async()=>button('Create table').click());expect(create).not.toHaveBeenCalled();
 await change(role==='comparison'?'Optional comparison group':'Limit to','none');
 expect(button('Create table').disabled).toBe(false);await act(async()=>button('Create table').click());
 const args=create.mock.calls[0] as unknown as [ImportedDatasetRecord,ImportedDatasetRecord['fields'][number],string,string,{filter:null;bannerField:null}];
 expect(args[4].filter).toBeNull();expect(args[4].bannerField).toBeNull();
});

it('requires a new filter value after its source responses change while Analyze is open',async()=>{
 const dataset=await csv('Answer,Region\nYes,North\nNo,South\nYes,South\n'),create=vi.fn(async()=> 'tile'),close=vi.fn();
 const render=(value:ImportedDatasetRecord)=><GuidedDataQueryModal props={minimumProps([value],{addTileFromImportedDatasetField:create})} onClose={close}/>;
 await act(async()=>root.render(render(dataset)));await change('Limit to',dataset.fields[1].id);await change('Keep responses where','North');
 await act(async()=>root.render(render({...dataset,rows:dataset.rows.map(row=>({...row,Region:'South'}))})));
 expect(select('Keep responses where').selectedOptions[0].textContent).toBe('Unavailable value: North');expect(button('Create table').disabled).toBe(true);
 expect(host.querySelector('[role="alert"]')?.textContent).toContain('filter value is no longer available');
 await change('Keep responses where','South');await act(async()=>button('Create table').click());
 const args=create.mock.calls[0] as unknown as [ImportedDatasetRecord,ImportedDatasetRecord['fields'][number],string,string,{filter:{value:string}}];expect(args[4].filter.value).toBe('South');
});
it('requires an explicit choice instead of replacing a missing requested study',async()=>{
 const dataset=await csv('Answer,Region\nYes,North\nNo,South\n','available.csv');const create=vi.fn(async()=> 'tile');
 await act(async()=>root.render(<GuidedDataQueryModal props={minimumProps([dataset],{addTileFromImportedDatasetField:create})} launchContext={{importedDatasetId:'missing-study'}} onClose={()=>{}}/>));
 expect(host.textContent).toContain('Study unavailable');expect(host.querySelector('[role="alert"]')?.textContent).toContain('No replacement study has been selected');expect(select('Imported dataset').value).toBe('');expect(button('Create table').disabled).toBe(true);
 await act(async()=>button('Create table').click());expect(create).not.toHaveBeenCalled();
 await change('Imported dataset',dataset.id);expect(button('Create table').disabled).toBe(false);expect(host.querySelector('[role="alert"]')).toBeNull();await act(async()=>button('Create table').click());expect((create.mock.calls[0] as unknown as [ImportedDatasetRecord])[0].id).toBe(dataset.id);
});
it('does not fall back when the selected study disappears while Analyze remains open',async()=>{
 const first=await csv('Answer,Region\nYes,North\nNo,South\n','first.csv'),second=await csv('Answer,Region\nYes,East\nNo,West\n','second.csv');const create=vi.fn(async()=> 'tile'),close=vi.fn();const launch={importedDatasetId:first.id};
 await act(async()=>root.render(<GuidedDataQueryModal props={minimumProps([first,second],{addTileFromImportedDatasetField:create})} launchContext={launch} onClose={close}/>));expect(select('Imported dataset').value).toBe(first.id);
 await act(async()=>root.render(<GuidedDataQueryModal props={minimumProps([second],{addTileFromImportedDatasetField:create})} launchContext={launch} onClose={close}/>));expect(select('Imported dataset').value).toBe('');expect(button('Create table').disabled).toBe(true);expect(host.textContent).toContain('Study unavailable');expect(create).not.toHaveBeenCalled();
});
it('still permits an explicit sample-study choice when the requested study is unavailable',async()=>{
 const imported=vi.fn(async()=> 'imported'),sample=vi.fn(async()=> 'sample');await act(async()=>root.render(<GuidedDataQueryModal props={minimumProps([],{addTileFromImportedDatasetField:imported,addTileFromSourceWithVisualization:sample})} launchContext={{importedDatasetId:'missing-study'}} onClose={()=>{}}/>));
 expect(button('Create table').disabled).toBe(true);await act(async()=>button('Explore the sample study').click());expect(button('Create table').disabled).toBe(false);await act(async()=>button('Create table').click());expect(sample).toHaveBeenCalledOnce();expect(imported).not.toHaveBeenCalled();
});
it('requires an explicit replacement in the inspector when the original study is missing',async()=>{
 const original=await csv('Answer,Region\nYes,North\nNo,South\n','original.csv'),replacement=await csv('Answer,Region\nYes,East\nNo,West\n','replacement.csv');const tile=inspectorTile(original),before=structuredClone(tile),update=vi.fn();
 await act(async()=>root.render(<TileAnalysisQuerySection {...inspectorProps(tile,[replacement],update)}/>));expect(select('Dataset').value).toBe('');expect(button('Update imported result').disabled).toBe(true);expect(host.querySelector('[role="alert"]')?.textContent).toContain('original study is unavailable');
 await act(async()=>button('Update imported result').click());expect(update).not.toHaveBeenCalled();await change('Dataset',replacement.id);expect(button('Update imported result').disabled).toBe(false);await act(async()=>button('Update imported result').click());expect(update.mock.calls[0][0].result.metadataRefs.source.datasetId).toBe(replacement.id);expect(tile).toEqual(before);
});
it('blocks incomplete remote filter choices and permits explicit unfiltered creation',async()=>{
 const full=await csv('Answer,Region\nYes,North\nNo,South\nYes,West\n');const dataset=compactRemote(full),create=vi.fn(async()=> 'tile');
 await act(async()=>root.render(<GuidedDataQueryModal props={minimumProps([dataset],{addTileFromImportedDatasetField:create})} onClose={()=>{}}/>));expect(button('Create table').disabled).toBe(false);await change('Limit to',dataset.fields[1].id);
 expect(select('Keep responses where').disabled).toBe(true);expect(Array.from(select('Keep responses where').options).some(option=>option.value==='North')).toBe(false);expect(button('Create table').disabled).toBe(true);expect(host.textContent).toContain('Complete filter choices are unavailable');await act(async()=>button('Create table').click());expect(create).not.toHaveBeenCalled();
 await change('Limit to','none');expect(button('Create table').disabled).toBe(false);await act(async()=>button('Create table').click());expect((create.mock.calls[0] as unknown as [unknown,unknown,unknown,unknown,{filter:unknown}])[4].filter).toBeNull();expect(fetch).not.toHaveBeenCalled();
});
it('keeps the existing remote result unchanged and blocks rerun until incomplete filtering is removed',async()=>{
 const full=await csv('Answer,Region\nYes,North\nNo,South\nYes,West\n');const compact=compactRemote(full),complete={...compact,rows:full.rows};const result=runImportedDatasetQuery({dataset:complete,field:full.fields[0],filter:{field:full.fields[1],value:'North'},metric:'count',chartType:'table'});const tile=inspectorTile(compact,result),before=structuredClone(tile),update=vi.fn();
 await act(async()=>root.render(<TileAnalysisQuerySection {...inspectorProps(tile,[compact],update)}/>));expect(select('Keep responses where').disabled).toBe(true);expect(button('Update imported result').disabled).toBe(true);expect(host.textContent).toContain('Complete filter choices are unavailable');await act(async()=>button('Update imported result').click());expect(update).not.toHaveBeenCalled();expect(tile).toEqual(before);
 await change('Limit to','none');expect(button('Update imported result').disabled).toBe(false);expect(fetch).not.toHaveBeenCalled();
});
import { TileRenderer } from "../CanvasRenderers";
it('renders corrected numeric cell bases and suppresses unverified legacy sample counts',async()=>{
 const dataset=await csv('Segment,Spend\nCore,10\nCore,20\nGrowth,100\nGrowth,200\nGrowth,300\nGrowth,400\n');const result=runImportedDatasetQuery({dataset,field:dataset.fields[0],measureField:dataset.fields[1],metric:'average',chartType:'table'});const tile={...inspectorTile(dataset,result),appearance:{...structuredClone(initialDashboard.pages[0].tiles[0].appearance),showBases:true}};const noop=()=>{};
 await act(async()=>root.render(<TileRenderer tile={tile} selected={false} onSelect={noop} onTitleChange={noop} onTitleAppearanceChange={noop}/>));expect(host.textContent).toContain('Base 2');expect(host.textContent).toContain('Base 4');expect(host.textContent).not.toContain('Base 6');
 const legacy=structuredClone(tile);const source=legacy.result.metadataRefs.source;if(source?.kind!=='imported')throw new Error('Expected imported source');delete source.measureBaseScope;legacy.result.table.forEach(row=>{row.bases.summary=6;});legacy.result.series.forEach(series=>{series.bases=[6];});const before=structuredClone(legacy);
 await act(async()=>root.render(<TileRenderer tile={legacy} selected={false} onSelect={noop} onTitleChange={noop} onTitleAppearanceChange={noop}/>));expect(host.textContent).not.toContain('Base 6');expect(host.textContent).toContain('Base unavailable; rerun');expect(host.textContent).toContain('Sample bases need refresh');expect(legacy).toEqual(before);
});

it('uses an existing-ID categorical modeling snapshot instead of older numeric metadata',async()=>{
 const dataset=await csv('Answer,Spend\nYes,10\nNo,20\nYes,10\n'),before=structuredClone(dataset),create=vi.fn(async()=> 'tile');
 const modeled={...dataset.fields[1],type:'categorical' as const,modelingRole:'candidate_dimension' as const,label:'Spending bands'};
 await act(async()=>root.render(<GuidedDataQueryModal props={minimumProps([dataset],{addTileFromImportedDatasetField:create})} launchContext={{importedDatasetId:dataset.id,importedFieldId:modeled.id,importedFieldSnapshot:modeled}} onClose={()=>{}}/>));
 expect(select('Group responses by').value).toBe(modeled.id);expect(button('Create table').disabled).toBe(false);
 await change('Result values','count');await act(async()=>button('Create table').click());
 const args=create.mock.calls[0] as unknown as [ImportedDatasetRecord,ImportedDatasetRecord['fields'][number], 'table','count',{}];
 expect(args[0].fields.filter(field=>field.id===modeled.id)).toEqual([modeled]);expect(args[1]).toEqual(modeled);
 const result=runImportedDatasetQuery({dataset:args[0],field:args[1],chartType:args[2],metric:args[3],...args[4]});
 expect(result.table.map(row=>[row.label,row.values.summary])).toEqual([['10',2],['20',1]]);expect(dataset).toEqual(before);
});

it('uses an existing-ID numeric modeling snapshot for the selected measure',async()=>{
 const parsed=await csv('Answer,Spend\nYes,10\nNo,20\nYes,30\n');
 const modeled={...parsed.fields[1],type:'numeric' as const,modelingRole:'candidate_measure' as const,label:'Amount spent'};
 const dataset={...parsed,fields:parsed.fields.map(field=>field.id===modeled.id?{...field,type:'text' as const,modelingRole:'raw_variable' as const}:field)},before=structuredClone(dataset),create=vi.fn(async()=> 'tile');
 const other=await csv('Answer,OtherAmount\nYes,40\nNo,60\n','other.csv');
 await act(async()=>root.render(<GuidedDataQueryModal props={minimumProps([dataset,other],{addTileFromImportedDatasetField:create})} launchContext={{importedDatasetId:dataset.id,importedFieldId:modeled.id,importedFieldSnapshot:modeled}} onClose={()=>{}}/>));
 expect(button('Create table').disabled).toBe(false);
 await change('Imported dataset',other.id);expect(select('Number to summarize').selectedOptions[0].textContent).not.toBe('Amount spent');
 await change('Imported dataset',dataset.id);expect(select('Number to summarize').value).toBe(modeled.id);
 expect(button('Create table').disabled).toBe(false);
 await act(async()=>button('Create table').click());
 const args=create.mock.calls[0] as unknown as [ImportedDatasetRecord,ImportedDatasetRecord['fields'][number], 'table','average',{measureField:ImportedDatasetRecord['fields'][number]}];
 expect(args[4].measureField).toEqual(modeled);expect(args[3]).toBe('average');
 expect(runImportedDatasetQuery({dataset:args[0],field:args[1],chartType:args[2],metric:args[3],...args[4]}).table.map(row=>[row.label,row.values.summary])).toEqual([['Yes',20],['No',20]]);
 expect(dataset).toEqual(before);
});

it('clears blocked constraints after explicitly switching to a different study',async()=>{
 const first=await csv('Answer,Region\nYes,North\nNo,South\n','first.csv'),second=await csv('Answer,Region\nYes,East\nYes,West\n','second.csv'),create=vi.fn(async()=> 'tile');
 const render=(value:ImportedDatasetRecord)=><GuidedDataQueryModal props={minimumProps([value,second],{addTileFromImportedDatasetField:create})} onClose={()=>{}}/>;
 await act(async()=>root.render(render(first)));await change('Limit to',first.fields[1].id);await change('Keep responses where','North');
 await act(async()=>root.render(render({...first,fields:first.fields.slice(0,1)})));expect(button('Create table').disabled).toBe(true);
 await change('Imported dataset',second.id);expect(select('Limit to').value).toBe('none');expect(button('Create table').disabled).toBe(false);
 await act(async()=>button('Create table').click());
 const args=create.mock.calls[0] as unknown as [ImportedDatasetRecord,ImportedDatasetRecord['fields'][number],string,string,{filter:null;bannerField:null}];
 expect(args[0].id).toBe(second.id);expect(args[4].filter).toBeNull();expect(args[4].bannerField).toBeNull();
});


it('requires explicit recovery rather than analyzing another field when launched from an identifier',async()=>{
 const dataset=await csv('Respondent_ID,Answer\n1,Yes\n2,No\n3,Yes\n'),create=vi.fn(async()=> 'tile');
 await act(async()=>root.render(<GuidedDataQueryModal props={minimumProps([dataset],{addTileFromImportedDatasetField:create})} launchContext={{importedDatasetId:dataset.id,importedFieldId:dataset.fields[0].id,importedFieldSnapshot:dataset.fields[0]}} onClose={()=>{}}/>));
 expect(select('Group responses by').value).toBe('');expect(button('Create table').disabled).toBe(true);expect(create).not.toHaveBeenCalled();
 await change('Group responses by',dataset.fields[1].id);expect(button('Create table').disabled).toBe(false);
});
import { allRespondentsGroupingField, allRespondentsGroupingId } from '../../../data/numericSummaryScope';
it('offers a clearly labeled new page when the current page is full, creating nothing until confirmed',async()=>{
 const dataset=await csv('Answer\nYes\nNo\n'),create=vi.fn(async()=> 'tile'),activePage=structuredClone(initialDashboard.pages[0]);
 activePage.elements=[];activePage.tiles=[{...activePage.tiles[0],layout:{x:48,y:72,width:760,height:460,zIndex:1}}];const before=structuredClone(activePage);
 await act(async()=>root.render(<GuidedDataQueryModal props={minimumProps([dataset],{activePage,addTileFromImportedDatasetField:create})} onClose={()=>{}}/>));
 expect(select('Place analysis').value).toBe('new_page');expect(select('Place analysis').options[0].disabled).toBe(true);
 expect(button('Create table on new page').disabled).toBe(false);expect(create).not.toHaveBeenCalled();expect(activePage).toEqual(before);
 await act(async()=>button('Create table on new page').click());expect(create).toHaveBeenCalledOnce();
 expect((create.mock.calls[0] as unknown[])[4]).toMatchObject({destination:'new_page'});expect(activePage).toEqual(before);
});
it('keeps an explicit current-page choice when room changes, requiring a new destination before creation',async()=>{
 const dataset=await csv('Answer\nYes\nNo\n'),create=vi.fn(),activePage=structuredClone(initialDashboard.pages[0]);activePage.elements=[];activePage.tiles=[];
 const props=minimumProps([dataset],{activePage,addTileFromImportedDatasetField:create});await act(async()=>root.render(<GuidedDataQueryModal props={props} onClose={()=>{}}/>));
 expect(select('Place analysis').value).toBe('current_page');
 const full={...activePage,tiles:[{...structuredClone(initialDashboard.pages[0].tiles[0]),layout:{x:48,y:72,width:760,height:460,zIndex:1}}]};
 await act(async()=>root.render(<GuidedDataQueryModal props={{...props,activePage:full}} onClose={()=>{}}/>));
 expect(select('Place analysis').value).toBe('current_page');expect(button('Create table').disabled).toBe(true);expect(create).not.toHaveBeenCalled();
 await change('Place analysis','new_page');expect(button('Create table on new page').disabled).toBe(false);
});
it('offers a clear explicit next step for a numeric-only study without creating an analysis automatically',async()=>{
 const dataset=await csv('Spend\n10\n20\n30\n'), original=structuredClone(dataset), create=vi.fn(async()=> 'tile');
 await act(async()=>root.render(<GuidedDataQueryModal props={minimumProps([dataset],{addTileFromImportedDatasetField:create})} onClose={()=>{}}/>));
 expect(host.textContent).not.toContain('Modeled-only for now.');
 expect(button('Create table').disabled).toBe(true);expect(create).not.toHaveBeenCalled();
 await act(async()=>button('Summarize all respondents').click());
 expect(select('Group responses by').value).toBe(allRespondentsGroupingId);
 expect(document.activeElement).toBe(select('Group responses by'));
 expect(button('Create table').disabled).toBe(false);expect(host.textContent).toContain('n=3 valid values');
 expect(create).not.toHaveBeenCalled();expect(dataset).toEqual(original);
 await act(async()=>button('Create table').click());
 const args=create.mock.calls[0] as unknown as [ImportedDatasetRecord,ImportedDatasetRecord['fields'][number],'table','average',{groupingScope:'all_respondents';measureField:ImportedDatasetRecord['fields'][number]}];
 expect(create).toHaveBeenCalledOnce();expect(args[3]).toBe('average');
 expect(args[4]).toMatchObject({groupingScope:'all_respondents',measureField:{id:dataset.fields[0].id}});
});
it('does not advertise a local overall-summary shortcut for incomplete remote numeric studies',async()=>{
 const dataset=compactRemote(await csv('Spend\n10\n20\n30\n')),create=vi.fn();
 await act(async()=>root.render(<GuidedDataQueryModal props={minimumProps([dataset],{addTileFromImportedDatasetField:create})} onClose={()=>{}}/>));
 expect(Array.from(host.querySelectorAll('button')).some(node=>node.textContent==='Summarize all respondents')).toBe(false);
 expect(button('Create table').disabled).toBe(true);expect(create).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();
});
it('creates an overall numeric-only result only after an explicit scope choice',async()=>{
 const dataset=await csv('Spend\n10\n20\n30\n'),create=vi.fn(async()=> 'tile');
 await act(async()=>root.render(<GuidedDataQueryModal props={minimumProps([dataset],{addTileFromImportedDatasetField:create})} onClose={()=>{}}/>));
 expect(button('Create table').disabled).toBe(true);await change('Group responses by',allRespondentsGroupingId);
 expect(button('Create table').disabled).toBe(false);expect(host.textContent).toContain('n=3 valid values');
 await act(async()=>button('Create table').click());
 const args=create.mock.calls[0] as unknown as [ImportedDatasetRecord,ImportedDatasetRecord['fields'][number],'table','average',{groupingScope:'all_respondents';measureField:ImportedDatasetRecord['fields'][number]}];
 expect(args[4].groupingScope).toBe('all_respondents');expect(args[4].measureField.id).toBe(dataset.fields[0].id);
 expect(runImportedDatasetQuery({dataset:args[0],field:args[1],metric:args[3],chartType:args[2],...args[4]}).table[0].values.summary).toBe(20);
});
it('reopens an overall summary in the inspector and updates it without losing scope',async()=>{
 const dataset=await csv('Spend\n10\n20\n30\n');
 const result=runImportedDatasetQuery({dataset,field:allRespondentsGroupingField(dataset),groupingScope:'all_respondents',measureField:dataset.fields[0],metric:'average',chartType:'table'});
 const tile=inspectorTile(dataset,result),before=structuredClone(tile),update=vi.fn();
 await act(async()=>root.render(<TileAnalysisQuerySection {...inspectorProps(tile,[dataset],update)}/>));
 expect(select('Group responses by').value).toBe(allRespondentsGroupingId);expect(button('Update imported result').disabled).toBe(false);
 await change('Result values','sum');await act(async()=>button('Update imported result').click());
 const next=update.mock.calls[0][0].result;expect(next.table[0].values.summary).toBe(60);expect(next.metadataRefs.source.groupingScope).toBe('all_respondents');expect(tile).toEqual(before);
});
it('blocks a saved overall summary when its measure disappears, preserving the cached result',async()=>{
 const dataset=await csv('Spend\n10\n20\n30\n');const result=runImportedDatasetQuery({dataset,field:allRespondentsGroupingField(dataset),groupingScope:'all_respondents',measureField:dataset.fields[0],metric:'average',chartType:'table'});
 const tile=inspectorTile(dataset,result),before=structuredClone(tile),update=vi.fn();
 await act(async()=>root.render(<TileAnalysisQuerySection {...inspectorProps(tile,[{...dataset,fields:[]}],update)}/>));
 expect(button('Update imported result').disabled).toBe(true);expect(host.textContent).toContain('numeric field is no longer available');expect(update).not.toHaveBeenCalled();expect(tile).toEqual(before);
});

it('shows numeric calculation failures and blocks creation rather than hiding an unavailable mean',async()=>{
 const dataset=await csv('Spend\ninvalid\nmissing\n');dataset.fields[0]={...dataset.fields[0],type:'numeric',modelingRole:'candidate_measure'};const create=vi.fn(async()=> 'tile');
 await act(async()=>root.render(<GuidedDataQueryModal props={minimumProps([dataset],{addTileFromImportedDatasetField:create})} onClose={()=>{}}/>));
 await change('Group responses by',allRespondentsGroupingId);
 expect(host.querySelector('[role="alert"]')?.textContent).toContain('No valid numeric values remain');expect(button('Create table').disabled).toBe(true);expect(create).not.toHaveBeenCalled();
});

it('preserves a saved overall breakout result when a filter leaves an unavailable mean',async()=>{
 const dataset=await csv('Spend,Region,Group\n10,North,A\n20,South,B\n');const result=runImportedDatasetQuery({dataset,field:allRespondentsGroupingField(dataset),groupingScope:'all_respondents',measureField:dataset.fields[0],bannerField:dataset.fields[2],metric:'average',chartType:'table'});
 const tile=inspectorTile(dataset,result),before=structuredClone(tile),update=vi.fn();
 await act(async()=>root.render(<TileAnalysisQuerySection {...inspectorProps(tile,[dataset],update)}/>));
 await change('Limit to',dataset.fields[1].id);await change('Keep responses where','North');await act(async()=>button('Update imported result').click());
 expect(host.textContent).toContain('no valid numeric values for this average');expect(update).not.toHaveBeenCalled();expect(tile).toEqual(before);
});

it('honors the explicit selected-measure overall-summary launch action',async()=>{
 const dataset=await csv('Spend,OtherNumber\n10,100\n20,200\n30,300\n'),create=vi.fn(async()=> 'tile');
 await act(async()=>root.render(<GuidedDataQueryModal props={minimumProps([dataset],{addTileFromImportedDatasetField:create})} launchContext={{importedDatasetId:dataset.id,importedFieldId:dataset.fields[1].id,importedFieldSnapshot:dataset.fields[1],groupingScope:'all_respondents'}} onClose={()=>{}}/>));
 expect(select('Group responses by').value).toBe(allRespondentsGroupingId);expect(select('Number to summarize').value).toBe(dataset.fields[1].id);expect(button('Create table').disabled).toBe(false);
 await act(async()=>button('Create table').click());const args=create.mock.calls[0] as unknown as [ImportedDatasetRecord,ImportedDatasetRecord['fields'][number],'table','average',{groupingScope:'all_respondents';measureField:ImportedDatasetRecord['fields'][number]}];
 expect(args[4].measureField.id).toBe(dataset.fields[1].id);expect(runImportedDatasetQuery({dataset:args[0],field:args[1],metric:args[3],chartType:args[2],...args[4]}).table[0].values.summary).toBe(200);
});
it('does not substitute another measure when an explicit overall-summary launch field is missing',async()=>{
 const dataset=await csv('Spend\n10\n20\n30\n'),create=vi.fn(async()=> 'tile');
 await act(async()=>root.render(<GuidedDataQueryModal props={minimumProps([dataset],{addTileFromImportedDatasetField:create})} launchContext={{importedDatasetId:dataset.id,importedFieldId:'missing-number',groupingScope:'all_respondents'}} onClose={()=>{}}/>));
 expect(button('Create table').disabled).toBe(true);expect(host.textContent).toContain('numeric field is no longer available');expect(create).not.toHaveBeenCalled();
});

it('signals successful creation with the actual tile ID and never signals failed or canceled creation',async()=>{
 const dataset=await csv('Answer\nYes\nNo\n');const created=vi.fn(),close=vi.fn(),create=vi.fn(async()=>null as string|null);
 const render=()=> <GuidedDataQueryModal props={minimumProps([dataset],{addTileFromImportedDatasetField:create})} onClose={close} onCreated={created}/>;
 await act(async()=>root.render(render()));await act(async()=>button('Create table').click());expect(created).not.toHaveBeenCalled();expect(close).not.toHaveBeenCalled();
 await act(async()=>button('Cancel').click());expect(created).not.toHaveBeenCalled();expect(close).toHaveBeenCalledOnce();close.mockClear();
 create.mockResolvedValue('actual-tile-id');await act(async()=>root.render(<GuidedDataQueryModal key='fresh' props={minimumProps([dataset],{addTileFromImportedDatasetField:create})} onClose={close} onCreated={created}/>));await act(async()=>button('Create table').click());expect(created).toHaveBeenCalledExactlyOnceWith('actual-tile-id');expect(close).toHaveBeenCalledOnce();
});

it.each(['imported','sample'] as const)('ignores late %s completion after dismissal and leaves a new dialog open',async(kind)=>{
 const dataset=await csv('Answer\nYes\nNo\n');let resolve!:(value:string)=>void;const pending=new Promise<string>(done=>{resolve=done;});const oldClose=vi.fn(),newClose=vi.fn(),created=vi.fn();
 const overrides=kind==='imported'?{addTileFromImportedDatasetField:vi.fn(()=>pending)}:{addTileFromSourceWithVisualization:vi.fn(()=>pending)};
 await act(async()=>root.render(<GuidedDataQueryModal key='old' props={minimumProps(kind==='imported'?[dataset]:[],overrides)} onClose={oldClose} onCreated={created}/>));
 await act(async()=>button('Create table').click());expect(host.textContent).toContain('request may finish in the background');
 await act(async()=>button('Cancel').click());expect(oldClose).toHaveBeenCalledOnce();
 await act(async()=>root.render(<GuidedDataQueryModal key='new' props={minimumProps([dataset])} onClose={newClose} onCreated={created}/>));
 await act(async()=>resolve('late-result'));
 expect(oldClose).toHaveBeenCalledOnce();expect(newClose).not.toHaveBeenCalled();expect(created).not.toHaveBeenCalled();expect(host.querySelector('[role="dialog"]')).not.toBeNull();
});

it('launches a continuous numeric measure with 100 distinct values and preserves its valid sample base',async()=>{
 const dataset=await csv('Respondent_ID,Spend\n'+Array.from({length:100},(_,index)=>`${index+1},${index+1}`).join('\n'));const measure=dataset.fields[1],create=vi.fn(async()=> 'tile');
 await act(async()=>root.render(<GuidedDataQueryModal props={minimumProps([dataset],{addTileFromImportedDatasetField:create})} launchContext={{importedDatasetId:dataset.id,importedFieldId:measure.id,importedFieldSnapshot:measure,groupingScope:'all_respondents'}} onClose={()=>{}}/>));
 expect(select('Number to summarize').value).toBe(measure.id);expect(button('Create table').disabled).toBe(false);expect(host.textContent).toContain('n=100 valid values');
 await act(async()=>button('Create table').click());
 const args=create.mock.calls[0] as unknown as [ImportedDatasetRecord,ImportedDatasetRecord['fields'][number],'table','average',{groupingScope:'all_respondents';measureField:ImportedDatasetRecord['fields'][number]}];
 const result=runImportedDatasetQuery({dataset:args[0],field:args[1],metric:args[3],chartType:args[2],...args[4]});expect(result.table[0].values.summary).toBe(50.5);expect(result.table[0].bases.summary).toBe(100);
});

it('previews and creates a small nonzero numeric summary without displaying it as zero',async()=>{
 const dataset=await csv('Spend\n0.000001\n0.000003\n'),create=vi.fn(async()=> 'tile');
 await act(async()=>root.render(<GuidedDataQueryModal props={minimumProps([dataset],{addTileFromImportedDatasetField:create})} launchContext={{importedDatasetId:dataset.id,importedFieldId:dataset.fields[0].id,groupingScope:'all_respondents'}} onClose={()=>{}}/>));
 expect(host.querySelector('[aria-label="Analysis result preview"]')?.textContent).toContain('2E-6');
 expect(host.textContent).toContain('Numeric results retain calculation precision');expect(button('Create table').disabled).toBe(false);
 await act(async()=>button('Create table').click());expect(create).toHaveBeenCalledOnce();
});

it('shows invalid-only subgroups as unavailable in grouped average previews without removing them',async()=>{
 const dataset=await csv('Group,Spend\nNegative,-10\nMissing,invalid\nZero,0\n');const measure={...dataset.fields[1],type:'numeric' as const,modelingRole:'candidate_measure' as const};dataset.fields[1]=measure;
 await act(async()=>root.render(<GuidedDataQueryModal props={minimumProps([dataset])} launchContext={{importedDatasetId:dataset.id,importedFieldId:measure.id,importedFieldSnapshot:measure}} onClose={()=>{}}/>));
 const preview=host.querySelector('[aria-label="Analysis result preview"]')!;expect(preview.textContent).toContain('MissingUnavailable');expect(preview.textContent).toContain('not zero estimates');expect(button('Create table').disabled).toBe(false);
});
