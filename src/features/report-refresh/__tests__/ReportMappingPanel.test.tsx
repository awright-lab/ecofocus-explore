// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import ReportRefresh from '../ReportRefresh';
import { ReportMappingPanel, MappingCategoryReview, mappingPageSizes } from '../ReportMappingPanel';
import * as mappingModel from '../reportRefreshMapping';
import { fixture } from './reportRefreshFixture';

let host:HTMLDivElement, root:Root;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('crypto',webcrypto);host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});
const button=(text:string)=>Array.from(document.querySelectorAll('button')).find(node=>node.textContent===text)!;
async function click(text:string){await act(async()=>button(text).click());}
async function select(node:HTMLSelectElement,value:string){await act(async()=>{Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value')!.set!.call(node,value);node.dispatchEvent(new Event('change',{bubbles:true}));});}
async function search(label:string,value:string){const input=Array.from(document.querySelectorAll('label')).find(node=>node.textContent===label)!.querySelector('input')!;await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});}
async function mount(ctx:Awaited<ReturnType<typeof fixture>>){const onCreate=vi.fn(async()=>true);const render=async()=>act(async()=>root.render(<ReportRefresh {...ctx} onCreate={onCreate} onClose={()=>{}}/>));await render();await select(document.querySelector('select')!,'new');await click('Edit field and category mappings');return{render,onCreate};}
const targetFieldSelect=()=>document.querySelector<HTMLSelectElement>('fieldset select')!;
const categorySelects=()=>Array.from(document.querySelectorAll<HTMLSelectElement>('select[aria-label^="Target category for"]'));

it('bounds the DOM for 2,000 categories and 600 fields, searches tail values and retains selected off-page values',async()=>{
 const ctx=await fixture();
 for(const study of ctx.studies){study.rows=Array.from({length:2000},(_,i)=>({Region:`Code ${String(i).padStart(4,'0')}`,Amount:'1',Banner:'A'}));study.rowCount=2000;study.previewRows=study.rows.slice(0,5);study.fields[0].valueLabels={'Code 1999':'Tail answer'};for(let i=0;i<600;i++)study.fields.push({...study.fields[1],id:`unused-${i}`,label:`Unused ${i}`,sourceColumn:`Unused ${i}`});study.fieldCount=study.fields.length;}
 const before=JSON.stringify(ctx),scan=vi.spyOn(mappingModel,'waveCategories');
 await mount(ctx);
 expect(document.querySelectorAll('fieldset')).toHaveLength(1);expect(Array.from(document.querySelectorAll('legend')).map(node=>node.textContent)).toEqual(['Region (Region)']);
 expect(targetFieldSelect().options.length).toBeLessThanOrEqual(mappingPageSizes.choices+2);
 await select(targetFieldSelect(),ctx.studies[1].fields[0].id);
 expect(categorySelects()).toHaveLength(mappingPageSizes.categories);
 expect(document.querySelectorAll('option').length).toBeLessThan(350);
 const scans=scan.mock.calls.length;
 await search('Search target categories','Tail answer');
 await select(categorySelects()[0],'Code 1999');
 await search('Search target categories','Code 000');
 expect(categorySelects()[0].value).toBe('Code 1999');expect(categorySelects()[0].selectedOptions[0].textContent).toContain('Tail answer');
 await click('Next source categories');expect(categorySelects()[0].getAttribute('aria-label')).toContain('Code 0010');
 await search('Search source categories','Tail answer');expect(categorySelects()).toHaveLength(1);expect(categorySelects()[0].getAttribute('aria-label')).toContain('Code 1999');
 expect(scan.mock.calls.length).toBe(scans);
 await search('Search target fields','Unused 599');expect(Array.from(targetFieldSelect().options).some(option=>option.value==='unused-599')).toBe(true);
 expect(document.querySelectorAll('option').length).toBeLessThan(350);expect(JSON.stringify(ctx)).toBe(before);
});
it('only offers referenced grouping, measure, banner and filter fields, skipping synthetic overall grouping',async()=>{
 const ctx=await fixture('sum'),identity=ctx.draft.pages[0].tiles[0].query.sourceIdentity;
 if(identity?.kind!=='imported')throw Error('fixture');identity.bannerFieldId=ctx.studies[0].fields[2].id;identity.filterFieldId=ctx.studies[0].fields[0].id;
 expect(mappingModel.referencedWaveFields(ctx.draft,ctx.studies[0]).map(field=>field.sourceColumn)).toEqual(['Region','Amount','Banner']);
 identity.groupingScope='all_respondents';delete identity.filterFieldId;
 expect(mappingModel.referencedWaveFields(ctx.draft,ctx.studies[0]).map(field=>field.sourceColumn)).toEqual(['Amount','Banner']);
});
it('navigates only referenced fields and starts each previously unmapped reference blank',async()=>{
 const ctx=await fixture('sum');await mount(ctx);expect(document.querySelector('legend')!.textContent).toContain('Region');
 await select(targetFieldSelect(),ctx.studies[1].fields[0].id);
 await click('Next referenced fields');expect(document.querySelector('legend')!.textContent).toContain('Amount');expect(targetFieldSelect().value).toBe('');expect(categorySelects()).toHaveLength(0);
 await click('Previous referenced fields');expect(targetFieldSelect().value).toBe(ctx.studies[1].fields[0].id);
});
it.each(['add source field','remove target field','change target schema','change source rows','change report reference','replace source'] as const)('invalidates mappings synchronously after %s, without changing authored data',async mutation=>{
 const ctx=await fixture(),{render,onCreate}=await mount(ctx);
 await select(targetFieldSelect(),ctx.studies[1].fields[0].id);
 if(mutation==='add source field')ctx.studies[0].fields.push({...ctx.studies[0].fields[1],id:'added',sourceColumn:'Extra'});
 if(mutation==='remove target field')ctx.studies[1].fields.shift();
 if(mutation==='change target schema')ctx.studies[1].fields[0].type='numeric';
 if(mutation==='change source rows')ctx.studies[0].rows[0].Region='New answer';
 if(mutation==='change report reference'){const identity=ctx.draft.pages[0].tiles[0].query.sourceIdentity;if(identity?.kind==='imported')identity.primaryFieldId=ctx.studies[0].fields[2].id;}
 if(mutation==='replace source')ctx.studies[0].id='replacement';
 const before=JSON.stringify(ctx);await render();expect(document.querySelectorAll('fieldset')).toHaveLength(0);expect(document.body.textContent).toContain('stale');
 await click('Preview all analyses');expect(document.querySelector('input[type="checkbox"]')).toBeNull();await click('Create reviewed draft copy');expect(onCreate).not.toHaveBeenCalled();
 if(mutation!=='replace source'){
   await click('Edit field and category mappings');expect(targetFieldSelect().value).toBe('');
   if(mutation==='change report reference')expect(document.querySelector('legend')!.textContent).toContain('Banner');
   if(mutation==='change source rows')expect(categorySelects().some(node=>node.getAttribute('aria-label')?.includes('New answer'))).toBe(true);
 }
 expect(JSON.stringify(ctx)).toBe(before);
});
it('explains a removed referenced source field instead of crashing or substituting another field',async()=>{
 const ctx=await fixture(),{render,onCreate}=await mount(ctx);ctx.studies[0].fields.shift();await render();
 expect(document.body.textContent).toContain('missing or ambiguous');expect(document.querySelector('fieldset')).toBeNull();await click('Preview all analyses');await click('Create reviewed draft copy');expect(onCreate).not.toHaveBeenCalled();
});
it('invalidates a confirmed preview immediately on a target schema change',async()=>{
 const ctx=await fixture();ctx.studies[1].rows=ctx.studies[1].rows.map(row=>({...row,Region:row.Region==='East'?'South':row.Region}));
 const{render,onCreate}=await mount(ctx);await select(targetFieldSelect(),ctx.studies[1].fields[0].id);
 for(const raw of ['North','South'])await select(document.querySelector<HTMLSelectElement>(`select[aria-label="Target category for Region: ${raw}"]`)!,raw);
 await click('Preview all analyses');for(let i=0;i<100&&!document.querySelector('input[type="checkbox"]');i++)await act(async()=>new Promise(resolve=>setTimeout(resolve,5)));
 expect(document.querySelector('input[type="checkbox"]')).not.toBeNull();await act(async()=>document.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
 ctx.studies[1].fields[0].valueLabels={North:'Renamed North'};await render();expect(document.querySelector('input[type="checkbox"]')).toBeNull();await click('Create reviewed draft copy');expect(onCreate).not.toHaveBeenCalled();
});
it('bounds the reviewed mapping list as well as the editor',async()=>{
 const categories=Array.from({length:2000},(_,i)=>({source:`Old ${i}`,target:`New ${i}`}));await act(async()=>root.render(<MappingCategoryReview categories={categories}/>));
 expect(document.querySelectorAll('li')).toHaveLength(mappingPageSizes.review);await click('Next reviewed categories');expect(document.body.textContent).toContain('Old 50');
 await search('Search reviewed categories','Old 1999');expect(document.querySelectorAll('li')).toHaveLength(1);expect(document.body.textContent).toContain('Old 1999 → New 1999');
});

it('renders a missing mapping entry as explicitly unmapped',async()=>{
 const ctx=await fixture(),onUpdate=vi.fn(),[source,target]=ctx.studies;
 await act(async()=>root.render(<ReportMappingPanel source={source} target={target} fields={[source.fields[0]]} mappings={[]} binding="synthetic" busy={false} onEdit={()=>{}} onUpdate={onUpdate}/>));
 expect(targetFieldSelect().value).toBe('');await select(targetFieldSelect(),target.fields[0].id);
 expect(onUpdate).toHaveBeenCalledExactlyOnceWith({sourceFieldId:source.fields[0].id,targetFieldId:target.fields[0].id,categories:[]});
});
it('contains ambiguous category inspection errors instead of crashing the mapping panel',async()=>{
 const ctx=await fixture();ctx.studies[0].fields[0].sourceColumn='REGION';ctx.studies[0].rows[0]={Region:'North',region:'South'};
 await mount(ctx);expect(document.body.textContent).toContain('Category choices are unavailable');expect(categorySelects()).toHaveLength(0);
});
