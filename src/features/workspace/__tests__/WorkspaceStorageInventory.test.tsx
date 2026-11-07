// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { WorkspaceStorageInventory } from "../WorkspaceStorageInventory";
import { WorkspaceStoragePanel } from "../WorkspaceStoragePanel";
import * as persistence from "../../document/workspacePersistence";
import { initialDashboard } from "../../document/documentSeeds";
import { importDatasetBuffer } from "../../data/datasetImportModel";
import { workspaceSaveSession } from "../../document/workspaceSaveSession";
type Summary = ReturnType<typeof persistence.measureWorkspaceStorage>;
let shared: Summary, workspace: Parameters<typeof persistence.measureWorkspaceStorage>[0];
beforeAll(async () => {
  const { dataset } = await importDatasetBuffer(new TextEncoder().encode("Region,Spend\nNorth,1\nSouth,3\n").buffer, "synthetic-storage.csv"); if (!dataset) throw Error("fixture");
  const studies = Array.from({ length: 23 }, (_, index) => ({ ...structuredClone(dataset), id: `study-${index}`, title: `Study ${String(index + 1).padStart(2, "0")}`, sourceRef: undefined }));
  const draft = structuredClone(initialDashboard); draft.id = "inventory-report"; draft.pages = draft.pages.slice(0, 1); draft.pages[0].tiles = []; draft.importedDatasets = [];
  workspace = persistence.normalizeDashboardWorkspace({ reports: [persistence.createReportRecord(draft)], importedDatasets: studies });
  for (let index = 0; index < 13; index++) { const next = structuredClone(draft); next.title = `Report ${String(index + 1).padStart(2, "0")}`; next.importedDatasets = [studies[index]]; next.pages[0].backgroundImage = "data:image/png;base64," + "A".repeat(index * 100); const result = persistence.createPublishedSnapshot(workspace, next); result.snapshot.publishedAt = `2026-01-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`; workspace = result.workspace; }
  expect(persistence.saveDashboardWorkspace(workspace)).toBe(true);
  shared = persistence.measureWorkspaceStorage(workspace, localStorage.getItem(persistence.workspaceStorageKey));
});
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });
const copy = () => structuredClone(shared);
async function mount(value = copy(), current = true) {
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  const ui = (summary: Summary, fresh: boolean) => <><button>Outside inventory</button><WorkspaceStorageInventory summary={summary} current={fresh} canReview={summary.matchesSavedCopy} /></>;
  await act(async () => root.render(ui(value, current)));
  return { host, root, value, render: async (next: Summary, fresh = true) => { await act(async () => root.render(ui(next, fresh))); }, close: async () => { await act(async () => root.unmount()); host.remove(); } };
}
function button(host: HTMLElement, label: string) { const found = Array.from(host.querySelectorAll("button")).find(node => node.textContent?.startsWith(label)); if (!found) throw Error(label); return found; }
async function click(host: HTMLElement, label: string) { await act(async () => button(host, label).click()); }
async function query(host: HTMLElement, value: string) { const input = host.querySelector<HTMLInputElement>('input[type="search"]')!; await act(async () => { input.focus(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); }); return input; }
it("renders only ten largest records and preserves the measured summary", async () => { const panel = await mount(), before = structuredClone(panel.value), write = vi.spyOn(Storage.prototype, "setItem"); try { expect(panel.host.querySelectorAll("tbody tr")).toHaveLength(10); expect(panel.host.querySelector("h3")?.textContent).toBe(`Study copies: 1–10 of ${shared.studies.length}`); expect(button(panel.host, "Study copies").getAttribute("aria-pressed")).toBe("true"); expect(write).not.toHaveBeenCalled(); expect(panel.value).toEqual(before); } finally { await panel.close(); } });
it("filters by visible scope and pages through all current studies", async () => { const panel = await mount(); try { await query(panel.host, "  CURRENT STUDY LIBRARY  "); expect(panel.host.querySelector("h3")?.textContent).toContain("of 23"); await click(panel.host, "Next storage records"); expect(panel.host.querySelector("h3")?.textContent).toContain("11–20 of 23"); await click(panel.host, "Next storage records"); expect(panel.host.querySelectorAll("tbody tr")).toHaveLength(3); expect(button(panel.host, "Next storage records").disabled).toBe(true); await click(panel.host, "Previous storage records"); expect(panel.host.querySelector("h3")?.textContent).toContain("11–20 of 23"); } finally { await panel.close(); } });
it("keeps search focus and reports an empty filtered set without hiding controls", async () => { const panel = await mount(); try { const input = await query(panel.host, "No matching synthetic study"); expect(document.activeElement).toBe(input); expect(panel.host.textContent).toContain("No study copies match this search"); expect(panel.host.querySelectorAll("tbody tr")).toHaveLength(0); expect(button(panel.host, "Previous storage records").disabled).toBe(true); expect(button(panel.host, "Next storage records").disabled).toBe(true); await query(panel.host, ""); expect(panel.host.querySelectorAll("tbody tr")).toHaveLength(10); } finally { await panel.close(); } });
it("sorts a fresh array by name without changing source order", async () => { const panel = await mount(), before = structuredClone(panel.value); try { const select = panel.host.querySelector("select")!; await act(async () => { select.focus(); select.value = "name"; select.dispatchEvent(new Event("change", { bubbles: true })); }); expect(panel.host.querySelector("tbody th")?.textContent).toContain("Study 01"); expect(document.activeElement).toBe(select); expect(panel.value).toEqual(before); } finally { await panel.close(); } });
it("shows full snapshot sizes and canonical local links in a bounded second view", async () => { const panel = await mount(); try { await query(panel.host, "Current study library"); await click(panel.host, "Snapshots"); expect(panel.host.querySelector<HTMLInputElement>("input")?.value).toBe(""); expect(panel.host.querySelectorAll("tbody tr")).toHaveLength(10); expect(panel.host.querySelector("h3")?.textContent).toBe("Local snapshots: 1–10 of 13"); const largest = [...panel.value.snapshots].sort((a, b) => b.textBytes - a.textBytes || a.key.localeCompare(b.key))[0], link = panel.host.querySelector("tbody a")!; expect(link.getAttribute("href")).toBe(persistence.makePublishedViewerPath(largest.reportId, largest.snapshotId)); expect(link.getAttribute("aria-label")).toContain(largest.title); expect(panel.host.textContent).toContain("in study copies"); await click(panel.host, "Next storage records"); expect(panel.host.querySelectorAll("tbody tr")).toHaveLength(3); } finally { await panel.close(); } });
it("moves keyboard paging focus to the updated range instead of a disabled next button", async () => { const panel = await mount(); try { await click(panel.host, "Snapshots"); const next = button(panel.host, "Next storage records"); next.focus(); await click(panel.host, "Next storage records"); expect(document.activeElement).toBe(panel.host.querySelector("h3")); expect(next.disabled).toBe(true); expect(panel.host.querySelector("h3")?.textContent).toContain("11–13 of 13"); } finally { await panel.close(); } });
it("returns focus to search when a measured refresh removes the focused version", async () => { const panel = await mount(); try { await click(panel.host, "Snapshots"); await click(panel.host, "Next storage records"); panel.host.querySelector<HTMLElement>("tbody a")!.focus(); const next = copy(); next.snapshots = [next.snapshots[0]]; next.snapshotCount = 1; await panel.render(next); expect(document.activeElement).toBe(panel.host.querySelector("input")); expect(panel.host.querySelector("h3")?.textContent).toBe("Local snapshots: 1–1 of 1"); expect(button(panel.host, "Next storage records").disabled).toBe(true); } finally { await panel.close(); } });
it("disables stale links and recovers the focused disappearing link", async () => { const panel = await mount(); try { await click(panel.host, "Snapshots"); panel.host.querySelector<HTMLElement>("tbody a")!.focus(); await panel.render(panel.value, false); expect(panel.host.querySelector("tbody a")).toBeNull(); expect(panel.host.textContent).toContain("Refresh details to open"); expect(document.activeElement).toBe(panel.host.querySelector("input")); } finally { await panel.close(); } });
it.each(["blur", "outside"])("does not steal deliberately moved focus (%s)", async mode => { const panel = await mount(); try { await click(panel.host, "Snapshots"); const link = panel.host.querySelector<HTMLElement>("tbody a")!; link.focus(); if (mode === "blur") link.blur(); else button(panel.host, "Outside inventory").focus(); const active = document.activeElement; await panel.render(panel.value, false); expect(document.activeElement).toBe(active); } finally { await panel.close(); } });
it("does not link an ambiguous saved identity and does not invent a date", async () => { const value = copy(); value.snapshots = [{ ...value.snapshots[0], canOpen: false, publishedAt: "invalid" }]; value.snapshotCount = 1; const panel = await mount(value); try { await click(panel.host, "Snapshots"); expect(panel.host.querySelector("tbody a")).toBeNull(); expect(panel.host.textContent).toContain("Version link unavailable"); expect(panel.host.textContent).toContain("Date unavailable"); } finally { await panel.close(); } });
it("keeps unsaved records inspectable but disables version links until acknowledged", async () => { const value = copy(); value.matchesSavedCopy = false; const panel = await mount(value); try { await click(panel.host, "Snapshots"); expect(panel.host.querySelectorAll("tbody tr")).toHaveLength(10); expect(panel.host.querySelector("tbody a")).toBeNull(); expect(panel.host.textContent).toContain("Save or retry before opening"); value.matchesSavedCopy = true; await panel.render({ ...value }); expect(panel.host.querySelector("tbody a")).not.toBeNull(); } finally { await panel.close(); } });
it("uses encoded local identity components rather than a supplied destination", async () => { const value = copy(); value.snapshots = [{ ...value.snapshots[0], reportId: "report /?#%", snapshotId: "version /?#%", localPath: persistence.makePublishedViewerPath("report /?#%", "version /?#%") }]; value.snapshotCount = 1; const panel = await mount(value); try { await click(panel.host, "Snapshots"); expect(panel.host.querySelector("tbody a")?.getAttribute("href")).toBe(persistence.makePublishedViewerPath("report /?#%", "version /?#%")); } finally { await panel.close(); } });
it("browses, filters and sorts after one measurement without reserializing or writing", async () => {
  const measure = vi.spyOn(persistence, "measureWorkspaceStorage"), write = vi.spyOn(Storage.prototype, "setItem"), before = structuredClone(workspace), host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  try { await act(async () => root.render(<WorkspaceStoragePanel workspace={workspace} />)); await click(host, "Measure storage details"); await click(host, "Snapshots"); await query(host, "Report"); await click(host, "Next storage records"); const select = host.querySelector("select")!; await act(async () => { select.value = "name"; select.dispatchEvent(new Event("change", { bubbles: true })); }); expect(measure).toHaveBeenCalledOnce(); expect(write).not.toHaveBeenCalled(); expect(workspace).toEqual(before); } finally { await act(async () => root.unmount()); host.remove(); }
});
it("blocks links during a real failed save and restores them after acknowledged retry", async () => {
  workspaceSaveSession.remember(null); expect(persistence.saveDashboardWorkspace(workspace)).toBe(true);
  const candidate = structuredClone(workspace); candidate.label = "Explicit pending synthetic edit";
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host); let write: ReturnType<typeof vi.spyOn> | undefined;
  try {
    await act(async () => root.render(<WorkspaceStoragePanel workspace={workspace} />)); await click(host, "Measure storage details"); await click(host, "Snapshots"); host.querySelector<HTMLElement>("tbody a")!.focus();
    write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Synthetic quota", "QuotaExceededError"); });
    await act(async () => { expect(workspaceSaveSession.save(candidate)).toBe(false); }); expect(workspaceSaveSession.getPending()).toBe(candidate); expect(host.querySelector("tbody a")).toBeNull(); expect(document.activeElement).toBe(host.querySelector("input"));
    await act(async () => root.render(<WorkspaceStoragePanel workspace={candidate} />)); write.mockClear(); await click(host, "Refresh storage details"); expect(write).not.toHaveBeenCalled(); expect(host.textContent).toContain("Save or retry before opening");
    write.mockRestore(); write = undefined; await act(async () => { expect(workspaceSaveSession.retry()).toBe(true); }); expect(host.querySelector("tbody a")).not.toBeNull(); expect(persistence.loadDashboardWorkspace().label).toBe(candidate.label); expect(workspaceSaveSession.hasPending()).toBe(false);
  } finally { write?.mockRestore(); await act(async () => root.unmount()); host.remove(); workspaceSaveSession.remember(null); }
});
it.each(["inside", "outside"])("measurement failure restores only displaced inventory focus (%s)", async where => {
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host); const measure = vi.spyOn(persistence, "measureWorkspaceStorage");
  try {
    await act(async () => root.render(<><button>Other task</button><WorkspaceStoragePanel workspace={workspace} /></>)); await click(host, "Measure storage details");
    const target = where === "inside" ? host.querySelector<HTMLInputElement>("input")! : button(host, "Other task"); target.focus();
    measure.mockImplementation(() => { throw Error("Synthetic measurement failure"); }); await click(host, "Refresh storage details");
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("could not be measured"); expect(host.querySelector("table")).toBeNull();
    expect(document.activeElement).toBe(where === "inside" ? button(host, "Measure storage details") : target);
  } finally { await act(async () => root.unmount()); host.remove(); }
});
it.each(["outside", "blur"])("does not steal newer focus after a paging click in the same batch (%s)", async mode => {
  const panel = await mount();
  try {
    const next = button(panel.host, "Next storage records"), outside = button(panel.host, "Outside inventory"); next.focus();
    await act(async () => { next.click(); if (mode === "outside") outside.focus(); else next.blur(); });
    expect(panel.host.querySelector("h3")?.textContent).toContain("11–20"); expect(document.activeElement).toBe(mode === "outside" ? outside : document.body);
  } finally { await panel.close(); }
});
it.each(["owned", "outside", "blur"])("a shrinking result recovers only still-owned disabled pager focus (%s)", async mode => {
  const panel = await mount();
  try {
    const next = button(panel.host, "Next storage records"), outside = button(panel.host, "Outside inventory"); next.focus();
    if (mode === "outside") outside.focus(); else if (mode === "blur") next.blur();
    const smaller = copy(); smaller.studies = smaller.studies.slice(0, 3); await panel.render(smaller);
    expect(next.disabled).toBe(true); expect(panel.host.querySelectorAll("tbody tr")).toHaveLength(3);
    expect(document.activeElement).toBe(mode === "owned" ? panel.host.querySelector("h3") : mode === "outside" ? outside : document.body);
  } finally { await panel.close(); }
});
it("recovers a focused Previous button disabled when a later page disappears", async () => {
  const panel = await mount();
  try {
    await click(panel.host, "Next storage records"); const previous = button(panel.host, "Previous storage records"); previous.focus();
    const smaller = copy(); smaller.studies = smaller.studies.slice(0, 3); await panel.render(smaller);
    expect(previous.disabled).toBe(true); expect(document.activeElement).toBe(panel.host.querySelector("h3")); expect(panel.host.querySelector("h3")?.textContent).toContain("1–3 of 3");
  } finally { await panel.close(); }
});
