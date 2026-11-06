// @vitest-environment jsdom
import { act,useState } from "react";
import { createRoot,type Root } from "react-dom/client";
import { beforeEach,afterEach,it,expect,vi } from "vitest";
import { AudienceControl } from "../AudienceControl";
import { useDocumentCommandState } from "../../builder/hooks/useDocumentCommandState";
import { initialDashboard } from "../../document/documentSeeds";
import { importDatasetBuffer } from "../../data/datasetImportModel";
import { runImportedDatasetQuery } from "../../data/importedDatasetAnalytics";
import * as runtime from "../../data/importedDatasetRuntimeQuery";
import type { DashboardDraft, ImportedDatasetRecord } from "../../../../shared/types/dashboard";
let host:HTMLDivElement,root:Root,draft:DashboardDraft,setSelection:(value:string)=>void,replaceStudy:(value:ImportedDatasetRecord)=>void;
beforeEach(()=>{vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);host=document.createElement("div");document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});
async function setup(sharedOnly=false){const {dataset}=await importDatasetBuffer(new TextEncoder().encode("Answer,Region,Spend\nYes,North,10\nNo,South,20\nYes,North,30\n").buffer,"synthetic-audience-ui.csv");const data=dataset!,result=runImportedDatasetQuery({dataset:data,field:data.fields[0],metric:"count",chartType:"table"}),initial=structuredClone(initialDashboard);initial.importedDatasets=sharedOnly?[]:[data];initial.savedAudiences=[];initial.pages[0].tiles=[{...initial.pages[0].tiles[0],id:"target",query:result.query,result,visualization:"table"}];
 function Harness(){const [document,commit]=useDocumentCommandState(initial),[selection,change]=useState("target"),[study,setStudy]=useState(data);draft=document;setSelection=change;replaceStudy=setStudy;return <AudienceControl dashboard={document} importedDatasets={[study]} selectedTileId={selection} onChange={commit}/>;}
 await act(async()=>root.render(<Harness/>));return {data,original:structuredClone(initial)};
}
function button(text:string){const b=Array.from(host.querySelectorAll("button")).find(b=>b.textContent===text);expect(b,text).toBeTruthy();return b!;}
async function click(text:string){await act(async()=>button(text).click());}
function control(text:string){const label=Array.from(host.querySelectorAll("label")).find(label=>label.textContent?.startsWith(text));expect(label,text).toBeTruthy();return label!.querySelector("select,input")!;}
async function choose(text:string,values:string|string[]){if(Array.isArray(values)){const group=host.querySelector(`[aria-label="${text}"]`)!;expect(group,text).toBeTruthy();await act(async()=>{for(const input of group.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'))if(input.checked!==values.includes(input.value))input.click();});return;}const select=control(text) as HTMLSelectElement;await act(async()=>{select.value=values;select.dispatchEvent(new Event("change",{bubbles:true}));});}
async function ready(sharedOnly=false){const {data,original}=await setup(sharedOnly);await click("Audiences");await choose("Field for rule 1.1",data.fields[1].id);await choose("Values for rule 1.1",["North"]);await click("Preview audience");await act(async()=>{await new Promise(resolve=>setTimeout(resolve,15));});return {data,original};}
it("previews exact n, saves and applies, then edits the reusable definition without silently rewriting its result",async()=>{
 const {data,original}=await ready();expect(host.textContent).toContain("2 matching responses");expect(draft).toEqual(original);await click("Save and apply audience");expect(draft.savedAudiences).toHaveLength(1);const applied=structuredClone(draft.pages[0].tiles[0]);expect(applied.result.table.map(row=>row.values.summary)).toEqual([2]);
 await choose("Values for rule 1.1",["South"]);expect(button("Save audience").disabled).toBe(true);await click("Preview audience");await act(async()=>{await new Promise(resolve=>setTimeout(resolve,15));});expect(host.textContent).toContain("1 matching responses");await click("Save audience");expect(draft.savedAudiences![0].expression.kind==="group"&&draft.savedAudiences![0].expression.children[0]).toMatchObject({values:["South"]});expect(draft.pages[0].tiles[0]).toEqual(applied);expect(draft.importedDatasets[0]).toEqual(data);
});
it("retains the result and library when application fails",async()=>{
 const {original}=await ready();vi.spyOn(runtime,"runImportedDatasetQueryForRuntime").mockRejectedValueOnce(new Error("Synthetic audience query failed"));await click("Save and apply audience");expect(host.textContent).toContain("Synthetic audience query failed");expect(draft).toEqual(original);
});
it("discards an application after selection changes while its query is pending",async()=>{
 const {data,original}=await ready();let resolve!:(value:ReturnType<typeof runImportedDatasetQuery>)=>void;
 vi.spyOn(runtime,"runImportedDatasetQueryForRuntime").mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));await click("Save and apply audience");await act(async()=>setSelection("other"));await act(async()=>resolve(runImportedDatasetQuery({dataset:data,field:data.fields[0],metric:"count",chartType:"table"})));expect(host.textContent).toContain("Selection changed");expect(draft).toEqual(original);
});
it("contains keyboard focus and restores the Audiences trigger on Escape",async()=>{
 await setup();button("Audiences").focus();await click("Audiences");const dialog=host.querySelector('[role="dialog"]')!;expect(document.activeElement).toBe(dialog);
 button("Add nested group to 1").focus();const tab=new KeyboardEvent("keydown",{key:"Tab",bubbles:true,cancelable:true});await act(async()=>document.activeElement!.dispatchEvent(tab));expect(tab.defaultPrevented).toBe(true);expect(document.activeElement).toBe(button("Close audiences"));
 await act(async()=>document.activeElement!.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true,cancelable:true})));expect(host.querySelector('[role="dialog"]')).toBeNull();expect(document.activeElement).toBe(button("Audiences"));
});

it("uses the shared study registry when report datasets have been deduplicated",async()=>{await ready(true);expect(host.textContent).toContain("2 matching responses");await click("Save and apply audience");expect(draft.savedAudiences).toHaveLength(1);expect(draft.pages[0].tiles[0].result.table[0].values.summary).toBe(2);expect(draft.importedDatasets).toEqual([]);});

it("removes a reusable entry without deleting recorded rules or study data",async()=>{const {data}=await ready();await click("Save and apply audience");const before=structuredClone(draft.pages[0].tiles[0]);await click("Remove from library");expect(draft.savedAudiences).toEqual([]);expect(draft.pages[0].tiles[0]).toEqual(before);expect(draft.importedDatasets[0]).toEqual(data);expect(host.textContent).toContain("Existing analyses retain their recorded rules");});

it("does not rebind a saved audience when its study ID is reused by a replacement import",async()=>{
 const {data}=await ready();await click("Save audience");const saved=structuredClone(draft.savedAudiences![0]);await click("Close audiences");
 await act(async()=>replaceStudy({...data,importedAt:"replacement-import",rows:data.rows.map(row=>({...row,Region:"North"}))}));
 await click("Audiences");await choose("Saved audience",saved.id);
 expect(host.textContent).toContain("different study import");expect(button("Preview audience").disabled).toBe(true);expect(button("Save audience").disabled).toBe(true);expect(button("Save and apply audience").disabled).toBe(true);expect(draft.savedAudiences![0]).toEqual(saved);
 await choose("Saved audience","new");await choose("Field for rule 1.1",data.fields[1].id);await choose("Values for rule 1.1",["North"]);await click("Preview audience");await act(async()=>{await new Promise(resolve=>setTimeout(resolve,15));});
 expect(host.textContent).toContain("3 matching responses");expect(draft.savedAudiences![0]).toEqual(saved);
});

it("invalidates an open audience and its preview when a study version changes",async()=>{
 const {data,original}=await ready();await act(async()=>replaceStudy({...data,importedAt:"replacement-import"}));
 expect(host.textContent).toContain("different study import");expect(host.textContent).not.toContain("2 matching responses");expect(button("Preview audience").disabled).toBe(true);expect(button("Save audience").disabled).toBe(true);expect(button("Save and apply audience").disabled).toBe(true);expect(draft).toEqual(original);
});
