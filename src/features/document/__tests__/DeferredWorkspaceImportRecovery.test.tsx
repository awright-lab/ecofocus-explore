// @vitest-environment jsdom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,expect,it,vi,type Mock} from 'vitest';
import {DeferredWorkspaceImportRecovery} from '../DeferredWorkspaceImportRecovery';
import {deferredWorkspaceImports} from '../deferredWorkspaceImports';
import {workspaceSaveSession} from '../workspaceSaveSession';
import {normalizeDashboardWorkspace} from '../workspacePersistence';
import {syntheticStudy} from './fixtures/syntheticStudy';
import type {DashboardWorkspace} from '../../../../shared/types/dashboard';
let host:HTMLDivElement,root:Root,workspace:DashboardWorkspace|null,revision:number,readRevision:()=>number,change:Mock<(next:DashboardWorkspace)=>number>;
beforeEach(()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);localStorage.clear();workspaceSaveSession.remember(null);deferredWorkspaceImports.clear();
 host=document.createElement('div');document.body.append(host);root=createRoot(host);workspace=normalizeDashboardWorkspace(undefined);revision=0;readRevision=()=>revision;
 change=vi.fn((next:DashboardWorkspace)=>{workspace=next;revision++;render();return revision;});
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();deferredWorkspaceImports.clear();workspaceSaveSession.remember(null);localStorage.clear();vi.restoreAllMocks();vi.unstubAllGlobals();});
function render(){root.render(<><button id="outside">Other action</button><DeferredWorkspaceImportRecovery workspace={workspace} onWorkspaceChange={change} getWorkspaceRevision={readRevision}/></>);}
function deferred(){let resolve!:(value:boolean)=>void,reject!:(error:Error)=>void;const promise=new Promise<boolean>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
function button(label:string){const node=Array.from(document.querySelectorAll('button')).find(n=>n.textContent===label);if(!node)throw Error(label);return node;}
async function click(label='Add recovered studies'){await act(async()=>button(label).click());}
async function start(){const{dataset}=await syntheticStudy(100,4);deferredWorkspaceImports.remember(dataset);await act(async()=>render());return dataset;}
function unload(){const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;}
it('keeps the source and close protection until its exact acknowledgement and prevents repeated submits',async()=>{
 const gate=deferred(),save=vi.spyOn(workspaceSaveSession,'saveAsync').mockReturnValue(gate.promise),dataset=await start(),node=button('Add recovered studies');node.focus();
 await act(async()=>{node.click();node.click();});await act(async()=>node.click());expect(save).toHaveBeenCalledOnce();expect(button('Saving recovered studies...').getAttribute('aria-disabled')).toBe('true');expect(deferredWorkspaceImports.getPending()[0]).toBe(dataset);expect(unload()).toBe(true);
 await act(async()=>gate.resolve(true));expect(deferredWorkspaceImports.getPending()).toHaveLength(0);expect(unload()).toBe(false);expect(document.activeElement?.getAttribute('role')).toBe('status');expect(document.activeElement?.textContent).toContain('saved in this browser');
});
it.each(['false','reject']as const)('retains both recovery data and a newer shared pending copy on %s',async mode=>{
 const gate=deferred(),save=vi.spyOn(workspaceSaveSession,'saveAsync').mockReturnValue(gate.promise),dataset=await start();await click();expect(save).toHaveBeenCalledOnce();
 const newer={...workspace!,label:'Newer pending edits'};workspaceSaveSession.remember(newer);
 await act(async()=>{if(mode==='false')gate.resolve(false);else gate.reject(Error('Uncertain response'));});
 expect(deferredWorkspaceImports.getPending()[0]).toBe(dataset);expect(workspaceSaveSession.getPending()).toBe(newer);expect(unload()).toBe(true);expect(button('Add recovered studies').disabled).toBe(false);expect(document.body.textContent).toContain('not');expect(document.body.textContent).not.toContain('Recovered studies saved in this browser.');
 workspaceSaveSession.remember(null);save.mockResolvedValue(true);await click();expect(deferredWorkspaceImports.getPending()).toHaveLength(0);
});
it('acknowledges the captured copy and leaves an import that arrived during the save pending',async()=>{
 const gate=deferred();vi.spyOn(workspaceSaveSession,'saveAsync').mockReturnValue(gate.promise);const dataset=await start();await click();const newer=structuredClone(dataset);newer.id='another-import';newer.sourceRef=undefined;await act(async()=>deferredWorkspaceImports.remember(newer));await act(async()=>gate.resolve(true));expect(deferredWorkspaceImports.getPending()).toEqual([newer]);expect(workspace!.importedDatasets).toHaveLength(1);expect(document.body.textContent).toContain('Additional copies remain');expect(unload()).toBe(true);
});
it('does not clear a different same-ID copy received while the first save is pending',async()=>{
 const gate=deferred(),save=vi.spyOn(workspaceSaveSession,'saveAsync').mockReturnValue(gate.promise),dataset=await start();await click();const newer=structuredClone(dataset);newer.rows[0].Spend='999';await act(async()=>deferredWorkspaceImports.remember(newer));await act(async()=>gate.resolve(true));expect(deferredWorkspaceImports.getPending()).toEqual([newer]);await click();expect(save).toHaveBeenCalledOnce();expect(document.body.textContent).toContain('different data');
});
it.each(['queue','candidate']as const)('retains the original recovery protection when the %s changes in place during a save',async side=>{
 const gate=deferred(),save=vi.spyOn(workspaceSaveSession,'saveAsync').mockReturnValue(gate.promise),dataset=await start(),original=dataset.rows[0].Spend;await click();const target=side==='queue'?dataset:save.mock.calls[0][0].importedDatasets[0];target.rows[0].Spend='999';await act(async()=>gate.resolve(true));expect(deferredWorkspaceImports.getPending()).toHaveLength(1);expect(unload()).toBe(true);if(side==='candidate')expect(dataset.rows[0].Spend).toBe(original);expect(document.body.textContent).not.toContain('Recovered studies saved in this browser.');
});
it.each(['new object','same object revision','new revision reader','other workspace','left Home','unmount']as const)('does not acknowledge stale UI ownership after %s',async mode=>{
 const gate=deferred();vi.spyOn(workspaceSaveSession,'saveAsync').mockReturnValue(gate.promise);const dataset=await start();await click();
 await act(async()=>{if(mode==='new object')workspace={...workspace!,label:'Newer edit'};if(mode==='same object revision')revision++;if(mode==='new revision reader')readRevision=()=>revision+1;if(mode==='other workspace')workspace={...workspace!,id:'other-workspace'};if(mode==='left Home')workspace=null;if(mode==='unmount')root.render(<p>Other route</p>);else render();});
 await act(async()=>gate.resolve(true));expect(deferredWorkspaceImports.getPending()).toEqual([dataset]);expect(change).toHaveBeenCalledOnce();
});
it('keeps data and gives a retryable error when the workspace update fails before writing',async()=>{
 const save=vi.spyOn(workspaceSaveSession,'saveAsync');await start();change.mockImplementation(()=>{throw Error('Update failed');});await click();expect(save).not.toHaveBeenCalled();expect(deferredWorkspaceImports.getPending()).toHaveLength(1);expect(document.body.textContent).toContain('could not be confirmed');expect(button('Add recovered studies').disabled).toBe(false);
});
it.each(['outside','blur']as const)('does not steal %s focus when a successful save removes its button',async mode=>{
 const gate=deferred();vi.spyOn(workspaceSaveSession,'saveAsync').mockReturnValue(gate.promise);await start();const node=button('Add recovered studies');node.focus();await click();if(mode==='outside')document.getElementById('outside')!.focus();else node.blur();const target=document.activeElement;await act(async()=>gate.resolve(true));expect(document.activeElement).toBe(target);
});
