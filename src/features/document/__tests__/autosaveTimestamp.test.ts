// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { fixture } from "../../analytics/__tests__/versionedRefreshFixture";
import { scheduleAcknowledgedWorkspaceAutosave } from "../acknowledgedWorkspaceAutosave";
import { createWorkspaceSaveSession } from "../workspaceSaveSession";
import { createPublishedSnapshot, createReportRecord, loadDashboardWorkspace, normalizeDashboardWorkspace, saveDashboardWorkspace, upsertDraftReport, workspaceStorageKey } from "../workspacePersistence";

afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); localStorage.clear(); });

it.each([false, true])("proves scheduled save advances report metadata while preserving all other bytes (edited=%s)", async edited => {
  const ctx = await fixture();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-07T12:00:00.000Z"));
  const initial = createPublishedSnapshot(normalizeDashboardWorkspace({ reports: [createReportRecord(ctx.draft)], importedDatasets: ctx.studies }), ctx.draft).workspace;
  localStorage.clear();
  expect(saveDashboardWorkspace(initial)).toBe(true);
  const session = createWorkspaceSaveSession(), original = session.load(), raw = localStorage.getItem(workspaceStorageKey);
  const draft = structuredClone(original.reports[0].draft);
  if (edited) draft.title = "Explicit synthetic edit";
  const states: string[] = [];
  const cancel = scheduleAcknowledgedWorkspaceAutosave({
    capture: () => upsertDraftReport(original, draft),
    onCaptured: () => {},
    save: session.saveAsync,
    onRejected: () => { throw Error("Unexpected rejected synthetic save"); },
    onState: state => states.push(state),
  });
  try {
    await vi.advanceTimersByTimeAsync(899);
    expect(localStorage.getItem(workspaceStorageKey)).toBe(raw);
    await vi.advanceTimersByTimeAsync(1);
    const reopened = loadDashboardWorkspace();
    expect(reopened.reports[0].updatedAt).toBe("2026-11-07T12:00:00.900Z");
    const expected = structuredClone(original);
    expected.reports[0].updatedAt = reopened.reports[0].updatedAt;
    if (edited) { expected.reports[0].title = draft.title; expected.reports[0].draft.title = draft.title; }
    expect(reopened).toEqual(expected);
    expect(reopened.importedDatasets).toEqual(original.importedDatasets);
    expect(reopened.publishedSnapshots).toEqual(original.publishedSnapshots);
    expect(session.hasPending()).toBe(false);
    expect(states).toEqual(["Saving...", "Saved just now"]);
  } finally { cancel(); }
});
