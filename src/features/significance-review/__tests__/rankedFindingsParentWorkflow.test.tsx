// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect,it,vi } from 'vitest';
import App from '../../../App';
import { findingsFixture } from './rankedFindingsFixture';
import { importDatasetBuffer } from '../../data/datasetImportModel';
import { createReportRecord,loadDashboardWorkspace,normalizeDashboardWorkspace,saveDashboardWorkspace } from '../../document/workspacePersistence';
import { workspaceSaveSession } from '../../document/workspaceSaveSession';
import { probabilityLabel } from '../exactComparisonMath';

async function click(text:string){await act(async()=>{const node=Array.from(document.querySelectorAll('button')).find(node=>node.textContent===text||node.getAttribute('aria-label')===text);if(!node)throw Error(text);node.click();});}
async function until(check:()=>boolean){for(let i=0;i<300&&!check();i++)await act(async()=>new Promise(resolve=>setTimeout(resolve,10)));expect(check(),document.body.textContent?.slice(-1000)).toBe(true);}
async function change(label:string,value:string){await act(async()=>{const node=Array.from(document.querySelectorAll('label')).find(node=>Array.from(node.childNodes).filter(child=>child.nodeType===Node.TEXT_NODE).map(child=>child.textContent).join('')===label)?.querySelector('input,select,textarea') as HTMLInputElement;if(!node)throw Error(label);const proto=node.tagName==='SELECT'?HTMLSelectElement.prototype:node.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value')!.set!.call(node,value);node.dispatchEvent(new Event(node.tagName==='SELECT'?'change':'input',{bubbles:true}));});}
async function code(legend:string,raw:string){await act(async()=>{const fieldset=Array.from(document.querySelectorAll('fieldset')).find(node=>node.querySelector('legend')?.textContent===legend)!;const detail=fieldset.closest('details');if(detail)detail.open=true;const label=Array.from(fieldset.querySelectorAll('label')).find(node=>node.querySelector('small')?.textContent===`Raw: ${JSON.stringify(raw)}`);if(!label)throw Error(raw);label.querySelector<HTMLInputElement>('input')!.click();});}
const cards=()=>Array.from(document.querySelectorAll<HTMLElement>('.ranked-finding-card'));

it('uses actual App reviewed counts for a 1000x30 study, ranks and inspects without changing persisted work, then cold reopens intact',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('ResizeObserver',class{observe(){}unobserve(){}disconnect(){}});vi.stubGlobal('fetch',vi.fn());
 const descriptors=[['showModal',HTMLDialogElement.prototype],['close',HTMLDialogElement.prototype],['scrollIntoView',HTMLElement.prototype]]as const;
 const savedDescriptors=descriptors.map(([key,prototype])=>({key,prototype,descriptor:Object.getOwnPropertyDescriptor(prototype,key)}));
 Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(this:HTMLDialogElement){this.setAttribute('open','');}});Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value:function(this:HTMLDialogElement){this.removeAttribute('open');}});Object.defineProperty(HTMLElement.prototype,'scrollIntoView',{configurable:true,value:vi.fn()});
 const {ctx,result:expected}=await findingsFixture([{code:'Ref',events:125,others:125},{code:'A',events:200,others:50},{code:'B',events:175,others:75},{code:'C',events:225,others:25}]);
 const extra=Array.from({length:27},(_,i)=>`Extra_${i}`),csv=[['ID','Group','Outcome',...extra].join(','),...ctx.studies[0].rows.map((row,index)=>[row.ID,row.Group,row.Outcome,...extra.map((_,column)=>String((index+column)%7))].join(','))].join('\n');
 const {dataset}=await importDatasetBuffer(new TextEncoder().encode(csv).buffer,'synthetic-ranked-1000x30.csv');if(!dataset)throw Error('fixture');
 for(const field of dataset.fields.slice(1,3)){field.type='categorical';field.modelingRole='candidate_dimension';}dataset.fields[2].valueLabels={Y:'Event',N:'Other',DK:'Exclude'};
 ctx.draft.importedDatasets=[dataset];
 localStorage.clear();sessionStorage.clear();workspaceSaveSession.remember(null);window.history.replaceState(null,'',`/#/reports/${ctx.draft.id}`);
 expect(saveDashboardWorkspace(normalizeDashboardWorkspace({reports:[createReportRecord(ctx.draft)],importedDatasets:[dataset]}))).toBe(true);
 const original=structuredClone(loadDashboardWorkspace()),host=document.createElement('div');document.body.append(host);let root=createRoot(host);
 try{
  await act(async()=>root.render(<App/>));await until(()=>!!Array.from(document.querySelectorAll('button')).find(node=>node.getAttribute('aria-label')==='Find a tool'));
  await click('Find a tool');await until(()=>!!document.getElementById('command-comparison-review'));await act(async()=>document.getElementById('command-comparison-review')!.click());await until(()=>!!document.querySelector('.comparison-review-dialog'));
  await change('Research question','Which selected groups differ?');await change('Comparison study',dataset.id);await change('Respondent ID field',dataset.fields[0].id);await change('Group field',dataset.fields[1].id);await change('Outcome field',dataset.fields[2].id);await change('Reference group','Ref');for(const target of ['A','B','C'])await code('Comparison groups',target);await code('Event response codes','Y');await code('Excluded outcome codes','DK');await change('Sampling design','unweighted_independent');await change('Sampling and research note','Synthetic independent unweighted single-choice respondents and a reviewed three-comparison family.');
  await act(async()=>Array.from(document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).find(node=>node.parentElement?.textContent?.startsWith('I reviewed the sampling assumptions'))!.click());await click('Run reviewed comparisons');await until(()=>cards().length===3);
  expect(cards().map(card=>card.getAttribute('aria-label'))).toEqual(['Finding for "C"','Finding for "A"','Finding for "B"']);
  const table=document.querySelector('[aria-label="Exact comparison results"]')!.textContent;expect(table).toContain('200 / 250');expect(table).toContain(probabilityLabel(expected.comparisons[0].adjustedLogP));
  const priorities=Array.from(document.querySelectorAll('fieldset')).find(node=>node.querySelector('legend')?.textContent==='Groups most relevant to your question')!;
  await act(async()=>{priorities.closest('details')!.open=true;Array.from(priorities.querySelectorAll('label')).find(node=>node.textContent?.includes('["B"]'))!.querySelector<HTMLInputElement>('input')!.click();});expect(cards()[0].getAttribute('aria-label')).toBe('Finding for "B"');
  await change('Minimum absolute difference (percentage points)','31');expect(cards()).toHaveLength(1);expect(cards()[0].getAttribute('aria-label')).toBe('Finding for "C"');expect(document.querySelector('[aria-label="Exact comparison results"]')!.textContent).toBe(table);
  await change('Minimum absolute difference (percentage points)','5');await click('Review counts for A ["A"]');
  const detail=Array.from(document.querySelectorAll<HTMLDetailsElement>('details[data-comparison-code]')).find(node=>node.dataset.comparisonCode==='A')!;expect(detail.open).toBe(true);expect(document.activeElement).toBe(detail.querySelector('summary'));expect(detail.textContent).toContain('250 chosen-group source rows');
  expect(loadDashboardWorkspace().importedDatasets).toEqual(original.importedDatasets);expect(loadDashboardWorkspace().reports.map(report=>report.draft)).toEqual(original.reports.map(report=>report.draft));expect(workspaceSaveSession.hasPending()).toBe(false);
  await click('Close group review');await click('Discard temporary review and close');
  await act(async()=>root.unmount());workspaceSaveSession.remember(null);root=createRoot(host);await act(async()=>root.render(<App/>));await until(()=>!!Array.from(document.querySelectorAll('button')).find(node=>node.getAttribute('aria-label')==='Find a tool'));
  expect(document.querySelector('.ranked-findings')).toBeNull();expect(loadDashboardWorkspace().importedDatasets).toEqual(original.importedDatasets);expect(loadDashboardWorkspace().reports.map(report=>report.draft)).toEqual(original.reports.map(report=>report.draft));
 }finally{await act(async()=>root.unmount());host.remove();workspaceSaveSession.remember(null);localStorage.clear();sessionStorage.clear();for(const{key,prototype,descriptor}of savedDescriptors){if(descriptor)Object.defineProperty(prototype,key,descriptor);else delete(prototype as unknown as Record<string,unknown>)[key];}vi.unstubAllGlobals();}
},30_000);
