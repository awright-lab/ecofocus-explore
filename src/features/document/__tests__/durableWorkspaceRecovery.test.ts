import { expect, it, vi } from "vitest";
import { initialDashboard } from "../documentSeeds";
import { decodeDurableWorkspace, encodeDurableWorkspace, inspectDurableWorkspaceRecovery } from "../durableWorkspaceRecovery";
import { prepareLegacyWorkspaceCopy } from "../legacyWorkspaceMigration";
import { createReportRecord, normalizeDashboardWorkspace, workspaceStorageKey } from "../workspacePersistence";
import { syntheticStudy } from "./fixtures/syntheticStudy";

function workspace(id = "synthetic") { return { ...normalizeDashboardWorkspace({ reports: [createReportRecord(structuredClone(initialDashboard))] }), id }; }
function draft(payload: string, expectedRevision: number | null = 1, editorId = "editor") { return { workspaceId: "synthetic", editorId, sequence: 1, expectedRevision, payload }; }
const head = () => ({ workspaceId: "synthetic", revision: 1, payload: encodeDurableWorkspace(workspace()) });
function repository(snapshot: Parameters<typeof inspectDurableWorkspaceRecovery>[0] extends { inspect(id: string): Promise<infer S> } ? S : never) { return { inspect: vi.fn(async () => snapshot) }; }

it("returns empty without fabricating a workspace or writing a default", async () => {
  const source = repository({ head: null, pending: [] });
  expect(await inspectDurableWorkspaceRecovery(source, "synthetic")).toEqual({ kind: "empty", saved: null, candidates: [] }); expect(source.inspect).toHaveBeenCalledExactlyOnceWith("synthetic");
});
it("uses one atomic inspection for a valid saved workspace", async () => {
  const source = repository({ head: head(), pending: [] }); const result = await inspectDurableWorkspaceRecovery(source, "synthetic");
  expect(result.kind).toBe("ready"); expect(result.saved?.workspace?.id).toBe("synthetic"); expect(result.candidates).toEqual([]); expect(source.inspect).toHaveBeenCalledTimes(1);
});
it("keeps every pending candidate and distinguishes changed bases without automatically choosing one", async () => {
  const payload = encodeDurableWorkspace(workspace()); const snapshot = { head: head(), pending: [draft(payload), draft(payload, null, "other"), draft("damaged original text", 1, "damaged")] };
  const original = structuredClone(snapshot); const result = await inspectDurableWorkspaceRecovery(repository(snapshot), "synthetic");
  expect(result.kind).toBe("needs_recovery"); expect(result.saved?.workspace).not.toBeNull();
  expect(result.candidates.map(value => [value.draft.editorId, value.base, value.workspace !== null])).toEqual([["editor", "current", true], ["other", "changed", true], ["damaged", "current", false]]);
  expect(result.candidates[2].draft.payload).toBe("damaged original text"); expect(result.candidates[2].error).toBeTruthy(); expect(snapshot).toEqual(original);
});
it("does not silently discard a pending candidate even when its bytes equal the saved payload", async () => {
  const saved = head(); const result = await inspectDurableWorkspaceRecovery(repository({ head: saved, pending: [draft(saved.payload)] }), "synthetic");
  expect(result.kind).toBe("needs_recovery"); expect(result.candidates).toHaveLength(1);
});
it("retains unreadable saved bytes while allowing independent inspection of a valid candidate", async () => {
  const saved = { ...head(), payload: "broken saved text" }; const result = await inspectDurableWorkspaceRecovery(repository({ head: saved, pending: [draft(encodeDurableWorkspace(workspace()))] }), "synthetic");
  expect(result.kind).toBe("needs_recovery"); expect(result.saved?.record.payload).toBe("broken saved text"); expect(result.saved?.error).toBeTruthy(); expect(result.candidates[0].workspace?.id).toBe("synthetic");
});
it("surfaces pending-only recovery and does not invent a saved revision", async () => {
  const result = await inspectDurableWorkspaceRecovery(repository({ head: null, pending: [draft(encodeDurableWorkspace(workspace()), null)] }), "synthetic");
  expect(result.kind).toBe("needs_recovery"); expect(result.saved).toBeNull(); expect(result.candidates[0].base).toBe("current");
});
it("propagates storage access failures rather than returning an empty workspace", async () => {
  await expect(inspectDurableWorkspaceRecovery({ inspect: async () => { throw new Error("Database blocked"); } }, "synthetic")).rejects.toThrow("Database blocked");
});
it("rejects blank recovery identity before database access", async () => {
  const source = repository({ head: null, pending: [] }); await expect(inspectDurableWorkspaceRecovery(source, " ")).rejects.toThrow("workspace ID"); expect(source.inspect).not.toHaveBeenCalled();
});
it("reads a validated migration envelope through the same recovery codec", () => {
  const raw = JSON.stringify(workspace("original")); const copy = prepareLegacyWorkspaceCopy("synthetic", { getItem: key => key === workspaceStorageKey ? raw : null })!;
  expect(decodeDurableWorkspace(copy.payload, "synthetic").id).toBe("synthetic"); expect(() => decodeDurableWorkspace(copy.payload, "unrelated")).toThrow("different workspace");
});
it("retains complete synthetic rows through the saved-state codec", async () => {
  const { dataset } = await syntheticStudy(1000, 60); const value = workspace(); value.importedDatasets = [dataset];
  const original = structuredClone(value); const payload = encodeDurableWorkspace(value), reopened = decodeDurableWorkspace(payload, value.id);
  expect(reopened.importedDatasets[0].rows).toEqual(dataset.rows); expect(reopened.importedDatasets[0].fields).toMatchObject(dataset.fields); expect(value).toEqual(original);
});
it.each([null, [], {}, { kind: "ecofocus-workspace-state", version: 2, workspaceId: "synthetic", payload: "{}" },
  { kind: "ecofocus-workspace-state", version: 1, workspaceId: "other", payload: JSON.stringify(workspace()) },
  { kind: "ecofocus-workspace-state", version: 1, workspaceId: "synthetic", payload: JSON.stringify(workspace("other")) },
])("rejects unsupported, incomplete and crossed workspace envelopes (%j)", value => { expect(() => decodeDurableWorkspace(JSON.stringify(value), "synthetic")).toThrow(); });
it("refuses to encode a malformed workspace rather than creating a successful-looking saved envelope", () => {
  expect(() => encodeDurableWorkspace({ ...workspace(), reports: [] })).toThrow(); expect(() => encodeDurableWorkspace(workspace(" "))).toThrow("workspace ID");
});

it("exposes the exact safe pre-operation candidate separately without choosing or normalizing its bytes", async () => {
  const before = Object.assign(workspace(), { futureExtension: { untouched: "original" } });
  const recoveryPayload = encodeDurableWorkspace(before), payload = encodeDurableWorkspace({ ...workspace(), label: "After" });
  const source = repository({ head: head(), pending: [{ ...draft(payload), recoveryPayload }] });
  const original = structuredClone(await source.inspect()); const result = await inspectDurableWorkspaceRecovery(source, "synthetic");
  expect(result.kind).toBe("needs_recovery"); expect(result.candidates[0].workspace?.label).toBe("After");
  expect(result.candidates[0].preOperation?.payload).toBe(recoveryPayload);
  expect(result.candidates[0].preOperation?.workspace?.id).toBe("synthetic");
  expect(JSON.parse(JSON.parse(result.candidates[0].preOperation!.payload).payload).futureExtension).toEqual(before.futureExtension);
  expect(await source.inspect()).toEqual(original);
});
it("keeps damaged pre-operation bytes visible without hiding a valid target candidate", async () => {
  const result = await inspectDurableWorkspaceRecovery(repository({ head: null, pending: [{ ...draft(encodeDurableWorkspace(workspace())), recoveryPayload: "damaged original" }] }), "synthetic");
  expect(result.candidates[0].workspace).not.toBeNull();
  expect(result.candidates[0].preOperation).toMatchObject({ payload: "damaged original", workspace: null });
  expect(result.candidates[0].preOperation?.error).toBeTruthy();
});
