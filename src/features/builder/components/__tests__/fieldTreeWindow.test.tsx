import { fieldTreeWindow } from '../fieldTreeWindow';
import React from 'react';
import {renderToString} from 'react-dom/server';
import {afterEach,expect,it,vi} from 'vitest';
import {DataExplorerPanel} from '../DataExplorerPanel';
import {importDatasetBuffer} from '../../../data/datasetImportModel';
import type {AnalysisAuthoringPanelProps} from '../AnalysisAuthoringPanel';
afterEach(()=>vi.restoreAllMocks());
async function props(total:number){const parsed=await importDatasetBuffer(new TextEncoder().encode('Answer\nYes\nNo\n').buffer,'synthetic.csv');const dataset={...parsed.dataset!,fieldCount:total,rows:[],remote:{provider:'netlify' as const,projectUrl:'',bucket:'',objectPath:'synthetic.csv',uploadedAt:'2026-11-05T00:00:00Z'}};return {leftPanelView:'data',sourceSearch:'',setSourceSearch:()=>{},importedDatasets:[dataset],liveDatasetSources:[],filteredQuestions:[],savedFilters:[],savedSegmentProfiles:[],savedBanners:[],openGuidedDataQuery:()=>{},removeImportedDataset:()=>null} as unknown as AnalysisAuthoringPanelProps;}
it('window: initial simple view does not allocate every one of 100000 remote field entries',async()=>{
 const value=await props(100000),original=Array.from,allocations:number[]=[];
 vi.spyOn(Array,'from').mockImplementation(((input:unknown,...rest:unknown[])=>{if(input&&typeof input==='object'&&'length' in input&&(input as {length:unknown}).length===100000){allocations.push(100000);return [];}return (original as Function)(input,...rest);}) as typeof Array.from);
 const html=renderToString(<DataExplorerPanel {...value}/>);expect(html).toContain('Data Library');expect(allocations).toEqual([]);
});
it('window: a safe-integer remote field total does not crash the library with invalid array length',async()=>{
 const value=await props(2**32),original=Array.from;
 vi.spyOn(Array,'from').mockImplementation(((input:unknown,...rest:unknown[])=>{if(input&&typeof input==='object'&&'length' in input&&Number((input as {length:unknown}).length)>100000)throw new Error('Unsafe remote allocation requested (intercepted before allocation)');return (original as Function)(input,...rest);}) as typeof Array.from);
 expect(()=>renderToString(<DataExplorerPanel {...value}/>)).not.toThrow();
});

it.each([0,1,29,200,100080,2**32])('keeps the visible field window bounded for total %s',total=>{
 for(const scroll of [0,280,3360,1e12,NaN]){
  const window=fieldTreeWindow(total,scroll,28,360,8);
  expect(window.start).toBeGreaterThanOrEqual(0);expect(window.end).toBeLessThanOrEqual(total);expect(window.end-window.start).toBeLessThanOrEqual(29);expect(window.end).toBeGreaterThanOrEqual(window.start);
 }
});
