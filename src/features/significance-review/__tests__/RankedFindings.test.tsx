// @vitest-environment jsdom
import { act } from 'react';
import { createRoot,type Root } from 'react-dom/client';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { RankedFindings } from '../RankedFindings';
import { findingsFixture } from './rankedFindingsFixture';
let host:HTMLDivElement,root:Root;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('fetch',vi.fn());host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();});
function input(label:string){const wrapper=Array.from(host.querySelectorAll('label')).find(node=>Array.from(node.childNodes).filter(child=>child.nodeType===Node.TEXT_NODE).map(child=>child.textContent).join('')===label);if(!wrapper)throw Error(label);return wrapper.querySelector('input')!;}
async function change(label:string,value:string){await act(async()=>{const node=input(label);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}));});}
const cards=()=>Array.from(host.querySelectorAll<HTMLElement>('.ranked-finding-card'));
async function setup(){const {ctx,result}=await findingsFixture(),onInspect=vi.fn(),onStale=vi.fn();await act(async()=>root.render(<RankedFindings result={result} alpha={ctx.plan.alpha} onInspect={onInspect} onStale={onStale}/>));return{ctx,result,onInspect,onStale};}
it('shows transparent ranked counts, preserves original probabilities and lets research priority reorder within evidence',async()=>{
 const {ctx,result}=await setup(),before=structuredClone({ctx,comparisons:result.comparisons});
 expect(cards().map(card=>card.getAttribute('aria-label'))).toEqual(['Finding for "A"','Finding for "B"']);expect(host.textContent).toContain('Full reviewed family: 3');expect(cards()[0].textContent).toContain('80 / 100');
 await act(async()=>input('B ["B"]').click());expect(cards()[0].getAttribute('aria-label')).toBe('Finding for "B"');
 expect({ctx,comparisons:result.comparisons}).toEqual(before);expect(fetch).not.toHaveBeenCalled();
});
it('distinguishes invalid rules and empty results without inventing new tests or dropping cautions',async()=>{
 const {result}=await setup(),before=structuredClone(result.comparisons);
 await change('Minimum valid base in both groups','1');expect(cards()).toHaveLength(3);expect(host.textContent).toContain('fewer than 30');
 await change('Minimum absolute difference (percentage points)','100');expect(cards()).toHaveLength(0);expect(host.textContent).toContain('No interpreted comparisons meet');
 await change('Minimum valid base in both groups','');expect(host.querySelector('[role="alert"]')?.textContent).toContain('Enter both display limits');
 await change('Minimum valid base in both groups','1');await change('Minimum absolute difference (percentage points)','1.5');expect(host.querySelector('[role="alert"]')?.textContent).toContain('whole-number');
 expect(result.comparisons).toEqual(before);
});
it('checks source currentness on display interaction and notifies its owner without showing stale findings',async()=>{
 const {ctx,onStale}=await setup();ctx.studies[0].rows[0].Outcome='N';
 await change('Minimum absolute difference (percentage points)','10');expect(cards()).toHaveLength(0);expect(host.querySelector('[role="alert"]')?.textContent).toContain('context changed');expect(onStale).toHaveBeenCalled();
});
it('rechecks a late source change before inspection and prevents an obsolete action',async()=>{
 const {ctx,onInspect,onStale}=await setup(),target=cards()[0].querySelector('button')!;ctx.studies[0].rows[0].Outcome='N';
 await act(async()=>target.click());expect(onInspect).not.toHaveBeenCalled();expect(onStale).toHaveBeenCalled();expect(cards()).toHaveLength(0);
});
it('forwards the exact raw group identity to count inspection while preserving source data',async()=>{
 const {ctx,onInspect}=await setup(),before=structuredClone(ctx);await act(async()=>cards()[0].querySelector('button')!.click());expect(onInspect).toHaveBeenCalledWith('A');expect(ctx).toEqual(before);
});
