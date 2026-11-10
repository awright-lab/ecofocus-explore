import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { handler } from "../dataset-import";
import { savNumbers } from "../../../src/features/data/__tests__/fixtures/savNumberFixture";
const mocks = vi.hoisted(() => ({ set: vi.fn(), setJSON: vi.fn(), query: vi.fn(), connect: vi.fn(), release: vi.fn(), fallback: vi.fn(), fetch: vi.fn() }));
vi.mock("@netlify/blobs", () => ({ connectLambda: vi.fn(), getStore: () => ({ set: mocks.set, setJSON: mocks.setJSON }) }));
vi.mock("@netlify/database", () => ({ getDatabase: () => ({ pool: { connect: mocks.connect } }), MissingDatabaseConnectionError: class extends Error {} }));
vi.mock("node:module", async importOriginal => ({ ...await importOriginal<typeof import("node:module")>(), createRequire: () => () => ({ SavBufferReader: class { constructor() { mocks.fallback(); throw Error("Unexpected fallback for supported synthetic SAV"); } } }) }));
beforeEach(() => { mocks.set.mockResolvedValue(undefined); mocks.setJSON.mockResolvedValue(undefined); mocks.query.mockResolvedValue({ rows: [] }); mocks.connect.mockResolvedValue({ query: mocks.query, release: mocks.release }); mocks.fetch.mockRejectedValue(new Error("No live network")); vi.stubGlobal("fetch", mocks.fetch); });
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
async function upload(buffer: ArrayBuffer) { return handler({ httpMethod: "POST", body: JSON.stringify({ fileName: "synthetic-sav-numbers.sav", fileType: "sav", contentBase64: Buffer.from(buffer).toString("base64") }) } as never, {} as never, undefined as never); }
it.each([{ compression: 0 }, { compression: 1 }, { compression: 0, missing: -1e200 }, { compression: 1, missing: -1e200 }])("preserves finite values and missingness through actual handler parsing and storage arguments %j", async options => {
  const marker = options.missing ?? -Number.MAX_VALUE, buffer = savNumbers([1e101, -1e101, marker, 5], options), response = await upload(buffer);
  expect(response?.statusCode).toBe(200); const body = JSON.parse(response?.body ?? "{}"), expected = ["1e+101", "-1e+101", "", "5"];
  expect(body.dataset.previewRows.map((row: Record<string, string>) => row.AMOUNT)).toEqual(expected); expect(body.dataset.rowCount).toBe(4); expect(body.storage.database).toBe("stored");
  const writes = mocks.query.mock.calls.filter(call => String(call[0]).includes("insert into imported_dataset_rows")); expect(writes).toHaveLength(1);
  const parameters = writes[0][1] as unknown[]; expect(parameters.filter((_, index) => index % 3 === 2).map(value => JSON.parse(String(value)).AMOUNT)).toEqual(expected);
  expect(mocks.set).toHaveBeenCalledOnce(); expect(new Uint8Array(mocks.set.mock.calls[0][1])).toEqual(new Uint8Array(buffer)); expect(mocks.setJSON).toHaveBeenCalledOnce();
  expect(mocks.query.mock.calls[0][0]).toBe("begin"); expect(mocks.query.mock.calls.at(-1)?.[0]).toBe("commit"); expect(mocks.release).toHaveBeenCalledOnce(); expect(mocks.fallback).not.toHaveBeenCalled(); expect(mocks.fetch).not.toHaveBeenCalled();
});
it.each([{ missing: Infinity }, { missing: -1e200, infoCount: 4 }])("refuses unsupported missing metadata before fallback or writes %j", async options => {
  const response = await upload(savNumbers([1e101, 5], options)); expect(response?.statusCode).toBe(500); expect(response?.body).toContain("SAV missing-value metadata");
  expect(mocks.set).not.toHaveBeenCalled(); expect(mocks.setJSON).not.toHaveBeenCalled(); expect(mocks.connect).not.toHaveBeenCalled(); expect(mocks.fallback).not.toHaveBeenCalled(); expect(mocks.fetch).not.toHaveBeenCalled();
});
it.each(Array.from({ length: 12 }, (_, index) => index))("does not enter fallback for a truncated extension header prefix %s", async bytes => {
  const buffer = savNumbers([1, 5], { missing: -1e200 }).slice(0, 244 + bytes), before = new Uint8Array(buffer).slice();
  const response = await upload(buffer); expect(response?.statusCode).toBe(500); expect(response?.body).toContain("incomplete");
  expect(mocks.fallback).not.toHaveBeenCalled(); expect(mocks.set).not.toHaveBeenCalled(); expect(mocks.setJSON).not.toHaveBeenCalled(); expect(mocks.connect).not.toHaveBeenCalled(); expect(mocks.fetch).not.toHaveBeenCalled(); expect(new Uint8Array(buffer)).toEqual(before);
});
