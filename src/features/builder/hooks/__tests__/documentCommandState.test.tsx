import { applyReportColorTheme } from "../../../design-system/reportColors";
// @vitest-environment jsdom
import { act, StrictMode, useCallback, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useDocumentCommandState, type DocumentCommandCommit } from "../useDocumentCommandState";
import { useBuilderDocumentSessionCommands } from "../useBuilderDocumentSessionCommands";
import { initialDashboard } from "../../../document/documentSeeds";
import type { DashboardDraft } from "../../../../../shared/types/dashboard";
let host:HTMLDivElement,root:Root,commands:ReturnType<typeof useBuilderDocumentSessionCommands>,replace:DocumentCommandCommit<DashboardDraft>;
let current:DashboardDraft,past:DashboardDraft[],future:DashboardDraft[],saveCalls:string[];
const noop=()=>{};
beforeEach(()=>{vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);host=document.createElement("div");document.body.append(host);root=createRoot(host);saveCalls=[];});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();});
async function setup(){const initial=structuredClone(initialDashboard);
 function Harness(){const [dashboard,commitDashboardChange]=useDocumentCommandState(initial),[history,setHistory]=useState<DashboardDraft[]>([]),[redo,setFuture]=useState<DashboardDraft[]>([]);current=dashboard;past=history;future=redo;replace=commitDashboardChange;
  const onSave=useCallback((value:string)=>{saveCalls.push(value);},[]);
  commands=useBuilderDocumentSessionCommands({dashboard,commitDashboardChange,history,setHistory,future:redo,setFuture,setSaveState:onSave,activePage:dashboard.pages[0],sortedPages:dashboard.pages,pageMasters:[],pageThemes:[],selectedTile:null,selectedElement:null,selectedTileId:null,selectedElementId:null,multiSelectedObjects:[],setActivePageId:noop,setSelectedTileId:noop,setSelectedElementId:noop,setMultiSelectedObjects:noop,setSelectedChartPartId:noop,setSettingsView:noop,setLeftPanelView:noop,setCanvasZoom:noop,setViewerMode:noop});return <output>{dashboard.title}</output>;
 }
 await act(async()=>root.render(<StrictMode><Harness/></StrictMode>));return initial;
}
it.each([1,2,5])("records exactly one history entry per edit and restores %i edits with the same number of Undo/Redo steps",async(count)=>{
 const initial=await setup();for(let n=0;n<count;n++)await act(async()=>commands.renameDashboard(`Changed ${n}`));
 expect(past).toHaveLength(count);expect(saveCalls).toHaveLength(count);
 for(let n=0;n<count;n++)await act(async()=>commands.undo());expect(current).toEqual(initial);expect(past).toHaveLength(0);expect(future).toHaveLength(count);
 for(let n=0;n<count;n++)await act(async()=>commands.redo());expect(current.title).toBe(`Changed ${count-1}`);expect(past).toHaveLength(count);expect(future).toHaveLength(0);
});
it("keeps same-tick edits ordered against the latest document",async()=>{
 const initial=await setup();await act(async()=>{commands.renameDashboard("First");commands.renameDashboard("Second");commands.renameDashboard("Third");});
 expect(current.title).toBe("Third");expect(past.map(value=>value.title)).toEqual([initial.title,"First","Second"]);
 for(let n=0;n<3;n++)await act(async()=>commands.undo());expect(current).toEqual(initial);expect(future).toHaveLength(3);
});
it("executes an updater and its captured object ID exactly once under StrictMode",async()=>{
 await setup();let sequence=0,captured="";const update=vi.fn((value:DashboardDraft)=>{captured=`command_${++sequence}`;return {...value,title:captured};});
 await act(async()=>commands.setDashboard(update));expect(update).toHaveBeenCalledOnce();expect(current.title).toBe(captured);expect(past).toHaveLength(1);expect(saveCalls).toHaveLength(1);
});
it("does not change nonempty Undo/Redo or save status for a rejected update",async()=>{
 await setup();await act(async()=>commands.renameDashboard("First"));await act(async()=>commands.renameDashboard("Second"));await act(async()=>commands.undo());
 const before={current,past,future,saves:[...saveCalls]};await act(async()=>commands.setDashboard(value=>value));expect(current).toBe(before.current);expect(past).toBe(before.past);expect(future).toBe(before.future);expect(saveCalls).toEqual(before.saves);
});
it("sees navigation immediately before a stale callback, even before React rerenders",async()=>{
 const initial=await setup();await act(async()=>commands.renameDashboard("First"));await act(async()=>commands.renameDashboard("Second"));await act(async()=>commands.undo());
 const oldCommands=commands,nextReport={...structuredClone(initial),id:"next_report",title:"Next report"},before={past,future,saves:[...saveCalls]};
 await act(async()=>{replace(nextReport);oldCommands.setDashboard(value=>value.id===initial.id?{...value,title:"Late old response"}:value);});
 expect(current).toBe(nextReport);expect(past).toBe(before.past);expect(future).toBe(before.future);expect(saveCalls).toEqual(before.saves);
});
it("drops the old redo branch only when a new edit actually changes the document",async()=>{
 await setup();await act(async()=>commands.renameDashboard("First"));await act(async()=>commands.renameDashboard("Second"));await act(async()=>commands.undo());expect(future).toHaveLength(1);
 await act(async()=>commands.renameDashboard("Replacement"));expect(current.title).toBe("Replacement");expect(past).toHaveLength(2);expect(future).toHaveLength(0);
});
it("keeps the document and history intact if command calculation throws",async()=>{
 const initial=await setup();await act(async()=>{expect(()=>commands.setDashboard(()=>{throw new Error("Synthetic command failure");})).toThrow("Synthetic command failure");});
 expect(current).toEqual(initial);expect(past).toHaveLength(0);expect(saveCalls).toHaveLength(0);await act(async()=>commands.renameDashboard("Recovery"));expect(past[0]).toEqual(initial);
});

it("reconciles report colors in the real edit command and keeps enable/Undo/Redo atomic", async () => {
 await setup(); const before = current;
 await act(async () => commands.setDashboard(value => applyReportColorTheme(value, ["#112233", "#445566", "#778899"])));
 const themed = current, slots = structuredClone(current.reportColorTheme!.slots); expect(past.at(-1)).toBe(before);
 await act(async () => commands.setDashboard(value => ({ ...value, pages: value.pages.map(page => ({ ...page, tiles: page.tiles.map(tile => ({ ...tile, result: { ...tile.result, table: [...tile.result.table].reverse() } })) })) })));
 expect(current.reportColorTheme!.slots).toEqual(slots);
 await act(async () => commands.undo()); expect(current).toEqual(themed);
 await act(async () => commands.undo()); expect(current).toBe(before); expect(current.reportColorTheme).toBeUndefined();
 await act(async () => commands.redo()); expect(current.reportColorTheme!.slots).toEqual(slots);
});
