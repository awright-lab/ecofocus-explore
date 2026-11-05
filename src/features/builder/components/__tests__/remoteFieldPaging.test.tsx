// @vitest-environment jsdom
import React,{act,useState} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {DataExplorerPanel} from '../DataExplorerPanel';
import {importDatasetBuffer} from '../../../data/datasetImportModel';
import {listImportedDatasetFieldsFromNetlify,type NetlifyDatasetFieldListResult} from '../../../data/netlifyDatasetStore';
import type {AnalysisAuthoringPanelProps} from '../AnalysisAuthoringPanel';
import type {ImportedDatasetRecord} from '../../../../../shared/types/dashboard';
vi.mock('../../../data/netlifyDatasetStore',()=>({listImportedDatasetFieldsFromNetlify:vi.fn()}));
let host:HTMLDivElement,root:Root,requests:Array<{args:Parameters<typeof listImportedDatasetFieldsFromNetlify>[0],resolve:(value:NetlifyDatasetFieldListResult)=>void,reject:(error:Error)=>void}>,setSearch:(value:string)=>void;
const noop=()=>{};
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>{queueMicrotask(()=>callback(0));return 1;});vi.stubGlobal('cancelAnimationFrame',noop);host=document.createElement('div');document.body.append(host);root=createRoot(host);requests=[];vi.mocked(listImportedDatasetFieldsFromNetlify).mockImplementation(args=>new Promise((resolve,reject)=>requests.push({args,resolve,reject})));});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.clearAllMocks();vi.unstubAllGlobals();});
async function dataset(id:string){const result=await importDatasetBuffer(new TextEncoder().encode('Answer\nYes\nNo\n').buffer,`${id}.csv`);return {...result.dataset!,id,title:id,fieldCount:200,rows:[],remote:{provider:'netlify' as const,projectUrl:'',bucket:'',objectPath:`${id}.csv`,uploadedAt:'2026-11-05T00:00:00Z'}};}
function page(study:ImportedDatasetRecord,label:string):NetlifyDatasetFieldListResult{return {datasetId:study.id,total:1,offset:0,limit:120,fields:[{...study.fields[0],id:label,sourceColumn:label,label}]};}
function button(text:string){const result=Array.from(host.querySelectorAll('button')).find(node=>node.textContent?.trim()===text||node.querySelector('strong')?.textContent===text);expect(result,text).toBeTruthy();return result!;}
async function setup(strict=false,empty=false,zeroCount=false){const a=await dataset('Study A'),b=await dataset('Study B'),studies=[a,b];if(empty)a.fields=[];if(zeroCount)a.fieldCount=0;
 function Harness(){const [search,updateSearch]=useState('');setSearch=updateSearch;const props={leftPanelView:'data',sourceSearch:search,setSourceSearch:updateSearch,importedDatasets:studies,liveDatasetSources:[],filteredQuestions:[],savedFilters:[],savedSegmentProfiles:[],savedBanners:[],openGuidedDataQuery:noop,importDataset:noop,removeImportedDataset:()=>null} as unknown as AnalysisAuthoringPanelProps;return <DataExplorerPanel {...props}/>;}
 await act(async()=>root.render(strict ? <React.StrictMode><Harness/></React.StrictMode> : <Harness/>));await act(async()=>button('Browse fields, filters, segments, and banners').click());return {a,b};
}
const labels=()=>Array.from(host.querySelectorAll('.variable-tree-row strong')).map(node=>node.textContent);
it('does not show old-study fields after a dataset switch',async()=>{
 const {a,b}=await setup();await act(async()=>button(b.title).click());expect(requests).toHaveLength(2);
 await act(async()=>requests[1].resolve(page(b,'B server field')));expect(labels()).toEqual(['B server field']);
 await act(async()=>requests[0].resolve(page(a,'A stale field')));expect(labels()).toEqual(['B server field']);
});
it('does not show an obsolete error from the previous study',async()=>{
 const {b}=await setup();await act(async()=>button(b.title).click());await act(async()=>requests[1].resolve(page(b,'B server field')));
 await act(async()=>requests[0].reject(new Error('Old study failure')));expect(host.textContent).not.toContain('Old study failure');
});
it('keeps the latest search after A-B-A searches',async()=>{
 const {a}=await setup();await act(async()=>setSearch('alpha'));await act(async()=>setSearch('beta'));await act(async()=>setSearch('alpha'));expect(requests).toHaveLength(4);
 await act(async()=>requests[3].resolve(page(a,'Newest alpha')));expect(labels()).toEqual(['Newest alpha']);
 await act(async()=>requests[1].resolve(page(a,'Obsolete alpha')));expect(labels()).toEqual(['Newest alpha']);
});
it('cannot contaminate a newly mounted library after old completion',async()=>{
 const {a}=await setup();const old=requests[0];await act(async()=>root.render(<div>Closed</div>));await setup();
 const latest=requests.at(-1)!;await act(async()=>latest.resolve(page(a,'New mount field')));await act(async()=>old.resolve(page(a,'Old mount field')));expect(labels()).toEqual(['New mount field']);
});
it('does not clear a newer study page loading marker when the old request finishes',async()=>{
 const {b}=await setup();await act(async()=>button(b.title).click());expect(requests).toHaveLength(2);
 await act(async()=>requests[0].reject(new Error('Old request ended')));
 const viewport=host.querySelector<HTMLDivElement>('.variable-tree-viewport')!;
 await act(async()=>{viewport.scrollTop=280;viewport.dispatchEvent(new Event('scroll',{bubbles:true}));});
 expect(requests,'one Study B page request remains in flight').toHaveLength(2);
});

it('allows an explicit retry without automatically repeating a failed page',async()=>{
 const {a}=await setup();await act(async()=>requests[0].reject(new Error('Temporary field failure')));
 expect(host.textContent).toContain('Temporary field failure');expect(requests).toHaveLength(1);
 await act(async()=>button('Retry loading fields').click());expect(requests).toHaveLength(2);
 await act(async()=>requests[1].resolve(page(a,'Retried field')));expect(labels()).toEqual(['Retried field']);expect(host.textContent).not.toContain('Temporary field failure');
});
it('rejects the superseded first request when StrictMode replays mount effects',async()=>{
 const {a}=await setup(true);expect(requests).toHaveLength(2);
 await act(async()=>requests[1].resolve(page(a,'Strict current field')));
 await act(async()=>requests[0].resolve(page(a,'Strict obsolete field')));expect(labels()).toEqual(['Strict current field']);
});

it('shows successfully loaded remote fields without any initial preview metadata',async()=>{
 const {a}=await setup(false,true);await act(async()=>requests[0].resolve(page({...a,fields:[{id:'seed',label:'Server-only field',sourceColumn:'Server',type:'categorical',modelingRole:'candidate_dimension',sampleValues:['Yes'],nonEmptyCount:1,distinctCount:1,eligibleForFilter:true,eligibleForSegment:true,eligibleForBanner:true}]},'Server-only field')));
 expect(labels()).toEqual(['Server-only field']);
});
it('offers a visible retry when zero initial metadata cannot load',async()=>{
 await setup(false,true,true);await act(async()=>requests[0].reject(new Error('No field metadata yet')));
 expect(host.querySelector('[role="alert"]')?.textContent).toContain('No field metadata yet');expect(button('Retry loading fields')).toBeTruthy();
});
it('discloses the service browsing bound while retaining the full logical field count',async()=>{
 const {a}=await setup();const first=page(a,'First field');first.total=200000;first.fields=Array.from({length:120},(_,index)=>({...first.fields[0],id:`field_${index}`,sourceColumn:`Column ${index}`,label:`Field ${index}`}));await act(async()=>requests[0].resolve(first));
 expect(host.textContent).toContain('200,000 fields');expect(host.textContent).toContain('Browse shows the first 100,080 fields');expect(host.textContent).toContain('Use field search');
 expect(host.querySelectorAll('.variable-tree-row').length).toBeLessThanOrEqual(29);
});

it('aligns offscreen remote pages to absolute field positions and resets a smaller search',async()=>{
 const {a}=await setup();const fullPage=(offset:number)=>({datasetId:a.id,total:240,offset,limit:120,fields:Array.from({length:120},(_,index)=>({...a.fields[0],id:`f_${offset+index}`,sourceColumn:`F${offset+index}`,label:`Field ${offset+index}`}))});
 await act(async()=>requests[0].resolve(fullPage(0)));
 const viewport=host.querySelector<HTMLDivElement>('.variable-tree-viewport')!;
 await act(async()=>{viewport.scrollTop=3360;viewport.dispatchEvent(new Event('scroll',{bubbles:true}));});
 const second=requests.find(item=>item.args.offset===120)!;expect(second).toBeTruthy();await act(async()=>second.resolve(fullPage(120)));
 expect(labels()).toEqual(Array.from({length:29},(_,index)=>`Field ${112+index}`));
 const rows=Array.from(host.querySelectorAll<HTMLElement>('.variable-tree-row'));expect(rows[0].style.top).toBe('3136px');
 await act(async()=>setSearch('needle'));const search=requests.find(item=>item.args.search==='needle'&&item.args.offset===0)!;expect(search).toBeTruthy();
 await act(async()=>search.resolve({datasetId:a.id,total:1,offset:0,limit:120,fields:[{...a.fields[0],id:'needle',label:'Needle',sourceColumn:'Needle'}]}));
 expect(labels()).toEqual(['Needle']);expect(host.querySelector<HTMLElement>('.variable-tree-row')?.style.top).toBe('0px');
});
