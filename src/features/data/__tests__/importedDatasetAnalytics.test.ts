import { describe, expect, it } from "vitest";
import type { ImportedDatasetField, ImportedDatasetRecord } from "../../../../shared/types/dashboard";
import {
  buildImportedResultProvenance,
  formatImportedMeasureValue,
  runImportedDatasetQuery
} from "../importedDatasetAnalytics";

function field(
  id: string,
  label: string,
  sourceColumn: string,
  overrides: Partial<ImportedDatasetField> = {}
): ImportedDatasetField {
  return {
    id,
    label,
    sourceColumn,
    type: "categorical",
    nonEmptyCount: 4,
    distinctCount: 2,
    sampleValues: [],
    modelingRole: "candidate_dimension",
    eligibleForFilter: true,
    eligibleForSegment: true,
    eligibleForBanner: true,
    ...overrides
  };
}

const segmentField = field("segment", "Segment", "segment");
const regionField = field("region", "Region", "region");
const spendField = field("spend", "Annual spend", "spend", {
  type: "numeric",
  modelingRole: "candidate_measure",
  eligibleForFilter: false,
  eligibleForSegment: false,
  eligibleForBanner: false
});

const dataset: ImportedDatasetRecord = {
  id: "imported_customers",
  title: "Imported customers",
  sourceType: "local_file",
  fileName: "customers.csv",
  fileType: "csv",
  importedAt: "2026-07-03T00:00:00.000Z",
  rowCount: 4,
  fieldCount: 3,
  fields: [segmentField, regionField, spendField],
  rows: [
    { segment: "Core", region: "West", spend: "10" },
    { segment: "Core", region: "West", spend: "20" },
    { segment: "Growth", region: "West", spend: "5" },
    { segment: "Growth", region: "East", spend: "" }
  ],
  previewRows: [],
  modelingStatus: "initial_model",
  notes: []
};

describe("imported dataset measure analytics", () => {
  it("aggregates imported averages with measure-aware source identity and provenance", () => {
    const result = runImportedDatasetQuery({
      dataset,
      field: segmentField,
      measureField: spendField,
      bannerField: regionField,
      filter: null,
      chartType: "grouped_bar",
      metric: "average"
    });

    expect(result.metric).toMatchObject({
      id: "average",
      label: "Average Annual spend",
      valueFormat: "number"
    });
    expect(result.metadataRefs.source).toMatchObject({
      kind: "imported",
      queryKind: "measure",
      datasetLabel: "Imported customers",
      primaryFieldLabel: "Segment",
      measureFieldLabel: "Annual spend",
      bannerFieldLabel: "Region"
    });
    expect(result.table.find((row) => row.label === "Core")?.values).toMatchObject({
      west_2: 15
    });

    const provenance = buildImportedResultProvenance(result);
    expect(provenance).toMatchObject({
      isMeasure: true,
      queryKindLabel: "Imported measure",
      summaryLabel: "Average Annual spend by Segment",
      groupingLabel: "Segment",
      measureLabel: "Annual spend",
      metricLabel: "Average",
      bannerLabel: "Region",
      baseLabel: "Valid measure n=3"
    });
    expect(provenance?.chips).toContain("Measure: Annual spend");
  });

  it("aggregates imported sums and formats measure values without unnecessary decimals", () => {
    const result = runImportedDatasetQuery({
      dataset,
      field: segmentField,
      measureField: spendField,
      bannerField: null,
      filter: { field: regionField, value: "West" },
      chartType: "vertical_bar",
      metric: "sum"
    });

    expect(result.metric.label).toBe("Sum of Annual spend");
    expect(result.table.find((row) => row.label === "Core")?.values.summary).toBe(30);
    expect(result.table.find((row) => row.label === "Growth")?.values.summary).toBe(5);
    expect(buildImportedResultProvenance(result)).toMatchObject({
      summaryLabel: "Sum Annual spend by Segment",
      filterLabel: "Region: West",
      baseLabel: "Valid measure n=3"
    });
    expect(formatImportedMeasureValue(15, "average")).toBe("15");
    expect(formatImportedMeasureValue(15.4, "average")).toBe("15.4");
    expect(formatImportedMeasureValue(30, "sum")).toBe("30");
  });
});
