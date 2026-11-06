// @vitest-environment jsdom
import { act } from "react";
import { createRoot,type Root } from "react-dom/client";
import { afterEach,beforeEach,expect,it,vi } from "vitest";
import FindingFollowUps from "../FindingFollowUps";
import { syntheticStudy } from "../../../document/__tests__/fixtures/syntheticStudy";
import { runImportedDatasetQuery } from "../../../data/importedDatasetAnalytics";
import * as savedQuery from "../../../data/savedImportedQuery";
import { initialDashboard } from "../../../document/documentSeeds";
import type { DashboardTile } from "../../../../../shared/types/dashboard";
let host:HTMLDivElement,root:Root;
beforeEach(()=>{vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);host=document.createElement("div");document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});
async function fixture(){const{dataset}=await syntheticStudy(1000,8),result=runImportedDatasetQuery({dataset,field:dataset.fields[1],metric:"percent_selected",chartType:"table"}),tile:DashboardTile={...structuredClone(initialDashboard.pages[0].tiles[0]),query:result.query,result,source:{kind:"importedField",id:`${dataset.id}:${dataset.fields[1].id}`,datasetId:dataset.id,fieldId:dataset.fields[1].id,label:"Region"}};return{dataset,tile};}
function button(label:string){const node=Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(node=>node.textContent?.trim()===label||node.querySelector("strong")?.textContent===label);expect(node,label).toBeTruthy();return node!;}
async function click(label:string){await act(async()=>button(label).click());}
async function choose(label:string,value:string){const select=Array.from(document.querySelectorAll("label")).find(node=>node.textContent?.startsWith(label))?.querySelector("select");expect(select,label).toBeTruthy();await act(async()=>{select!.value=value;select!.dispatchEvent(new Event("change",{bubbles:true}));});}
it("reviews the selected finding, previews exact data and requests a separate follow-up without editing the original",async()=>{
 const{dataset,tile}=await fixture(),before=structuredClone(tile),create=vi.fn(async()=>"created");await act(async()=>root.render(<FindingFollowUps tile={tile} studies={[dataset]} onCreate={create}/>));await click("Investigate a finding");const north=tile.result.table.find(row=>row.label==="North")!;await choose("Recorded answer",north.optionId);await click("Does North vary by Segment?");
 expect(document.querySelector('[aria-label="Follow-up analysis plan"]')?.textContent).toContain("Study import:");expect(button("Create follow-up on a new page").disabled).toBe(true);await click("Preview follow-up");expect(document.querySelector('[aria-label="Follow-up result preview"]')?.textContent).toContain("Recorded base 500");expect(button("Create follow-up on a new page").disabled).toBe(false);await click("Create follow-up on a new page");expect(create).toHaveBeenCalledWith(tile.id,north.optionId,"summary",`breakout:${dataset.fields[2].id}`,expect.any(Function));expect(tile).toEqual(before);
});
it("keeps creation disabled after preview failure and preserves all source data",async()=>{
 const{dataset,tile}=await fixture(),before=structuredClone({dataset,tile}),create=vi.fn();vi.spyOn(savedQuery,"runSavedImportedQuery").mockRejectedValue(new Error("Synthetic calculation failure"));await act(async()=>root.render(<FindingFollowUps tile={tile} studies={[dataset]} onCreate={create}/>));await click("Investigate a finding");await click("Does East vary by Segment?");await click("Preview follow-up");expect(document.querySelector('[role="alert"]')?.textContent).toBe("Synthetic calculation failure");expect(button("Create follow-up on a new page").disabled).toBe(true);expect(create).not.toHaveBeenCalled();expect({dataset,tile}).toEqual(before);
});
it("discards a late preview after closing without creating an analysis",async()=>{
 const{dataset,tile}=await fixture(),create=vi.fn();let resolve!:(result:typeof tile.result)=>void;vi.spyOn(savedQuery,"runSavedImportedQuery").mockReturnValue(new Promise(value=>resolve=value));await act(async()=>root.render(<FindingFollowUps tile={tile} studies={[dataset]} onCreate={create}/>));await click("Investigate a finding");await click("Does East vary by Segment?");await click("Preview follow-up");await click("Close");await act(async()=>resolve(tile.result));expect(document.querySelector('[role="dialog"]')).toBeNull();expect(create).not.toHaveBeenCalled();
});
it("invalidates creation ownership immediately when the dialog is closed",async()=>{
 const{dataset,tile}=await fixture();let accepted!:(value:string|null)=>void,owns!:()=>boolean;const create=vi.fn((_:string,__:string,___:string,____:string,isCurrent:()=>boolean)=>{owns=isCurrent;return new Promise<string|null>(resolve=>accepted=resolve);});await act(async()=>root.render(<FindingFollowUps tile={tile} studies={[dataset]} onCreate={create}/>));await click("Investigate a finding");await click("Does East vary by Segment?");await click("Preview follow-up");await click("Create follow-up on a new page");expect(owns()).toBe(true);await click("Close");expect(owns()).toBe(false);await act(async()=>accepted(null));expect(document.querySelector('[role="dialog"]')).toBeNull();
});
it("invalidates the preview after changing the recorded answer",async()=>{
 const{dataset,tile}=await fixture();await act(async()=>root.render(<FindingFollowUps tile={tile} studies={[dataset]} onCreate={async()=>null}/>));await click("Investigate a finding");await click("Does East vary by Segment?");await click("Preview follow-up");await choose("Recorded answer",tile.result.table.find(row=>row.label==="North")!.optionId);expect(document.querySelector('[aria-label="Follow-up result preview"]')).toBeNull();expect(document.body.textContent).toContain("Does North vary by Segment?");
});
it("shows a clear blocked-source explanation instead of suggestions for replacement imports",async()=>{
 const{dataset,tile}=await fixture();await act(async()=>root.render(<FindingFollowUps tile={tile} studies={[{...dataset,importedAt:"2030-01-01T00:00:00.000Z"}]} onCreate={async()=>null}/>));await click("Investigate a finding");expect(document.body.textContent).toContain("replaced");expect(document.querySelector('[aria-label="Suggested follow-up questions"]')?.children).toHaveLength(0);
});
it("reports failed creation without closing the plan or altering the source",async()=>{
 const{dataset,tile}=await fixture(),before=structuredClone(tile);await act(async()=>root.render(<FindingFollowUps tile={tile} studies={[dataset]} onCreate={async()=>null}/>));await click("Investigate a finding");await click("Does East vary by Segment?");await click("Preview follow-up");await click("Create follow-up on a new page");expect(document.querySelector('[role="alert"]')?.textContent).toContain("original analysis is unchanged");expect(document.querySelector('[role="dialog"]')).toBeTruthy();expect(tile).toEqual(before);
});

it("shows preview data-quality warnings before allowing the follow-up to be created",async()=>{const{dataset,tile}=await fixture();vi.spyOn(savedQuery,"runSavedImportedQuery").mockResolvedValue({...tile.result,warnings:["Synthetic warning: some numeric observations were unavailable."]});await act(async()=>root.render(<FindingFollowUps tile={tile} studies={[dataset]} onCreate={async()=>null}/>));await click("Investigate a finding");await click("Does East vary by Segment?");await click("Preview follow-up");expect(document.querySelector('[aria-label="Follow-up data quality notices"]')?.textContent).toContain("numeric observations were unavailable");});
