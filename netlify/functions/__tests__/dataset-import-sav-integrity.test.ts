// @vitest-environment jsdom
import { File as NodeFile } from "node:buffer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { handler } from "../dataset-import";
import { sav, concat, numeric } from "../../../src/features/data/__tests__/fixtures/savCaseFixture";
import { importDatasetForWorkspace } from "../../../src/features/data/importDatasetWorkspaceService";
import { createReportRecord, normalizeDashboardWorkspace, saveDashboardWorkspace, workspaceStorageKey } from "../../../src/features/document/workspacePersistence";
import { initialDashboard } from "../../../src/features/document/documentSeeds";
const mocks = vi.hoisted(() => ({ set: vi.fn(), setJSON: vi.fn(), database: vi.fn(), fallback: vi.fn(), fetch: vi.fn() }));
vi.mock("@netlify/blobs", () => ({ connectLambda: vi.fn(), getStore: () => ({ set: mocks.set, setJSON: mocks.setJSON }) }));
vi.mock("@netlify/database", () => ({ getDatabase: mocks.database, MissingDatabaseConnectionError: class extends Error {} }));
vi.mock("node:module", async importOriginal => ({ ...await importOriginal<typeof import("node:module")>(), createRequire: () => () => ({ SavBufferReader: class { constructor() { mocks.fallback(); throw Error("A known integrity failure must not reach a different parser"); } } }) }));
beforeEach(() => { vi.stubGlobal("fetch", mocks.fetch); mocks.fetch.mockRejectedValue(new Error("Live network forbidden")); localStorage.clear(); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); localStorage.clear(); });
function truncated() { const bytes = sav(); return bytes.slice(0, bytes.byteLength - 16); }
const cases: Array<[string, () => ArrayBuffer]> = [
  ["uncompressed missing whole respondent", truncated],
  ["compressed early whole-case ending", () => sav(1, 3, new Uint8Array([101, 110, 252, 0, 0, 0, 0, 0]))],
  ["compressed partial respondent", () => sav(1, -1, new Uint8Array([101, 252, 0, 0, 0, 0, 0, 0]))],
  ["truncated raw value", () => sav(1, -1, concat(new Uint8Array([101, 110, 253, 120, 103, 130, 252, 0]), numeric(2).slice(0, 5)))],
  ["incomplete control block", () => sav(1, -1, new Uint8Array([101, 110]))],
  ["invalid physical width", () => { const bytes = sav(); new DataView(bytes).setInt32(68, 0, true); return bytes; }],
];
async function upload(bytes: ArrayBuffer, dataset?: unknown) { return handler({ httpMethod: "POST", body: JSON.stringify({ fileName: "synthetic-integrity.sav", fileType: "sav", contentBase64: Buffer.from(bytes).toString("base64"), dataset }) } as never, {} as never, undefined as never); }
function noWrites() { expect(mocks.set).not.toHaveBeenCalled(); expect(mocks.setJSON).not.toHaveBeenCalled(); expect(mocks.database).not.toHaveBeenCalled(); expect(mocks.fallback).not.toHaveBeenCalled(); }
it.each(cases)("rejects %s before fallback, file storage, metadata or database writes", async (_label, make) => { const bytes = make(), before = new Uint8Array(bytes).slice(); const response = await upload(bytes); expect(response?.statusCode).toBe(500); expect(response?.body).toMatch(/SAV.*(truncated|incomplete|width)/i); noWrites(); expect(mocks.fetch).not.toHaveBeenCalled(); expect(new Uint8Array(bytes)).toEqual(before); });
it("does not substitute supplied browser metadata for a known incomplete SAV stream", async () => { const response = await upload(truncated(), { id: "browser-copy", rowCount: 3, fileType: "sav" }); expect(response?.statusCode).toBe(500); expect(response?.body).toContain("No partial study was imported"); noWrites(); });
it("actual upload client, rejecting handler and local fallback leave the existing workspace bytes intact", async () => {
  vi.stubEnv("VITE_DATASET_IMPORT_PROVIDER", "netlify");
  expect(saveDashboardWorkspace(normalizeDashboardWorkspace({ reports: [createReportRecord(structuredClone(initialDashboard))] }))).toBe(true);
  const raw = localStorage.getItem(workspaceStorageKey), bytes = truncated(), before = new Uint8Array(bytes).slice();
  mocks.fetch.mockImplementation(async (url: string, init: RequestInit) => { expect(url).toBe("/.netlify/functions/dataset-import"); const response = await handler({ httpMethod: "POST", body: init.body } as never, {} as never, undefined as never); return new Response(response!.body, { status: response!.statusCode }); });
  const result = await importDatasetForWorkspace(new NodeFile([new Uint8Array(bytes)], "synthetic-integrity.sav") as unknown as File);
  expect(result.dataset).toBeUndefined(); expect(result.error).toMatch(/SAV.*(truncated|incomplete)/i); expect(result.storage.stored).toBe(false); expect(mocks.fetch).toHaveBeenCalledOnce(); noWrites();
  expect(localStorage.getItem(workspaceStorageKey)).toBe(raw); expect(new Uint8Array(bytes)).toEqual(before);
});
