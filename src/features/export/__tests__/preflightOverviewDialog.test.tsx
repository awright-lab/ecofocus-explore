// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { ExportPreflightDialog } from "../ExportPreflightDialog";
import { initialDashboard } from "../../document/documentSeeds";
it("jumps from a report-wide check card to its exact page without exporting or mutating data", async () => {
 vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); const dashboard = structuredClone(initialDashboard); const clean = { ...dashboard.pages[0], id: "clean", title: "Clean", order: 1, tiles: [], elements: [], backgroundMode: "solid" as const }; const bad = { ...structuredClone(clean), id: "bad", title: "Needs attention", order: 2, backgroundMode: "image" as const, backgroundImage: "" }; dashboard.pages = [clean, bad]; const before = JSON.stringify(dashboard), close = vi.fn(), show = vi.fn(); const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
 try { await act(async () => root.render(<ExportPreflightDialog dashboard={dashboard} activePageId="clean" onClose={close} onShowIssue={show}/>));
 const overview = host.querySelector(".preflight-page-overview")!; expect(overview.textContent).toContain("1 page needs attention across 1 recorded check"); const target = overview.querySelector("button")!; await act(async () => { target.focus(); target.click(); });
 expect(host.querySelector("select")!.value).toBe("bad"); expect(host.querySelector(".export-preflight-grid")!.textContent).toContain("background image is missing"); expect(target.getAttribute("aria-pressed")).toBe("true"); expect(document.activeElement).toBe(target); expect(close).not.toHaveBeenCalled(); expect(show).not.toHaveBeenCalled(); expect(JSON.stringify(dashboard)).toBe(before);
 // Removed targets refuse navigation even before a new reference invalidates the existing review snapshot.
 dashboard.pages = [clean]; await act(async () => target.click()); expect(host.querySelector('[role="alert"]')?.textContent).toContain("no longer available"); expect(show).not.toHaveBeenCalled();
 } finally { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); }
});
