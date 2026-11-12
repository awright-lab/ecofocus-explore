// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { RemoteRowsInspector } from '../RemoteRowsInspector';
import { syntheticRemoteRows } from '../syntheticRemoteRows';
import type { RemoteRowsProvider, Source } from '../remoteRowsProvider';
const source: Source = {datasetId:'study',datasetRevision:'1',schemaRevision:'1'};
let host: HTMLDivElement; let root: ReturnType<typeof createRoot>;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();});
async function settle(){await act(async()=>{await new Promise(r=>setTimeout(r,0));});}
function button(name:string){const b=[...document.querySelectorAll('button')].find(x=>x.textContent?.trim()===name);expect(b,name).toBeTruthy();return b!;}
async function click(name:string){await act(async()=>button(name).click());await settle();}
it('pages, evicts old row pages, inspects exact values, and resets on source replacement', async()=>{
 const fixture=syntheticRemoteRows(source,1000,100); await act(async()=>root.render(<RemoteRowsInspector source={source} provider={fixture.provider} onClose={()=>{}}/>));await settle();
 await act(async()=>document.querySelector<HTMLInputElement>('.remote-rows-fields input')!.click());await settle(); expect(fixture.stats.rowRequests).toBe(1);expect(document.querySelectorAll('tbody tr')).toHaveLength(25);expect(document.body.textContent).toContain('Missing');
 await act(async()=>document.querySelector<HTMLButtonElement>('tbody tr:nth-child(2) td button')!.click());expect(document.querySelector<HTMLTextAreaElement>('textarea')!.value).toBe('""');
 for(let i=0;i<4;i++)await click('Next rows'); expect(fixture.stats.rowRequests).toBe(5);for(let i=0;i<4;i++)await click('Previous rows');expect(fixture.stats.rowRequests).toBeGreaterThan(5);
 await act(async()=>root.render(<RemoteRowsInspector source={{...source,datasetRevision:'2'}} provider={fixture.provider} onClose={()=>{}}/>));await settle();expect(document.querySelectorAll('tbody tr')).toHaveLength(0);expect(document.body.textContent).toContain('revision changed');
});
it('rejects late replies after cancellation and retries safely',async()=>{
 let finish!:(value:unknown)=>void;let calls=0;const fixture=syntheticRemoteRows(source,100,10);const provider:RemoteRowsProvider={schema:fixture.provider.schema,rows:request=>{calls++;return calls===1?new Promise(resolve=>{finish=resolve;}):fixture.provider.rows(request);}};
 await act(async()=>root.render(<RemoteRowsInspector source={source} provider={provider} onClose={()=>{}}/>));await settle();await act(async()=>document.querySelector<HTMLInputElement>('.remote-rows-fields input')!.click());await settle();await click('Cancel loading');await act(async()=>finish({source,cursor:null,nextCursor:null,items:[{position:'stale',values:{'field-0':12}}]}));expect(document.body.textContent).not.toContain('stale');await click('Retry rows');expect(document.querySelectorAll('tbody tr')).toHaveLength(25);
});
it('renders an honest unavailable state without a provider',async()=>{await act(async()=>root.render(<RemoteRowsInspector source={source} onClose={()=>{}}/>));expect(document.querySelector('[role=alert]')?.textContent).toContain('unavailable');});
it('discards a late row reply after an in-place source revision change',async()=>{
 const mutable={...source};const fixture=syntheticRemoteRows(source,100,10);let finish!:(value:unknown)=>void;let signal:AbortSignal|undefined;
 const provider:RemoteRowsProvider={schema:async request=>({source:request.source,cursor:request.cursor,nextCursor:null,items:[{id:'field-0',label:'Field',sourceColumn:'f'}]}),rows:request=>{signal=request.signal;return new Promise(resolve=>{finish=resolve;});}};
 await act(async()=>root.render(<RemoteRowsInspector source={mutable} provider={provider} onClose={()=>{}}/>));await settle();await act(async()=>document.querySelector<HTMLInputElement>('.remote-rows-fields input')!.click());await settle();
 mutable.datasetRevision='2';await act(async()=>root.render(<RemoteRowsInspector source={mutable} provider={provider} onClose={()=>{}}/>));await settle();expect(signal?.aborted).toBe(true);await act(async()=>finish({source,cursor:null,nextCursor:null,items:[{position:'late-old-row',values:{'field-0':7}}]}));expect(document.body.textContent).not.toContain('late-old-row');expect(document.querySelectorAll('tbody tr')).toHaveLength(0);expect(fixture.stats.rowRequests).toBe(0);
});
it('does not let a late next-page response overwrite a changed field query',async()=>{
 const fixture=syntheticRemoteRows(source,100,10);let finish!:(value:unknown)=>void;let lateSignal:AbortSignal|undefined;
 const provider:RemoteRowsProvider={schema:fixture.provider.schema,rows:req=>{if(req.cursor!==null){lateSignal=req.signal;return new Promise(resolve=>{finish=resolve;});}return fixture.provider.rows(req);}};
 await act(async()=>root.render(<RemoteRowsInspector source={source} provider={provider} onClose={()=>{}}/>));await settle();await act(async()=>document.querySelector<HTMLInputElement>('.remote-rows-fields input')!.click());await settle();await click('Next rows');await act(async()=>document.querySelectorAll<HTMLInputElement>('.remote-rows-fields input')[1].click());await settle();expect(lateSignal?.aborted).toBe(true);await act(async()=>finish({source,cursor:'r:25',nextCursor:null,items:[{position:'stale-next',values:{'field-0':1}}]}));expect(document.body.textContent).not.toContain('stale-next');expect(document.querySelectorAll('tbody tr')).toHaveLength(25);
});
it('removes selected fields after their schema page leaves history and selects a replacement',async()=>{
 const fixture=syntheticRemoteRows(source,100,600);await act(async()=>root.render(<RemoteRowsInspector source={source} provider={fixture.provider} onClose={()=>{}}/>));await settle();
 for(let i=0;i<8;i++){await act(async()=>document.querySelectorAll<HTMLInputElement>('.remote-rows-fields input')[i].click());await settle();}
 expect(document.querySelectorAll('[aria-label="Selected fields"] li')).toHaveLength(8);
 for(let i=0;i<11;i++)await click('Next fields');
 for(let i=0;i<9;i++)await click('Previous fields');expect(button('Previous fields').disabled).toBe(true);expect(document.body.textContent).not.toContain('Synthetic field 0 ·');
 const remove=document.querySelector<HTMLButtonElement>('[aria-label="Remove selected field Synthetic field 0 [field-0], source column column-0"]')!;expect(remove).toBeTruthy();await act(async()=>remove.click());await settle();expect(document.activeElement?.textContent).toContain('Selected fields');expect(document.querySelectorAll('[aria-label="Selected fields"] li')).toHaveLength(7);
 await act(async()=>document.querySelector<HTMLInputElement>('.remote-rows-fields input')!.click());await settle();expect(document.querySelectorAll('[aria-label="Selected fields"] li')).toHaveLength(8);expect(fixture.stats.maxColumnsRequested).toBe(8);
});
it.each(['schema','rows'] as const)('reports a synchronous %s provider failure and permits retry',async kind=>{
 const fixture=syntheticRemoteRows(source,100,10);let failures=1;const provider:RemoteRowsProvider={schema:request=>{if(kind==='schema'&&failures-- > 0)throw Error('Synthetic synchronous schema failure');return fixture.provider.schema(request);},rows:request=>{if(kind==='rows'&&failures-- > 0)throw Error('Synthetic synchronous row failure');return fixture.provider.rows(request);}};
 await act(async()=>root.render(<RemoteRowsInspector source={source} provider={provider} onClose={()=>{}}/>));await settle();
 if(kind==='schema'){expect(document.body.textContent).toContain('Synthetic synchronous schema failure');await click('Retry fields');expect(document.querySelectorAll('.remote-rows-fields input')).toHaveLength(10);}
 else {await act(async()=>document.querySelector<HTMLInputElement>('.remote-rows-fields input')!.click());await settle();expect(document.body.textContent).toContain('Synthetic synchronous row failure');await click('Retry rows');expect(document.querySelectorAll('tbody tr')).toHaveLength(25);}
});
