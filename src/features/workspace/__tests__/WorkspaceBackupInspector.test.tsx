// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { WorkspaceBackupInspector } from "../WorkspaceBackupInspector";
import { createWorkspaceBackup } from "../../document/workspaceBackup";
import { initialDashboard } from "../../document/documentSeeds";
import { createReportRecord, normalizeDashboardWorkspace } from "../../document/workspacePersistence";
let host: HTMLDivElement, root: Root;
const workspace = () => normalizeDashboardWorkspace({ reports: [createReportRecord(structuredClone(initialDashboard))] });
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
async function select(file: File) { const input = host.querySelector("input")!; Object.defineProperty(input, "files", { configurable: true, value: [file] }); await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); }); }
function fileFor(raw: string, read?: () => Promise<ArrayBuffer>) { const bytes = new TextEncoder().encode(raw), file = new File([], "synthetic.json"); Object.defineProperty(file, "size", { value: bytes.byteLength }); Object.defineProperty(file, "arrayBuffer", { value: read ?? (async () => bytes.buffer) }); return file; }
it("inspects actual tagged contents and offers no restore or replacement action", async () => {
 const current = workspace(), raw = JSON.stringify(createWorkspaceBackup(current)); await act(async () => root.render(<WorkspaceBackupInspector workspace={current}/>));
 const write = vi.spyOn(Storage.prototype, "setItem"), fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
 await select(fileFor(raw)); expect(host.textContent).toContain("1 reports, 0 snapshots"); expect(host.textContent).toContain("same workspace ID"); expect(host.textContent).toContain("Restore is not available"); expect(host.querySelector('input')?.getAttribute('accept')).toContain('.json'); expect(host.querySelectorAll('button')).toHaveLength(0); expect(write).not.toHaveBeenCalled(); expect(fetcher).not.toHaveBeenCalled(); write.mockRestore();
});
it("renders backup text as plain text and reports malformed files without replacing workspace", async () => {
 const current = workspace(); current.label = '<img src=x onerror=alert(1)>';
 await act(async () => root.render(<WorkspaceBackupInspector workspace={current}/>)); await select(fileFor(JSON.stringify(createWorkspaceBackup(current)))); expect(host.querySelector("h3")?.textContent).toBe(current.label); expect(host.querySelector("img")).toBeNull();
 await select(fileFor("broken")); expect(host.querySelector('[role="alert"]')).not.toBeNull(); expect(host.querySelector("h3")).toBeNull();
});
it("ignores late file reads after a second selection", async () => {
 const current = workspace(), older = { ...current, label: "Old backup" }, newer = { ...current, label: "New backup" }; let resolve!: (buffer: ArrayBuffer) => void;
 await act(async () => root.render(<WorkspaceBackupInspector workspace={current}/>)); await select(fileFor(JSON.stringify(createWorkspaceBackup(older)), () => new Promise(done => { resolve = done; })));
 await select(fileFor(JSON.stringify(createWorkspaceBackup(newer)))); await act(async () => resolve(new TextEncoder().encode(JSON.stringify(createWorkspaceBackup(older))).buffer)); expect(host.querySelector("h3")?.textContent).toBe("New backup");
});
it("cancels an in-flight inspection on workspace change and flags older comparisons", async () => {
 const current = workspace(); await act(async () => root.render(<WorkspaceBackupInspector workspace={current}/>)); await select(fileFor(JSON.stringify(createWorkspaceBackup(current))));
 const newer = { ...current, label: "Changed" }; await act(async () => root.render(<WorkspaceBackupInspector workspace={newer}/>)); expect(host.textContent).toContain("Select the file again");
 let resolve!: (buffer: ArrayBuffer) => void; const raw = JSON.stringify(createWorkspaceBackup(current)); await select(fileFor(raw, () => new Promise(done => { resolve = done; })));
 await act(async () => root.render(<WorkspaceBackupInspector workspace={current}/>)); await act(async () => resolve(new TextEncoder().encode(raw).buffer)); expect(host.querySelector("h3")).toBeNull();
});
it("cancel prevents a late result from appearing", async () => {
 const current = workspace(), raw = JSON.stringify(createWorkspaceBackup(current)); let resolve!: (buffer: ArrayBuffer) => void;
 await act(async () => root.render(<WorkspaceBackupInspector workspace={current}/>)); await select(fileFor(raw, () => new Promise(done => { resolve = done; })));
 await act(async () => host.querySelector('button')!.click()); await act(async () => resolve(new TextEncoder().encode(raw).buffer)); expect(host.querySelector("h3")).toBeNull(); expect(host.textContent).not.toContain("Reading backup");
});
