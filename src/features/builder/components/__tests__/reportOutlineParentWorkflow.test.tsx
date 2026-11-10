// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from '../../../../App';
import { initialDashboard } from '../../../document/documentSeeds';
import { importDatasetBuffer } from '../../../data/datasetImportModel';
import { createReportRecord, loadDashboardWorkspace, normalizeDashboardWorkspace, saveDashboardWorkspace } from '../../../document/workspacePersistence';
import { workspaceSaveSession } from '../../../document/workspaceSaveSession';

let host: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('fetch', vi.fn());
  localStorage.clear(); sessionStorage.clear(); workspaceSaveSession.remember(null);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); workspaceSaveSession.remember(null); localStorage.clear(); sessionStorage.clear(); vi.unstubAllGlobals(); });
function button(label: string) {
  const node = Array.from(document.querySelectorAll('button')).find(node => node.getAttribute('aria-label') === label || node.textContent?.trim() === label);
  if (!node) throw Error(label); return node;
}
async function click(label: string) { await act(async () => button(label).click()); }
async function until(check: () => boolean) { for (let n = 0; n < 300 && !check(); n++) await act(async () => new Promise(resolve => setTimeout(resolve, 10))); expect(check(), document.body.textContent?.slice(0, 800)).toBe(true); }
async function mount() {
  const draft = structuredClone(initialDashboard); draft.id = 'outline-test'; draft.title = 'Synthetic outline';
  const first = draft.pages[0]; first.id = 'first'; first.title = 'Outline first'; first.order = 1; first.tiles = first.tiles.slice(0, 1); first.elements = first.elements.slice(0, 1);
  first.tiles[0].id = 'first-analysis'; first.tiles[0].title = 'First analysis'; first.elements[0].id = 'first-text'; first.elements[0].name = 'First note';
  const second = structuredClone(first); second.id = 'second'; second.title = 'Outline second'; second.order = 2;
  second.tiles[0].id = 'second-analysis'; second.tiles[0].title = 'Second analysis'; second.elements[0].id = 'second-text'; second.elements[0].name = 'Second note';
  draft.pages = [first, second];
  const study = (await importDatasetBuffer(new TextEncoder().encode('Region,Score\nNorth,10\nSouth,20').buffer, 'synthetic-outline.csv')).dataset!;
  expect(saveDashboardWorkspace(normalizeDashboardWorkspace({ reports: [createReportRecord(draft)], importedDatasets: [study] }))).toBe(true);
  const original = structuredClone(loadDashboardWorkspace());
  window.history.replaceState(null, '', '/#/reports/outline-test');
  await act(async () => root.render(<App />)); await until(() => Array.from(document.querySelectorAll('button')).some(node => node.textContent?.trim() === 'Pages'));
  await click('Pages'); await until(() => !!document.querySelector('nav[aria-label="Report pages and objects"]'));
  await click('Show objects on page 1: Outline first'); await click('Show objects on page 2: Outline second');
  return original;
}
async function selectFirst() { await act(async () => document.querySelector<HTMLButtonElement>('.report-page-group.active .report-page-object-select')!.click()); }
const objectCount = () => document.querySelectorAll('.report-page-group.active .report-page-object-select').length;

async function bodyKey(key:string,extra:KeyboardEventInit={}) {
  await act(async()=>{
    const previous=document.body.getAttribute('tabindex');document.body.tabIndex=-1;document.body.focus();
    expect(document.activeElement).toBe(document.body);
    document.body.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true,...extra}));
    if(previous===null)document.body.removeAttribute('tabindex');else document.body.setAttribute('tabindex',previous);
  });
}

it('reproduces the old unscoped sidebar Delete path in the actual App, then Undo restores the original page', async () => {
  await mount(); await selectFirst();
  const panel = document.querySelector<HTMLElement>('aside[aria-label="Report outline"]')!;
  const target = button('Hide objects on page 1: Outline first');
  expect(objectCount()).toBe(2);
  // Isolated negative control removes both nested ownership scopes to model
  // the old unscoped handler. All production commands/state remain real.
  const wrapper = panel.closest<HTMLElement>(".studio-library-slot")!;
  expect(wrapper.getAttribute("data-canvas-keyboard-scope")).toBe("controls");
  try {
    await act(async () => {
      panel.removeAttribute('data-canvas-keyboard-scope'); target.focus();
      target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }));
    });
    expect(objectCount()).toBe(2); // The outer tool-panel guard still protects it.
    await act(async () => {
      wrapper.removeAttribute('data-canvas-keyboard-scope');
      target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }));
    });
    expect(objectCount()).toBe(1);
    await click('Undo'); expect(objectCount()).toBe(2);
  } finally {
    panel.setAttribute('data-canvas-keyboard-scope', 'controls');
    wrapper.setAttribute('data-canvas-keyboard-scope', 'controls');
  }
}, 20_000);

it.each(['Help','Undo','Export','Fit'] as const)('protects focused %s controls while retaining real canvas shortcuts outside controls',async kind=>{
  await mount();await act(async()=>Array.from(document.querySelectorAll<HTMLButtonElement>('.report-page-group.active .report-page-object-select')).find(node=>node.getAttribute('aria-label')?.startsWith('Select analysis First analysis,'))!.click());
  const initialX=loadDashboardWorkspace().reports[0].draft.pages[0].tiles[0].layout.x;
  // A genuine canvas nudge creates history, so Undo is enabled and focusable.
  await bodyKey('ArrowRight');await until(()=>loadDashboardWorkspace().reports[0].draft.pages[0].tiles[0].layout.x!==initialX);
  const before=structuredClone(loadDashboardWorkspace());
  let targets:HTMLElement[]=[];
  if(kind==='Help'||kind==='Undo')targets=[button(kind)];
  if(kind==='Fit')targets=[document.querySelector<HTMLButtonElement>('[title="Fit page to workspace"]')!];
  if(kind==='Export'){
    const menu=document.querySelector<HTMLDetailsElement>('details.export-menu')!;menu.open=true;
    targets=[menu.querySelector('summary')!,...Array.from(menu.querySelectorAll('button'))];
  }
  expect(document.querySelector('[role="dialog"][aria-modal="true"],dialog[open]')).toBeNull();
  for(const target of targets){
    expect(target).toBeTruthy();expect(target.closest('[data-canvas-keyboard-scope="controls"]')).not.toBeNull();
    for(const [key,ctrlKey] of [['Delete',false],['Backspace',false],['ArrowRight',false],['d',true]] as const){
      await act(async()=>{target.focus();expect(document.activeElement).toBe(target);target.dispatchEvent(new KeyboardEvent('keydown',{key,ctrlKey,bubbles:true,cancelable:true}));});
      expect(objectCount()).toBe(2);
    }
  }
  await act(async()=>new Promise(resolve=>setTimeout(resolve,700)));
  expect(loadDashboardWorkspace().reports[0].draft.pages).toEqual(before.reports[0].draft.pages);
  expect(loadDashboardWorkspace().importedDatasets).toEqual(before.importedDatasets);
  // No blanket disabling: global canvas history still handles body-owned keys.
  await bodyKey('z',{ctrlKey:true});await until(()=>loadDashboardWorkspace().reports[0].draft.pages[0].tiles[0].layout.x===initialX);
},25_000);

it.each(['menu','footer'] as const)('keeps focus on an enabled survivor after %s deletion, preserving data through Undo/Redo and reopen',async action=>{
  const original=await mount();await click('Open page 2: Outline second');
  if(action==='menu'){
    const details=document.querySelector<HTMLDetailsElement>('.report-page-group.active details')!;details.open=true;
    await act(async()=>{const target=Array.from(details.querySelectorAll('button')).find(node=>node.textContent==='Delete')!;target.focus();target.click();});
  }else await click('Delete current page');
  expect(document.activeElement).toBe(button('Open page 1: Outline first'));
  expect((document.activeElement as HTMLButtonElement).disabled).toBe(false);
  await until(()=>loadDashboardWorkspace().reports[0].draft.pages.length===1);
  expect(button('Delete current page').disabled).toBe(true);
  expect(loadDashboardWorkspace().importedDatasets).toEqual(original.importedDatasets);
  await click('Undo');await until(()=>loadDashboardWorkspace().reports[0].draft.pages.length===2);
  expect(loadDashboardWorkspace().reports[0].draft.pages).toEqual(original.reports[0].draft.pages);
  await click('Redo');await until(()=>loadDashboardWorkspace().reports[0].draft.pages.length===1);
  const applied=structuredClone(loadDashboardWorkspace());
  await act(async()=>root.unmount());workspaceSaveSession.remember(null);root=createRoot(host);
  await act(async()=>root.render(<App/>));await until(()=>Array.from(document.querySelectorAll('button')).some(node=>node.textContent?.trim()==='Pages'));
  expect(loadDashboardWorkspace().reports[0].draft.pages).toEqual(applied.reports[0].draft.pages);
  expect(loadDashboardWorkspace().importedDatasets).toEqual(original.importedDatasets);
},25_000);

it('moves a page to first position and focuses its enabled page button instead of the now-disabled Move up action',async()=>{
  const original=await mount();const details=document.querySelectorAll<HTMLDetailsElement>('.report-page-group details')[1];details.open=true;
  await act(async()=>{const target=Array.from(details.querySelectorAll('button')).find(node=>node.textContent==='Move up')!;target.focus();target.click();});
  expect(document.activeElement).toBe(button('Open page 1: Outline second'));
  const moved=document.querySelector<HTMLDetailsElement>('.report-page-group.active details')!;
  expect(Array.from(moved.querySelectorAll('button')).find(node=>node.textContent==='Move up')!.disabled).toBe(true);
  await until(()=>loadDashboardWorkspace().reports[0].draft.pages.find(page=>page.id==='second')?.order===1);
  const applied=structuredClone(loadDashboardWorkspace());expect(applied.importedDatasets).toEqual(original.importedDatasets);
  await click('Undo');await until(()=>loadDashboardWorkspace().reports[0].draft.pages.find(page=>page.id==='second')?.order===2);
  await click('Redo');await until(()=>loadDashboardWorkspace().reports[0].draft.pages.find(page=>page.id==='second')?.order===1);
  expect(loadDashboardWorkspace().reports[0].draft.pages).toEqual(applied.reports[0].draft.pages);
},25_000);

it('protects focused sidebars, edits only the active page and preserves exact pages/study through rename, save, Undo/Redo and cold reopen', async () => {
  const original = await mount(); await selectFirst();
  for (const target of [button('Hide objects on page 1: Outline first'), document.querySelector<HTMLButtonElement>('aside[aria-label="Design and insight inspector"] button')!]) {
    expect(target.closest('[data-canvas-keyboard-scope="controls"]')).not.toBeNull();
    for (const event of [new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }), new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }), new KeyboardEvent('keydown', { key: 'd', ctrlKey: true, bubbles: true })]) {
      await act(async () => { target.focus(); target.dispatchEvent(event); }); expect(objectCount()).toBe(2);
    }
  }
  await act(async () => new Promise(resolve => setTimeout(resolve, 700)));
  expect(loadDashboardWorkspace().reports[0].draft.pages).toEqual(original.reports[0].draft.pages);
  const secondGroup = document.querySelectorAll('.report-page-group')[1];
  expect(Array.from(secondGroup.querySelectorAll<HTMLButtonElement>('.report-page-object-actions button')).every(node => node.disabled)).toBe(true);
  await click('Open page 2: Outline second');
  const hide = Array.from(document.querySelectorAll<HTMLButtonElement>('.report-page-group.active .report-page-object-actions button')).find(node => node.getAttribute('aria-label')?.startsWith('Hide analysis'))!;
  await act(async () => hide.click());
  await until(() => loadDashboardWorkspace().reports[0].draft.pages[1].tiles[0].hidden === true);
  const firstAfter = loadDashboardWorkspace().reports[0].draft.pages[0]; expect(firstAfter).toEqual(original.reports[0].draft.pages[0]);
  const details = document.querySelector<HTMLDetailsElement>('.report-page-group.active details')!; details.open = true;
  await act(async () => Array.from(details.querySelectorAll('button')).find(node => node.textContent === 'Rename')!.click());
  const rename = document.querySelector<HTMLInputElement>('[aria-label="Rename page 2: Outline second"]')!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(rename, 'Reviewed page'); rename.dispatchEvent(new Event('input', { bubbles: true })); });
  await act(async () => rename.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
  expect(document.activeElement).toBe(button('Open page 2: Reviewed page'));
  await until(() => loadDashboardWorkspace().reports[0].draft.pages[1].title === 'Reviewed page');
  const applied = structuredClone(loadDashboardWorkspace()); expect(applied.importedDatasets).toEqual(original.importedDatasets);
  await click('Undo'); await until(() => loadDashboardWorkspace().reports[0].draft.pages[1].title === 'Outline second');
  await click('Redo'); await until(() => loadDashboardWorkspace().reports[0].draft.pages[1].title === 'Reviewed page');
  expect(loadDashboardWorkspace().reports[0].draft.pages).toEqual(applied.reports[0].draft.pages);
  await act(async () => root.unmount()); workspaceSaveSession.remember(null); root = createRoot(host);
  await act(async () => root.render(<App />)); await until(() => Array.from(document.querySelectorAll('button')).some(node => node.textContent?.trim() === 'Pages'));
  expect(loadDashboardWorkspace().reports[0].draft.pages).toEqual(applied.reports[0].draft.pages);
  expect(loadDashboardWorkspace().importedDatasets).toEqual(original.importedDatasets);
}, 20_000);
