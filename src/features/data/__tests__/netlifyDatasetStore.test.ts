import { afterEach, describe, expect, it, vi } from "vitest";
import type { ImportedDatasetRecord } from "../../../../shared/types/dashboard";
import { storeImportedDatasetInNetlify } from "../netlifyDatasetStore";

function dataset(overrides: Partial<ImportedDatasetRecord> = {}): ImportedDatasetRecord {
  return {
    id: "dataset_test",
    title: "Test dataset",
    sourceType: "local_file",
    fileName: "test.csv",
    fileType: "csv",
    importedAt: "2026-07-04T00:00:00.000Z",
    rowCount: 2,
    fieldCount: 1,
    fields: [],
    rows: [{ value: "A" }, { value: "B" }],
    previewRows: [{ value: "A" }],
    modelingStatus: "initial_model",
    notes: [],
    ...overrides
  };
}

describe("netlifyDatasetStore", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stores imported datasets through the Netlify function", async () => {
    const remoteDataset = {
      ...dataset(),
      sourceType: "netlify" as const,
      remote: {
        provider: "netlify" as const,
        projectUrl: "https://example.netlify.app",
        bucket: "dataset-imports",
        objectPath: "workspace-imports/dataset_test/test.csv",
        uploadedAt: "2026-07-04T00:00:00.000Z"
      }
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        dataset: remoteDataset,
        storage: { stored: true }
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await storeImportedDatasetInNetlify(new File(["value\nA"], "test.csv"), dataset());

    expect(result.stored).toBe(true);
    expect(result.dataset.sourceType).toBe("netlify");
    expect(result.dataset.remote).toMatchObject({ provider: "netlify" });
    expect(fetchMock).toHaveBeenCalledWith("/.netlify/functions/dataset-import", expect.objectContaining({
      method: "POST",
      headers: { "Content-Type": "application/json" }
    }));
  });

  it("falls back to local status when the Netlify function is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const result = await storeImportedDatasetInNetlify(new File(["value\nA"], "test.csv"), dataset());

    expect(result.stored).toBe(false);
    expect(result.warning).toContain("offline");
    expect(result.dataset.importStatus).toMatchObject({
      status: "local_ready",
      label: "Stored locally"
    });
  });
});

