import { afterEach, describe, expect, it, vi } from "vitest";
import type { ImportedDatasetRecord } from "../../../../shared/types/dashboard";
import { storeImportedDatasetInSupabase } from "../supabaseDatasetStore";

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

describe("supabaseDatasetStore", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("keeps imports local when Supabase env is not configured", async () => {
    const result = await storeImportedDatasetInSupabase(new File(["a,b"], "test.csv"), dataset());

    expect(result.stored).toBe(false);
    expect(result.dataset.sourceType).toBe("local_file");
    expect(result.dataset.importStatus).toMatchObject({
      status: "local_ready",
      label: "Stored locally"
    });
  });

  it("uploads source files and upserts dataset metadata when configured", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon");
    vi.stubEnv("VITE_SUPABASE_DATASET_BUCKET", "datasets");
    vi.stubEnv("VITE_SUPABASE_DATASET_TABLE", "imported_datasets");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, text: async () => "" })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: "record_1" }] });
    vi.stubGlobal("fetch", fetchMock);

    const result = await storeImportedDatasetInSupabase(new File(["a,b"], "test.csv"), dataset());

    expect(result.stored).toBe(true);
    expect(result.dataset.sourceType).toBe("supabase");
    expect(result.dataset.remote).toMatchObject({
      provider: "supabase",
      bucket: "datasets",
      recordId: "record_1"
    });
    expect(result.dataset.importStatus).toMatchObject({
      status: "ready",
      label: "Uploaded and ready"
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

