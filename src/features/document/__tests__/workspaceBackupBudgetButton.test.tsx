// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { WorkspaceBackupButton } from '../WorkspaceBackupButton';
import { initialDashboard } from '../documentSeeds';
import { createReportRecord, normalizeDashboardWorkspace } from '../workspacePersistence';
import { importDatasetBuffer } from '../../data/datasetImportModel';
import { workspaceSaveSession } from '../workspaceSaveSession';
import { Blob as NodeBlob } from 'node:buffer';

it('reports an over-budget pending workspace without preparing a download or losing pending recovery', async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 const {dataset}=await importDatasetBuffer(new TextEncoder().encode('A\nx').buffer,'synthetic.csv');
 const key='H'.repeat(100_000);dataset!.rows=Array.from({length:6_000},()=>({[key]:'x'}));dataset!.previewRows=[];dataset!.rowCount=6_000;
 const base=normalizeDashboardWorkspace({reports:[createReportRecord(structuredClone(initialDashboard))]});
 const pending={...base,importedDatasets:[dataset!]};workspaceSaveSession.remember(pending);
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const create=vi.fn();const original=Object.getOwnPropertyDescriptor(URL,'createObjectURL');Object.defineProperty(URL,'createObjectURL',{configurable:true,value:create});
 const click=vi.spyOn(HTMLAnchorElement.prototype,'click');
 try {
  await act(async()=>root.render(<WorkspaceBackupButton getWorkspace={()=>base}/>));
  const serialize=vi.spyOn(JSON,'stringify').mockImplementation(()=>{throw Error('Unsafe serialization attempted');});
  try {await act(async()=>host.querySelector('button')!.click());expect(serialize).not.toHaveBeenCalled();}
  finally {serialize.mockRestore();}
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('No backup was generated');
  expect(create).not.toHaveBeenCalled();expect(click).not.toHaveBeenCalled();expect(workspaceSaveSession.getPending()).toBe(pending);expect(dataset!.rows).toHaveLength(6_000);
 } finally {await act(async()=>root.unmount());host.remove();workspaceSaveSession.remember(null);click.mockRestore();if(original)Object.defineProperty(URL,'createObjectURL',original);else delete(URL as unknown as Record<string,unknown>).createObjectURL;vi.unstubAllGlobals();}
});

it('downloads the same complete version-1 payload as a bounded compact envelope without writing storage', async()=>{
 vi.useFakeTimers();vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('Blob',NodeBlob);workspaceSaveSession.remember(null);
 const {dataset}=await importDatasetBuffer(new TextEncoder().encode('A\nx').buffer,'synthetic.csv');
 const workspace=normalizeDashboardWorkspace({reports:[createReportRecord(structuredClone(initialDashboard))],importedDatasets:[dataset!]});
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 let captured:Blob|undefined;
 const descriptors=['createObjectURL','revokeObjectURL'].map(key=>({key,value:Object.getOwnPropertyDescriptor(URL,key)}));
 const create=vi.fn((blob:Blob)=>{captured=blob;return'blob:synthetic-backup';}),revoke=vi.fn();
 Object.defineProperty(URL,'createObjectURL',{configurable:true,value:create});Object.defineProperty(URL,'revokeObjectURL',{configurable:true,value:revoke});
 const click=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{}),write=vi.spyOn(Storage.prototype,'setItem');
 try {
  await act(async()=>root.render(<WorkspaceBackupButton getWorkspace={()=>workspace}/>));
  await act(async()=>host.querySelector('button')!.click());
  expect(create).toHaveBeenCalledOnce();expect(click).toHaveBeenCalledOnce();expect(write).not.toHaveBeenCalled();
  const text=await captured!.text(),backup=JSON.parse(text);expect(text).toBe(JSON.stringify(backup));
  expect(backup.kind).toBe('ecofocus-workspace-backup');expect(backup.version).toBe(1);expect(backup.payload).toBe(JSON.stringify(workspace));
  expect(JSON.parse(backup.payload).importedDatasets[0].rows).toEqual(dataset!.rows);expect(host.querySelector('[role="status"]')?.textContent).toContain('Backup prepared');
  await vi.advanceTimersByTimeAsync(1000);expect(revoke).toHaveBeenCalledWith('blob:synthetic-backup');
 } finally {await act(async()=>root.unmount());host.remove();click.mockRestore();write.mockRestore();for(const{key,value}of descriptors){if(value)Object.defineProperty(URL,key,value);else delete(URL as unknown as Record<string,unknown>)[key];}workspaceSaveSession.remember(null);vi.useRealTimers();vi.unstubAllGlobals();}
});
