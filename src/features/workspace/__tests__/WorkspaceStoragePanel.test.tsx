// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { WorkspaceStoragePanel } from "../WorkspaceStoragePanel";
import { initialDashboard } from "../../document/documentSeeds";
import * as persistence from "../../document/workspacePersistence";

beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function workspace() { return persistence.normalizeDashboardWorkspace({ reports: [persistence.createReportRecord(structuredClone(initialDashboard))] }); }
async function renderPanel(value = workspace()) { const host = document.createElement("div"); document.body.append(host); const root = createRoot(host); await act(async () => root.render(<WorkspaceStoragePanel workspace={value} />)); return { host, root, close: async () => { await act(async () => root.unmount()); host.remove(); } }; }
it("waits for an explicit measurement and never writes browser storage", async () => {
  const measure = vi.spyOn(persistence, "measureWorkspaceStorage"), write = vi.spyOn(Storage.prototype, "setItem"); const panel = await renderPanel();
  try { expect(measure).not.toHaveBeenCalled(); await act(async () => panel.host.querySelector("button")!.click()); expect(measure).toHaveBeenCalledOnce(); expect(panel.host.textContent).toContain("No saved copy"); expect(panel.host.textContent).toContain("No imported study copies"); expect(panel.host.textContent).toContain("do not show remaining capacity"); expect(write).not.toHaveBeenCalled(); } finally { await panel.close(); }
});
it("shows a blocked saved-text read without hiding the current estimate as zero", async () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Read blocked"); }); const panel = await renderPanel();
  try { await act(async () => panel.host.querySelector("button")!.click()); expect(panel.host.querySelector('[role="alert"]')?.textContent).toContain("Browser storage could not be read"); expect(panel.host.textContent).toContain("Unavailable"); expect(panel.host.textContent).not.toContain("No saved copy"); expect(panel.host.querySelector("dd")?.textContent).not.toBe("0 B"); } finally { await panel.close(); }
});
it("marks a measured snapshot stale after edits and refreshes from the latest workspace", async () => {
  const value = workspace(), panel = await renderPanel(value);
  try { await act(async () => panel.host.querySelector("button")!.click()); await act(async () => panel.root.render(<WorkspaceStoragePanel workspace={{ ...value, label: "Updated" }} />)); expect(panel.host.querySelector('[role="status"]')?.textContent).toContain("workspace changed"); await act(async () => panel.host.querySelector("button")!.click()); expect(panel.host.querySelector('[role="status"]')).toBeNull(); } finally { await panel.close(); }
});
it("reports measurement failure without retaining a previous successful-looking result", async () => {
  const measure = vi.spyOn(persistence, "measureWorkspaceStorage"); const panel = await renderPanel();
  try { await act(async () => panel.host.querySelector("button")!.click()); measure.mockImplementation(() => { throw new Error("Synthetic failure"); }); await act(async () => panel.host.querySelector("button")!.click()); expect(panel.host.querySelector('[role="alert"]')?.textContent).toContain("could not be measured"); expect(panel.host.querySelector("dl")).toBeNull(); } finally { await panel.close(); }
});
