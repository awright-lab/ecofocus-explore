// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { StudyRemovalButton } from "../StudyRemovalButton";
let host:HTMLDivElement,root:ReturnType<typeof createRoot>;
beforeEach(()=>{vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);host=document.createElement("div");document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});
it("describes stored-row removal honestly and leaves cancellation untouched",async()=>{
 const remove=vi.fn(()=>null),confirm=vi.spyOn(window,"confirm").mockReturnValue(false);await act(async()=>root.render(<StudyRemovalButton title="Synthetic" onRemove={remove}/>));await act(async()=>host.querySelector("button")!.click());
 expect(confirm.mock.calls[0][0]).toContain("stored rows");expect(confirm.mock.calls[0][0]).toContain("backup");expect(remove).not.toHaveBeenCalled();
});
it("keeps an actionable inline dependency error and allows retry",async()=>{
 vi.spyOn(window,"confirm").mockReturnValue(true);const remove=vi.fn().mockReturnValueOnce("Used by Report A. Its data has been kept.").mockReturnValueOnce(null);
 await act(async()=>root.render(<StudyRemovalButton title="Synthetic" onRemove={remove}/>));await act(async()=>host.querySelector("button")!.click());expect(host.querySelector('[role="alert"]')?.textContent).toContain("Report A");
 await act(async()=>host.querySelector("button")!.click());expect(host.querySelector('[role="alert"]')).toBeNull();expect(remove).toHaveBeenCalledTimes(2);
});
it("surfaces a storage failure without reporting successful removal",async()=>{
 vi.spyOn(window,"confirm").mockReturnValue(true);await act(async()=>root.render(<StudyRemovalButton title="Synthetic" onRemove={()=>"Could not save; keep this tab open and retry."}/>));await act(async()=>host.querySelector("button")!.click());expect(host.querySelector('[role="alert"]')?.textContent).toContain("Could not save");
});
