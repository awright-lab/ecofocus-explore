import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { scheduleAcknowledgedWorkspaceAutosave } from "../acknowledgedWorkspaceAutosave";
import { initialDashboard } from "../documentSeeds";
import { createReportRecord, normalizeDashboardWorkspace } from "../workspacePersistence";

function workspace() { return normalizeDashboardWorkspace({ reports: [createReportRecord(structuredClone(initialDashboard))] }); }
function deferred() { let resolve!: (value: boolean) => void; let reject!: (reason: Error) => void; const promise = new Promise<boolean>((yes,no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function setup() {
  const value = workspace(), pending = deferred();
  const options = { capture: vi.fn(() => value), onCaptured: vi.fn(), save: vi.fn(() => pending.promise), onRejected: vi.fn(), onState: vi.fn() };
  return { value, pending, options, cancel: scheduleAcknowledgedWorkspaceAutosave(options) };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });
it("debounces capture and waits for acknowledgement before reporting a saved result", async () => {
  const { options, pending, value } = setup();
  expect(options.onState.mock.calls).toEqual([["Saving..."]]);
  await vi.advanceTimersByTimeAsync(899); expect(options.capture).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1); expect(options.onCaptured).toHaveBeenCalledWith(value); expect(options.save).toHaveBeenCalledWith(value);
  await vi.advanceTimersByTimeAsync(5000); expect(options.onState.mock.calls).toEqual([["Saving..."]]);
  pending.resolve(true); await vi.advanceTimersByTimeAsync(0); expect(options.onState).toHaveBeenLastCalledWith("Saved just now");
  await vi.advanceTimersByTimeAsync(2200); expect(options.onState).toHaveBeenLastCalledWith("Saved locally");
});
it("reports false acknowledgements as unsaved without a later success timer", async () => {
  const {options,pending} = setup(); await vi.advanceTimersByTimeAsync(900); pending.resolve(false); await vi.advanceTimersByTimeAsync(10000);
  expect(options.onState.mock.calls).toEqual([["Saving..."],["Not saved"]]); expect(options.onRejected).not.toHaveBeenCalled();
});
it("retains captured recovery data if an unexpected writer rejection occurs", async () => {
  const {options,pending,value} = setup(); await vi.advanceTimersByTimeAsync(900); pending.reject(new Error("Synthetic writer failure")); await vi.advanceTimersByTimeAsync(0);
  expect(options.onRejected).toHaveBeenCalledWith(value); expect(options.onState).toHaveBeenLastCalledWith("Not saved");
});
it("cancels a queued save before capture on report replacement or unmount", async () => {
  const {cancel,options} = setup(); cancel(); await vi.advanceTimersByTimeAsync(10000); expect(options.capture).not.toHaveBeenCalled(); expect(options.save).not.toHaveBeenCalled();
});
it("late success cannot mark a newer edit or another report saved", async () => {
  const old = setup(); await vi.advanceTimersByTimeAsync(900); old.cancel(); const next = setup();
  old.pending.resolve(true); await vi.advanceTimersByTimeAsync(10000); expect(old.options.onState.mock.calls).toEqual([["Saving..."]]); expect(next.options.onState.mock.calls).toEqual([["Saving..."]]);
  next.pending.resolve(false); await vi.advanceTimersByTimeAsync(0); expect(next.options.onState).toHaveBeenLastCalledWith("Not saved");
});
it("obsolete rejected saves cannot replace newer recovery data", async () => {
  const old = setup(); await vi.advanceTimersByTimeAsync(900); old.cancel(); const next = setup(); old.pending.reject(new Error("Late failure")); await vi.advanceTimersByTimeAsync(900);
  expect(old.options.onRejected).not.toHaveBeenCalled(); next.pending.reject(new Error("Current failure")); await vi.advanceTimersByTimeAsync(0); expect(next.options.onRejected).toHaveBeenCalledWith(next.value);
});
it("cancels the saved-locally settle message when editing resumes", async () => {
  const current = setup(); await vi.advanceTimersByTimeAsync(900); current.pending.resolve(true); await vi.advanceTimersByTimeAsync(0); current.cancel(); await vi.advanceTimersByTimeAsync(2200);
  expect(current.options.onState.mock.calls).toEqual([["Saving..."],["Saved just now"]]);
});
it("reports capture errors without fabricating recovery data or writing", async () => {
  const current = setup(); current.options.capture.mockImplementation(() => { throw new Error("Synthetic capture failure"); }); await vi.advanceTimersByTimeAsync(900);
  expect(current.options.save).not.toHaveBeenCalled(); expect(current.options.onRejected).not.toHaveBeenCalled(); expect(current.options.onState).toHaveBeenLastCalledWith("Not saved");
});
