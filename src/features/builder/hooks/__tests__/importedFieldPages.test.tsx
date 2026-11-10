// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {useImportedFieldPages} from '../useImportedFieldPages';
import {listImportedDatasetFieldsFromNetlify,type NetlifyDatasetFieldListResult} from '../../../data/netlifyDatasetStore';
vi.mock('../../../data/netlifyDatasetStore',()=>({listImportedDatasetFieldsFromNetlify:vi.fn()}));
it('retains an independent page error and cached success, then retries only the failed page',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const pending:Array<{offset:number;resolve:(value:NetlifyDatasetFieldListResult)=>void;reject:(error:Error)=>void}>=[];
 vi.mocked(listImportedDatasetFieldsFromNetlify).mockImplementation(args=>new Promise((resolve,reject)=>pending.push({offset:args.offset,resolve,reject})));
 let state!:ReturnType<typeof useImportedFieldPages>;
 function Harness(){state=useImportedFieldPages('study','query',120);return <div>{state.error}</div>;}
 function page(offset:number):NetlifyDatasetFieldListResult{return {datasetId:'study',total:240,offset,limit:120,fields:Array.from({length:120},(_,i)=>({id:`field_${offset+i}`,sourceColumn:`Field ${offset+i}`,label:`Field ${offset+i}`,type:'categorical',modelingRole:'candidate_dimension',sampleValues:['Yes'],nonEmptyCount:1,distinctCount:1,eligibleForFilter:true,eligibleForSegment:true,eligibleForBanner:true}))};}
 try{await act(async()=>root.render(<Harness/>));await act(async()=>state.load(0,240));expect(pending.map(item=>item.offset)).toEqual([0,120]);
  await act(async()=>pending[0].reject(new Error('Page zero unavailable')));await act(async()=>pending[1].resolve(page(120)));
  expect(state.error).toBe('Page zero unavailable');expect(state.pages[1]).toHaveLength(120);expect(state.pages[0]).toBeUndefined();
  await act(async()=>state.load(0,240));expect(pending).toHaveLength(2);
  await act(async()=>state.retry());expect(pending.map(item=>item.offset)).toEqual([0,120,0]);expect(state.error).toBeNull();
  await act(async()=>pending[2].resolve(page(0)));expect(state.pages[0]).toHaveLength(120);expect(state.pages[1]).toHaveLength(120);expect(state.total).toBe(240);
 }finally{await act(async()=>root.unmount());host.remove();vi.clearAllMocks();vi.unstubAllGlobals();}
});
