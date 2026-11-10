// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { RetainedFailedWorkspaceRecovery } from "../RetainedFailedWorkspaceRecovery";
import { createFailedWorkspaceRecoveryJournal, failedWorkspaceRecoveryJournal } from "../failedWorkspaceRecoveryJournal";
import { WorkspaceSaveRecovery } from "../WorkspaceSaveRecovery";
import { createBrowserWorkspaceSaveSession, workspaceSaveSession } from "../workspaceSaveSession";
import { encodeDurableWorkspace } from "../durableWorkspaceRecovery";
import { createReportRecord, normalizeDashboardWorkspace } from "../workspacePersistence";
import { initialDashboard } from "../documentSeeds";
import type { PendingWorkspaceDraft } from "../durableWorkspaceRepository";
let host: HTMLDivElement, root: ReturnType<typeof createRoot>;
beforeEach(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function fixture() {
  const value = { ...normalizeDashboardWorkspace({ reports: [createReportRecord(structuredClone(initialDashboard))] }), id: "synthetic", label: "Synthetic reopened report" };
  const draft: PendingWorkspaceDraft = { workspaceId: value.id, editorId: "prior-tab", sequence: 2, expectedRevision: null, payload: encodeDurableWorkspace(value) };
  const repo = { stage: vi.fn().mockResolvedValue({ kind: "staged" }), pendingAll: vi.fn().mockResolvedValue([draft]) };
  return { draft, repo, journal: createFailedWorkspaceRecoveryJournal(() => repo, () => "current-tab") };
}
function button(text: string) { return Array.from(host.querySelectorAll("button")).find(item => item.textContent?.includes(text))!; }
it("shows prior tab recovery copies automatically without selecting, restoring or writing them", async () => {
  const { repo, journal } = fixture(); await act(async () => root.render(<RetainedFailedWorkspaceRecovery journal={journal} />));
  expect(host.textContent).toContain("Synthetic reopened report"); expect(host.textContent).toContain("not confirmed main saves"); expect(host.textContent).toContain("unencrypted"); expect(repo.stage).not.toHaveBeenCalled();
});
it("does not show an empty recovery inventory as a saved or restored workspace", async () => {
  const { repo, journal } = fixture(); repo.pendingAll.mockResolvedValue([]); await act(async () => root.render(<RetainedFailedWorkspaceRecovery journal={journal} />)); expect(host.textContent).toBe("");
});
it("keeps prior successful inspection visible on a later read failure and permits retry", async () => {
  const { repo, journal } = fixture(); await act(async () => root.render(<RetainedFailedWorkspaceRecovery journal={journal} />)); repo.pendingAll.mockRejectedValueOnce(Error("Storage blocked"));
  await act(async () => button("Inspect recovery copies again").click()); expect(host.textContent).toContain("could not be inspected"); expect(host.textContent).toContain("Synthetic reopened report");
  await act(async () => button("Inspect recovery copies again").click()); expect(host.textContent).not.toContain("could not be inspected"); expect(repo.stage).not.toHaveBeenCalled();
});
it("downloads exact original draft bytes even if the payload cannot be decoded", async () => {
  const { repo, journal, draft } = fixture(), opaque = { ...draft, payload: "opaque\ud800payload" }; repo.pendingAll.mockResolvedValue([opaque]);
  const parts: BlobPart[][] = [], NativeBlob = Blob; vi.stubGlobal("Blob", class extends NativeBlob { constructor(value: BlobPart[] = [], options?: BlobPropertyBag) { parts.push(value); super(value, options); } });
  vi.stubGlobal("URL", class extends URL { static createObjectURL() { return "blob:recovery-test"; } static revokeObjectURL() {} });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  await act(async () => root.render(<RetainedFailedWorkspaceRecovery journal={journal} />)); await act(async () => button("Download recovery copy").click());
  expect(JSON.parse(String(parts[0][0])).draft).toEqual(opaque); expect(repo.stage).not.toHaveBeenCalled();
});
it("reports download failure without dropping the retained inventory", async () => {
  const { journal } = fixture(); vi.stubGlobal("URL", class extends URL { static createObjectURL(): string { throw Error("Denied"); } });
  await act(async () => root.render(<RetainedFailedWorkspaceRecovery journal={journal} />)); await act(async () => button("Download recovery copy").click());
  expect(host.textContent).toContain("could not be downloaded"); expect(host.textContent).toContain("Synthetic reopened report");
});
it("ignores inspection results after unmount", async () => {
  const { repo, journal, draft } = fixture(); let resolve!: (value: PendingWorkspaceDraft[]) => void; repo.pendingAll.mockReturnValue(new Promise(yes => { resolve = yes; }));
  await act(async () => root.render(<RetainedFailedWorkspaceRecovery journal={journal} />)); await act(async () => root.render(<p>Other route</p>)); await act(async () => resolve([draft])); expect(host.textContent).toBe("Other route");
});

it("wires real browser save failure to recovery retention without changing its false result", () => {
  const { draft } = fixture(), value = JSON.parse(JSON.parse(draft.payload).payload);
  const retain = vi.spyOn(failedWorkspaceRecoveryJournal, "retain").mockImplementation(() => {});
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Synthetic full", "QuotaExceededError"); });
  const session = createBrowserWorkspaceSaveSession(false); expect(session.save(value)).toBe(false); expect(retain).toHaveBeenCalledWith(value); expect(session.getPending()).toBe(value);
});
it.each(["saving", "retained", "failed"] as const)("separates %s recovery status from the main failed save", async status => {
  const { draft } = fixture(), value = JSON.parse(JSON.parse(draft.payload).payload);
  vi.spyOn(workspaceSaveSession, "getPending").mockReturnValue(value); vi.spyOn(workspaceSaveSession, "getFailure").mockReturnValue("storage");
  const snapshot = { source: value, status }; vi.spyOn(failedWorkspaceRecoveryJournal, "getSnapshot").mockReturnValue(snapshot);
  await act(async () => root.render(<WorkspaceSaveRecovery />)); expect(host.textContent).toContain("Changes not saved");
  expect(host.textContent).toContain(status === "retained" ? "main save still failed" : status === "saving" ? "Keep this tab open until it is confirmed" : "could not be confirmed");
});
