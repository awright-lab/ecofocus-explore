// @vitest-environment jsdom
import { act,useRef } from "react";
import { createRoot,type Root } from "react-dom/client";
import { beforeEach,afterEach,it,expect,vi } from "vitest";
import { NarrativeEvidencePanel } from "../NarrativeEvidencePanel";
import { narrativeState } from "../narrativeEvidence";
import { CanvasElementRenderer } from "../../builder/components/CanvasRenderers";
import { useDocumentCommandState } from "../../builder/hooks/useDocumentCommandState";
import { createCanvasElement } from "../../builder/builderDocumentCommands";
import { initialDashboard } from "../../document/documentSeeds";
import type { DashboardDraft } from "../../../../shared/types/dashboard";

let host:HTMLDivElement,root:Root,draft:DashboardDraft;
let navigate=vi.fn<(tileId:string)=>void>();
beforeEach(()=>{vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);host=document.createElement("div");document.body.append(host);root=createRoot(host);navigate=vi.fn<(tileId:string)=>void>();});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});
async function setup(){
 const initial=structuredClone(initialDashboard),page=initial.pages[0];page.tiles=[page.tiles[0]];page.tiles[0].id="source";page.tiles[0].query=page.tiles[0].result.query;page.elements=[];
 const notes=structuredClone(page);notes.id="notes";notes.title="Conclusions";notes.tiles=[];const element=createCanvasElement("text",notes);element.id="claim";element.content="An editable claim about the recorded result.";notes.elements=[element];initial.pages.push(notes);
 function Harness(){
  const [document,commit]=useDocumentCommandState(initial),past=useRef<DashboardDraft[]>([]),future=useRef<DashboardDraft[]>([]);draft=document;
  const note=document.pages[1].elements[0],state=narrativeState(note,document.pages);
  const change=(update:(current:DashboardDraft)=>DashboardDraft)=>commit(update,(previous)=>{past.current.push(previous);future.current=[];});
  return <><button onClick={()=>change(current=>({...current,pages:current.pages.map((page,index)=>index===0?{...page,tiles:page.tiles.map(tile=>({...tile,result:{...tile.result,table:tile.result.table.map((row,n)=>n===0?{...row,values:{...row.values,[tile.result.columns[0].id]:row.values[tile.result.columns[0].id]+1}}:row)}}))}:page)}))}>Change recorded source</button>
   <button onClick={()=>change(current=>({...current,pages:current.pages.map((page,index)=>index===0?{...page,tiles:[]}:page)}))}>Delete source</button>
   <button onClick={()=>{const previous=past.current.pop();if(previous){future.current.push(document);commit(previous);}}}>Undo</button>
   <button onClick={()=>{const next=future.current.pop();if(next){past.current.push(document);commit(next);}}}>Redo</button>
   <button onClick={()=>change(current=>({...current,pages:current.pages.map((page,index)=>index===1?{...page,elements:page.elements.map(item=>({...item,content:"The author changed this claim."}))}:page)}))}>Edit written claim</button>
   <CanvasElementRenderer element={note} selected={false} onSelect={()=>{}} evidenceWarning={state&&!state.current?state.reasons.join(" "):null}/>
   <NarrativeEvidencePanel element={note} pages={document.pages} onNavigate={navigate} onUpdate={updates=>change(current=>({...current,pages:current.pages.map((page,index)=>index===1?{...page,elements:page.elements.map(item=>item.id===note.id?{...item,...updates}:item)}:page)}))}/>
  </>;
 }
 await act(async()=>root.render(<Harness/>));
}
function button(text:string){const b=Array.from(host.querySelectorAll("button")).find(item=>item.textContent===text);expect(b,text).toBeTruthy();return b!;}
async function click(text:string){await act(async()=>button(text).click());}
it("links a source, flags changed values despite an unchanged text object reference, reviews explicitly and supports Undo/Redo",async()=>{
 await setup();const text=draft.pages[1].elements[0].content;await click("Link cell and record review");expect(draft.pages[1].elements[0].evidence?.links).toHaveLength(1);expect(host.textContent).toContain("Linked evidence unchanged");
 const oldValue=draft.pages[1].elements[0].evidence!.links[0].snapshot.value,originalNote=draft.pages[1].elements[0];await click("Change recorded source");expect(draft.pages[1].elements[0]).toBe(originalNote);expect(host.querySelector('.narrative-review-badge')?.textContent).toContain("Evidence needs review");expect(draft.pages[1].elements[0].evidence!.links[0].snapshot.value).toBe(oldValue);
 await click("I reviewed the claim and current linked results");expect(host.querySelector('.narrative-review-badge')).toBeNull();expect(draft.pages[1].elements[0].content).toBe(text);expect(draft.pages[1].elements[0].evidence!.links[0].snapshot.value).toBe(oldValue+1);
 await click("Undo");expect(host.querySelector('.narrative-review-badge')).toBeTruthy();await click("Redo");expect(host.querySelector('.narrative-review-badge')).toBeNull();
});
it("preserves orphaned evidence and changed text until explicit review or unlink, and navigates to its source",async()=>{
 await setup();await click("Link cell and record review");await click("Open source 1");expect(navigate).toHaveBeenCalledWith("source");const evidence=structuredClone(draft.pages[1].elements[0].evidence);
 await click("Edit written claim");expect(host.textContent).toContain("written claim changed");await click("Delete source");await click("I reviewed the claim and current linked results");expect(host.textContent).toContain("missing or ambiguous");expect(draft.pages[1].elements[0].evidence).toEqual(evidence);
 await click("Remove evidence link 1");expect(draft.pages[1].elements[0].evidence).toBeUndefined();expect(draft.pages[1].elements[0].content).toBe("The author changed this claim.");await click("Undo");expect(draft.pages[1].elements[0].evidence).toEqual(evidence);
});
it("rejects duplicate links without losing prior reviewed evidence",async()=>{
 await setup();await click("Link cell and record review");const evidence=structuredClone(draft.pages[1].elements[0].evidence);await click("Link cell and record review");expect(host.textContent).toContain("duplicate source cells");expect(draft.pages[1].elements[0].evidence).toEqual(evidence);
});
