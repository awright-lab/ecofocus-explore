import { afterEach, describe, expect, it, vi } from "vitest";
import { createReportRecord, loadDashboardWorkspace, normalizeDashboardWorkspace, saveDashboardWorkspace, workspaceStorageKey } from "../workspacePersistence";
import { initialDashboard } from "../documentSeeds";
import { expectedSyntheticSums, syntheticStudy, syntheticStudyCases, syntheticStudySums } from "./fixtures/syntheticStudy";

describe("synthetic survey storage baseline", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each(syntheticStudyCases)("imports, analyzes and attempts a 5 MiB save for $rows x $fields", async ({ rows, fields }) => {
    const stored = new Map<string, string>();
    let attemptedChars = 0;
    vi.stubGlobal("window", { localStorage: {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => {
        attemptedChars = value.length;
        if (value.length > 5 * 1024 * 1024) throw new DOMException("Synthetic quota", "QuotaExceededError");
        stored.set(key, value);
      }
    } });
    const started = performance.now();
    const { dataset, csvBytes } = await syntheticStudy(rows, fields);
    const importMs = performance.now() - started;
    expect(dataset.rows).toHaveLength(rows);
    expect(dataset.fields).toHaveLength(fields);
    const queryStarted = performance.now();
    expect(syntheticStudySums(dataset)).toEqual(expectedSyntheticSums(rows));
    const queryMs = performance.now() - queryStarted;
    const workspace = normalizeDashboardWorkspace({ reports: [createReportRecord(structuredClone(initialDashboard))], importedDatasets: [dataset] });
    const saveStarted = performance.now();
    const saved = saveDashboardWorkspace(workspace);
    const saveMs = performance.now() - saveStarted;
    expect(saved).toBe(true);
    expect(attemptedChars).toBeLessThan(3 * 1024 * 1024);
    if (saved) {
      const reopened = loadDashboardWorkspace();
      expect(reopened.importedDatasets[0].rows).toEqual(dataset.rows);
      expect(syntheticStudySums(reopened.importedDatasets[0])).toEqual(expectedSyntheticSums(rows));
      expect(stored.has(workspaceStorageKey)).toBe(true);
    } else expect(stored.size).toBe(0);
    console.info("SYNTHETIC_STORAGE", JSON.stringify({ rows, fields, csvBytes, attemptedChars, saved,
      importMs: Math.round(importMs), queryMs: Math.round(queryMs), saveMs: Math.round(saveMs) }));
  });
});
