// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { RetainedFailedWorkspaceRecovery } from "../RetainedFailedWorkspaceRecovery";
import { createFailedWorkspaceRecoveryJournal, failedWorkspaceRecoveryJournal } from "../failedWorkspaceRecoveryJournal";
import { WorkspaceSaveRecovery } from "../WorkspaceSaveRecovery";
import { createBrowserWorkspaceSaveSession, workspaceSaveSession } from "../workspaceSaveSession";
import { encodeDurableWorkspace } from "../durableWorkspaceRecovery";
import * as durableRecovery from "../durableWorkspaceRecovery";
import { createReportRecord, normalizeDashboardWorkspace } from "../workspacePersistence";
import { initialDashboard } from "../documentSeeds";
import type { PendingWorkspaceDraft } from "../durableWorkspaceRepository";
let host: HTMLDivElement, root: ReturnType<typeof createRoot>;
beforeEach(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function fixture() {
  const value = { ...normalizeDashboardWorkspace({ reports: [createReportRecord(structuredClone(initialDashboard))] }), id: "synthetic", label: "Synthetic reopened report" };
  const draft: PendingWorkspaceDraft = { workspaceId: value.id, editorId: "prior-tab", sequence: 2, expectedRevision: null, payload: encodeDurableWorkspace(value) };
  const repo = { stage: vi.fn().mockResolvedValue({ kind: "staged" }), pendingAll: vi.fn().mockResolvedValue([draft]) };
  return { draft, repo, journal: createFailedWorkspaceRecoveryJournal(() => repo, () => "current-tab") };
}
function button(text: string) { return Array.from(host.querySelectorAll("button")).find(item => item.textContent?.includes(text))!; }
function details() { return document.getElementById(host.querySelector("button[aria-controls]")!.getAttribute("aria-controls")!)!; }
it("hides and reopens details without changing, re-reading or deleting any recovery or main-save data", async () => {
  const { repo, journal, draft } = fixture(), original = JSON.stringify(draft);
  const writes = [vi.spyOn(Storage.prototype, "setItem"), vi.spyOn(Storage.prototype, "removeItem"), vi.spyOn(Storage.prototype, "clear")];
  const save = vi.spyOn(workspaceSaveSession, "save"), retry = vi.spyOn(workspaceSaveSession, "retry");
  await act(async () => root.render(<RetainedFailedWorkspaceRecovery journal={journal} />));
  const reads = repo.pendingAll.mock.calls.length;
  for (let index = 0; index < 3; index++) {
    await act(async () => button("Hide recovery copies").click());
    expect(details().hidden).toBe(true); expect(button("Review recovery copies").getAttribute("aria-expanded")).toBe("false");
    expect(host.querySelector("h2")!.textContent).toBe("1 recovery copy retained in this browser");
    await act(async () => button("Review recovery copies").click());
    expect(details().hidden).toBe(false); expect(button("Hide recovery copies").getAttribute("aria-expanded")).toBe("true");
  }
  expect(JSON.stringify(draft)).toBe(original); expect(repo.pendingAll).toHaveBeenCalledTimes(reads);
  for (const write of writes) expect(write).not.toHaveBeenCalled();
  expect(repo.stage).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled(); expect(retry).not.toHaveBeenCalled();
});
it("Escape inside recovery details hides them and returns keyboard focus to the reopen control", async () => {
  const { journal } = fixture(); await act(async () => root.render(<RetainedFailedWorkspaceRecovery journal={journal} />));
  const download = button("Download recovery copy"); download.focus();
  await act(async () => download.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  expect(details().hidden).toBe(true); expect(document.activeElement).toBe(button("Review recovery copies"));
  await act(async () => button("Review recovery copies").click()); expect(details().hidden).toBe(false);
});
it("gives explicit feedback when inspection finds the same copies, including a later empty result", async () => {
  const { repo, journal } = fixture(); await act(async () => root.render(<RetainedFailedWorkspaceRecovery journal={journal} />));
  await act(async () => button("Inspect recovery copies again").click());
  expect(host.querySelector('[role="status"]')!.textContent).toContain("Inspection finished: 1 recovery copy found.");
  expect(host.textContent).toContain("Nothing was restored or deleted.");
  repo.pendingAll.mockResolvedValue([]); await act(async () => button("Inspect recovery copies again").click());
  expect(host.textContent).toContain("Inspection finished: 0 recovery copies found."); expect(repo.stage).not.toHaveBeenCalled();
});
it("permits hiding during an inspection without losing its result or reopening on unchanged copies", async () => {
  const { repo, journal, draft } = fixture(); await act(async () => root.render(<RetainedFailedWorkspaceRecovery journal={journal} />));
  let resolve!: (value: PendingWorkspaceDraft[]) => void;
  repo.pendingAll.mockReturnValueOnce(new Promise(yes => { resolve = yes; }));
  await act(async () => button("Inspect recovery copies again").click()); expect(button("Inspecting recovery copies...").disabled).toBe(true);
  await act(async () => button("Hide recovery copies").click()); await act(async () => resolve([draft]));
  expect(details().hidden).toBe(true);
  await act(async () => button("Review recovery copies").click()); expect(host.textContent).toContain("Inspection finished: 1 recovery copy found.");
});
it("reopens after a new retained failed save without stealing focus or saving the workspace", async () => {
  const { repo, journal, draft } = fixture(), value = JSON.parse(JSON.parse(draft.payload).payload);
  const save = vi.spyOn(workspaceSaveSession, "save");
  await act(async () => root.render(<><input aria-label="Current work" /><RetainedFailedWorkspaceRecovery journal={journal} /></>));
  await act(async () => button("Hide recovery copies").click()); const input = host.querySelector("input")!; input.focus();
  await act(async () => journal.retain(value));
  expect(details().hidden).toBe(false); expect(document.activeElement).toBe(input);
  expect(repo.stage).toHaveBeenCalledTimes(1); expect(save).not.toHaveBeenCalled();
});
it("shows retained copies again after remount because hiding is not persisted", async () => {
  const { repo, journal } = fixture(); await act(async () => root.render(<RetainedFailedWorkspaceRecovery journal={journal} />));
  await act(async () => button("Hide recovery copies").click()); await act(async () => root.render(<p>Other route</p>));
  await act(async () => root.render(<RetainedFailedWorkspaceRecovery journal={journal} />));
  expect(details().hidden).toBe(false); expect(repo.stage).not.toHaveBeenCalled();
});
it("uses distinct filenames for copies and repeated clicks even in the same millisecond, with honest download feedback", async () => {
  vi.useFakeTimers(); const { repo, journal, draft } = fixture();
  const copies = [draft, { ...draft, editorId: "other-editor" }]; repo.pendingAll.mockResolvedValue(copies);
  const revoke = vi.fn(); vi.stubGlobal("URL", class extends URL { static createObjectURL() { return "blob:recovery-test"; } static revokeObjectURL = revoke; });
  const names: string[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function(this: HTMLAnchorElement) { expect(this.isConnected).toBe(true); names.push(this.download); });
  await act(async () => root.render(<RetainedFailedWorkspaceRecovery journal={journal} />));
  const buttons = Array.from(host.querySelectorAll("button")).filter(item => item.textContent?.startsWith("Download recovery copy"));
  for (const item of [buttons[0], buttons[1], buttons[0]]) await act(async () => item.click());
  expect(new Set(names).size).toBe(3); expect(names.every(name => /^ecofocus-unsaved-workspace-recovery-capture-2-\d+-\d+-[a-z0-9-]+\.json$/.test(name))).toBe(true);
  expect(host.textContent).toContain("Download requested:"); expect(host.textContent).toContain("Check your browser's Downloads list to confirm it finished.");
  expect(host.textContent).toContain("The recovery copy is still retained here."); expect(details().hidden).toBe(false);
  expect(document.querySelectorAll('a[download]').length).toBe(0); expect(repo.stage).not.toHaveBeenCalled();
  await act(async () => vi.advanceTimersByTime(1000)); expect(revoke).toHaveBeenCalledTimes(3);
});
it("cleans up a failed download click without removing recovery copies or claiming success", async () => {
  vi.useFakeTimers(); const { repo, journal } = fixture(); const revoke = vi.fn();
  vi.stubGlobal("URL", class extends URL { static createObjectURL() { return "blob:failed-click"; } static revokeObjectURL = revoke; });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => { throw Error("Click denied"); });
  await act(async () => root.render(<RetainedFailedWorkspaceRecovery journal={journal} />)); await act(async () => button("Download recovery copy").click());
  expect(host.textContent).toContain("could not be downloaded"); expect(host.textContent).not.toContain("Download requested:");
  expect(host.textContent).toContain("Synthetic reopened report"); expect(document.querySelectorAll('a[download]').length).toBe(0);
  await act(async () => vi.advanceTimersByTime(1000)); expect(revoke).toHaveBeenCalledWith("blob:failed-click"); expect(repo.stage).not.toHaveBeenCalled();
});
it("hiding older copies never hides or retries the separate current unsaved-work warning", async () => {
  const { journal, draft } = fixture(), value = JSON.parse(JSON.parse(draft.payload).payload);
  vi.spyOn(workspaceSaveSession, "getPending").mockReturnValue(value); vi.spyOn(workspaceSaveSession, "getFailure").mockReturnValue("storage");
  const retry = vi.spyOn(workspaceSaveSession, "retry");
  await act(async () => root.render(<><WorkspaceSaveRecovery /><RetainedFailedWorkspaceRecovery journal={journal} /></>));
  await act(async () => button("Hide recovery copies").click());
  expect(details().hidden).toBe(true); expect(host.querySelector('[aria-label="Workspace not saved"]')!.textContent).toContain("Changes not saved");
  expect(host.querySelector('[aria-label="Workspace not saved"]')!.closest("[hidden]")).toBe(null); expect(retry).not.toHaveBeenCalled();
});
it("does not describe inaccessible recovery storage as an empty inventory when hidden", async () => {
  const { repo, journal } = fixture(); repo.pendingAll.mockRejectedValue(Error("Storage blocked"));
  await act(async () => root.render(<RetainedFailedWorkspaceRecovery journal={journal} />));
  expect(host.textContent).toContain("could not be inspected"); await act(async () => button("Hide recovery copies").click());
  expect(host.querySelector("h2")!.textContent).toBe("Recovery copies"); expect(host.textContent).not.toContain("0 recovery copies");
  await act(async () => button("Review recovery copies").click()); expect(details().hidden).toBe(false);
  expect(host.textContent).toContain("could not be inspected"); expect(repo.stage).not.toHaveBeenCalled();
});
it("clears stale success feedback and reopens a hidden panel when a pending inspection fails", async () => {
  const { repo, journal } = fixture(); await act(async () => root.render(<RetainedFailedWorkspaceRecovery journal={journal} />));
  await act(async () => button("Inspect recovery copies again").click()); expect(host.textContent).toContain("Inspection finished:");
  let reject!: (reason: Error) => void; repo.pendingAll.mockReturnValueOnce(new Promise((_resolve, no) => { reject = no; }));
  await act(async () => button("Inspect recovery copies again").click()); await act(async () => button("Hide recovery copies").click());
  await act(async () => reject(Error("Read failed")));
  expect(details().hidden).toBe(false); expect(host.textContent).toContain("could not be inspected");
  expect(host.textContent).not.toContain("Inspection finished:"); expect(host.textContent).toContain("Synthetic reopened report"); expect(repo.stage).not.toHaveBeenCalled();
});
it("does not repeatedly decode large recovery payloads for hide, reopen or download feedback", async () => {
  const { journal } = fixture(), decode = vi.spyOn(durableRecovery, "decodeDurableWorkspace");
  vi.stubGlobal("URL", class extends URL { static createObjectURL() { return "blob:recovery-test"; } static revokeObjectURL() {} });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  await act(async () => root.render(<RetainedFailedWorkspaceRecovery journal={journal} />)); expect(decode).toHaveBeenCalledTimes(1);
  await act(async () => button("Hide recovery copies").click()); await act(async () => button("Review recovery copies").click());
  await act(async () => button("Download recovery copy").click()); expect(decode).toHaveBeenCalledTimes(1);
});
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
