// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { WorkspaceHome } from "../WorkspaceHome";
import { workspaceSaveFailureMessage, workspaceSaveSession } from "../../document/workspaceSaveSession";
import { initialDashboard } from "../../document/documentSeeds";
import { createReportRecord, normalizeDashboardWorkspace } from "../../document/workspacePersistence";

let host: HTMLDivElement, root: Root;
function workspace() { return normalizeDashboardWorkspace({ reports: [createReportRecord(structuredClone(initialDashboard))] }); }
function deferred() { let resolve!: (value: boolean) => void; const promise = new Promise<boolean>(yes => { resolve = yes; }); return { promise, resolve }; }
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); workspaceSaveSession.remember(null); window.history.replaceState(null, "", "/#/"); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Synthetic offline test"))); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); workspaceSaveSession.remember(null); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function newReport() { const button = Array.from(host.querySelectorAll("button")).find(button => button.textContent?.trim() === "New report"); expect(button).toBeTruthy(); return button!; }
it("waits for an acknowledged save, blocks duplicate navigation and preserves failed work", async () => {
  const pending = deferred(), change = vi.fn(); const save = vi.spyOn(workspaceSaveSession, "saveAsync").mockImplementation(value => { workspaceSaveSession.remember(value); return pending.promise; });
  function Harness() { const [value, setValue] = useState(workspace); return <WorkspaceHome workspace={value} onWorkspaceChange={next => { change(next); setValue(next); }} />; }
  await act(async () => root.render(<Harness />)); await act(async () => newReport().click());
  expect(window.location.hash).toBe("#/"); expect(host.textContent).toContain("Saving workspace before opening"); expect(newReport().disabled).toBe(true);
  await act(async () => newReport().click()); expect(save).toHaveBeenCalledOnce(); expect(change).toHaveBeenCalledOnce();
  await act(async () => pending.resolve(false)); expect(window.location.hash).toBe("#/"); expect(host.textContent).toContain(workspaceSaveFailureMessage); expect(newReport().disabled).toBe(false); expect(workspaceSaveSession.getPending()?.reports).toHaveLength(2);
});
it("opens the exact created report only after its save resolves successfully", async () => {
  const pending = deferred(), save = vi.spyOn(workspaceSaveSession, "saveAsync").mockReturnValue(pending.promise);
  function Harness() { const [value, setValue] = useState(workspace); return <WorkspaceHome workspace={value} onWorkspaceChange={setValue} />; }
  await act(async () => root.render(<Harness />)); await act(async () => newReport().click()); const value = save.mock.calls[0][0]; expect(window.location.hash).toBe("#/");
  await act(async () => pending.resolve(true)); expect(window.location.hash).toBe(`#/reports/${value.activeReportId}`);
});
it("does not redirect after newer workspace props replace the transition's captured workspace", async () => {
  const pending = deferred(); vi.spyOn(workspaceSaveSession, "saveAsync").mockReturnValue(pending.promise); const value = workspace(), change = vi.fn();
  await act(async () => root.render(<WorkspaceHome workspace={value} onWorkspaceChange={change} />)); await act(async () => newReport().click());
  await act(async () => root.render(<WorkspaceHome workspace={{ ...value, label: "Newer external workspace" }} onWorkspaceChange={change} />));
  await act(async () => pending.resolve(true)); expect(window.location.hash).toBe("#/"); expect(host.textContent).not.toContain("Saving workspace before opening");
});
it("does not redirect a later route when an unmounted home save completes", async () => {
  const pending = deferred(); vi.spyOn(workspaceSaveSession, "saveAsync").mockReturnValue(pending.promise);
  await act(async () => root.render(<WorkspaceHome workspace={workspace()} onWorkspaceChange={() => undefined} />)); await act(async () => newReport().click());
  await act(async () => { root.render(<p>Another route</p>); window.history.replaceState(null, "", "/#/reports/newer-route"); });
  await act(async () => pending.resolve(true)); expect(window.location.hash).toBe("#/reports/newer-route"); expect(host.textContent).toBe("Another route");
});
it("retains the captured workspace when an unexpected async writer rejection occurs", async () => {
  vi.spyOn(workspaceSaveSession, "saveAsync").mockRejectedValue(new Error("Synthetic writer rejected"));
  await act(async () => root.render(<WorkspaceHome workspace={workspace()} onWorkspaceChange={() => undefined} />)); await act(async () => newReport().click());
  expect(window.location.hash).toBe("#/"); expect(workspaceSaveSession.getPending()?.reports).toHaveLength(2); expect(host.textContent).toContain(workspaceSaveFailureMessage);
});

it("an older acknowledgement cannot clear or redirect a newer owned transition", async () => {
 const older = deferred(), newer = deferred(), save = vi.spyOn(workspaceSaveSession, "saveAsync").mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise), value = workspace(), change = vi.fn();
 await act(async () => root.render(<WorkspaceHome workspace={value} onWorkspaceChange={change} />)); await act(async () => newReport().click());
 await act(async () => root.render(<WorkspaceHome workspace={{ ...value, label: "Newer workspace state" }} onWorkspaceChange={change} />)); await act(async () => newReport().click());
 await act(async () => older.resolve(true)); expect(window.location.hash).toBe("#/"); expect(host.textContent).toContain("Saving workspace before opening"); expect(newReport().disabled).toBe(true);
 await act(async () => newer.resolve(true)); expect(window.location.hash).toBe(`#/reports/${save.mock.calls[1][0].activeReportId}`);
});

it("cancels navigation ownership on a browser route event before React unmounts the home screen", async () => {
 const pending = deferred(); vi.spyOn(workspaceSaveSession, "saveAsync").mockReturnValue(pending.promise);
 await act(async () => root.render(<WorkspaceHome workspace={workspace()} onWorkspaceChange={() => undefined} />)); await act(async () => newReport().click());
 await act(async () => { window.history.replaceState(null, "", "/#/reports/manual-route"); window.dispatchEvent(new HashChangeEvent("hashchange")); });
 await act(async () => pending.resolve(true)); expect(window.location.hash).toBe("#/reports/manual-route"); expect(host.textContent).not.toContain("Saving workspace before opening");
});
