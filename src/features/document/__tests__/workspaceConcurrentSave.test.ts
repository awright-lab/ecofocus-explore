import type { DashboardWorkspace } from "../../../../shared/types/dashboard";
import { describe, expect, it, vi } from "vitest";
import { createWorkspaceSaveSession } from "../workspaceSaveSession";
import { createReportRecord, normalizeDashboardWorkspace } from "../workspacePersistence";
import { initialDashboard } from "../documentSeeds";

function sessions() {
  const workspace = normalizeDashboardWorkspace({reports: [createReportRecord(structuredClone(initialDashboard))]});
  let raw: string | null = JSON.stringify(workspace);
  const write = vi.fn((value: typeof workspace) => { raw = JSON.stringify(value); return {version: raw}; });
  const read = () => JSON.parse(raw!) as typeof workspace;
  const create = () => createWorkspaceSaveSession(write, read, () => raw);
  return {create, write, raw: () => raw, replace: (value: string | null) => { raw = value; }};
}

describe("stale browser save protection", () => {
  it("preserves the newer save and the stale tab's pending work across retries and route remounts", () => {
    const store = sessions(), a = store.create(), b = store.create();
    const first = a.load(), stale = b.load();
    expect(a.save({...first, label: "Newer saved work"})).toBe(true);
    const newer = store.raw();
    // A remount may read newer storage, but must not authorize writes from old mounted state.
    b.load();
    const edits = {...stale, label: "Unsaved work from stale tab"};
    expect(b.save(edits)).toBe(false); expect(b.getFailure()).toBe("conflict");
    expect(store.raw()).toBe(newer); expect(b.load()).toEqual(edits);
    expect(b.retry()).toBe(false); expect(store.raw()).toBe(newer);
    expect(b.getPending()).toEqual(edits); expect(store.write).toHaveBeenCalledOnce();
    expect(store.create().load().label).toBe("Newer saved work");
  });
  it.each([null, "damaged newer save"])("does not overwrite external deletion or damage (%s)", raw => {
    const store = sessions(), tab = store.create(), workspace = tab.load(); store.replace(raw);
    expect(tab.save(workspace)).toBe(false); expect(tab.getFailure()).toBe("conflict");
    expect(store.raw()).toBe(raw); expect(store.write).not.toHaveBeenCalled();
  });
  it("allows repeated own saves and treats unchanged bytes as the same version", () => {
    const store = sessions(), tab = store.create(); const workspace = tab.load();
    expect(tab.save({...workspace,label:"First"})).toBe(true);
    expect(tab.save({...workspace,label:"Second"})).toBe(true);
    expect(tab.getFailure()).toBeNull(); expect(tab.hasPending()).toBe(false);
    expect(JSON.parse(store.raw()!).label).toBe("Second");
  });
  it("keeps snapshot failure recovery workspace without a phantom snapshot", () => {
    const store = sessions(), a=store.create(), b=store.create(), current=b.load();
    a.load(); a.save({...current,label:"Newer"});
    const candidate={...current,label:"Unsaved snapshot candidate"};
    expect(b.save(candidate,current)).toBe(false);expect(b.getPending()).toEqual(current);
  });
  it("does not adopt another tab's post-write bytes as its own baseline", () => {
    const store = sessions(); let injected = false;
    const write = (workspace: DashboardWorkspace) => {
      const result = store.write(workspace);
      if (!injected) { injected = true; store.replace(JSON.stringify({...workspace,label:"Concurrent newer save"})); }
      return result;
    };
    const tab = createWorkspaceSaveSession(write, () => JSON.parse(store.raw()!), store.raw);
    const workspace = tab.load(); expect(tab.save(workspace)).toBe(true);
    const newer = store.raw(); expect(tab.save({...workspace,label:"Stale edit"})).toBe(false);
    expect(store.raw()).toBe(newer); expect(tab.getFailure()).toBe("conflict");
  });

});
