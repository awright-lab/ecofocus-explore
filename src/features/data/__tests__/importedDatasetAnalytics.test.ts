import { describe, expect, it } from "vitest";
import type { ImportedDatasetField, ImportedDatasetRecord } from "../../../../shared/types/dashboard";
import {
  buildImportedFieldSuitability,
  buildImportedQueryRecommendations,
  buildImportedResultProvenance,
  formatImportedMeasureValue,
  firstImportedDimensionField,
  firstImportedMeasureField,
  getImportedDatasetQuerySupport,
  importedFieldValues,
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
      queryKindLabel: "Imported numeric summary",
      summaryLabel: "Average Annual spend by Segment",
      groupingLabel: "Segment",
      measureLabel: "Annual spend",
      metricLabel: "Average",
      bannerLabel: "Region",
      baseLabel: "Valid measure n = 3"
    });
    expect(provenance?.chips).toContain("Number: Annual spend");
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

    expect(result.metric.label).toBe("Total Annual spend");
    expect(result.table.find((row) => row.label === "Core")?.values.summary).toBe(30);
    expect(result.table.find((row) => row.label === "Growth")?.values.summary).toBe(5);
    expect(buildImportedResultProvenance(result)).toMatchObject({
      summaryLabel: "Sum Annual spend by Segment",
      filterLabel: "Region is West",
      baseLabel: "Valid measure n = 3"
    });
    expect(formatImportedMeasureValue(15, "average")).toBe("15");
    expect(formatImportedMeasureValue(15.4, "average")).toBe("15.4");
    expect(formatImportedMeasureValue(30, "sum")).toBe("30");
  });

  it("uses imported value labels as survey answer choices, including zero-response choices", () => {
    const answerField = field("q10", "Q10: Lifestyle approach - Which one best describes your current behavior?", "q10", {
      distinctCount: 2,
      valueLabels: {
        "1": "Do this often",
        "2": "Do this sometimes",
        "3": "Not an option for me"
      }
    });
    const surveyDataset: ImportedDatasetRecord = {
      ...dataset,
      fields: [answerField],
      rows: [
        { q10: "1" },
        { q10: "1" },
        { q10: "2" }
      ],
      rowCount: 3,
      fieldCount: 1
    };

    const result = runImportedDatasetQuery({
      dataset: surveyDataset,
      field: answerField,
      bannerField: null,
      filter: null,
      chartType: "vertical_bar",
      metric: "percent_selected"
    });

    expect(result.table.map((row) => row.label)).toEqual([
      "Do this often",
      "Do this sometimes",
      "Not an option for me"
    ]);
    expect(result.metadataRefs.source).toMatchObject({
      primaryFieldLabel: "Q10: Lifestyle approach",
      primaryFieldPrompt: "Which one best describes your current behavior?"
    });
    expect(result.table.map((row) => row.values.summary)).toEqual([66.7, 33.3, 0]);
  });

  it("does not inflate bases with rows that are blank for the selected survey field", () => {
    const answerField = field("q10", "Q10: Lifestyle approach", "q10", {
      nonEmptyCount: 2,
      distinctCount: 2,
      valueLabels: {
        "1": "Not ready",
        "2": "Ready"
      }
    });
    const genderField = field("gender", "Gender", "gender", {
      valueLabels: {
        "1": "Male",
        "2": "Female"
      }
    });
    const surveyDataset: ImportedDatasetRecord = {
      ...dataset,
      fields: [answerField, genderField],
      rows: [
        { q10: "", gender: "1" },
        { q10: "1", gender: "1" },
        { q10: "", gender: "2" },
        { q10: "2", gender: "2" }
      ],
      rowCount: 4,
      fieldCount: 2
    };

    const result = runImportedDatasetQuery({
      dataset: surveyDataset,
      field: answerField,
      bannerField: genderField,
      filter: null,
      chartType: "grouped_bar",
      metric: "percent_selected"
    });

    expect(result.table.find((row) => row.label === "Not ready")?.values).toMatchObject({
      female_1: 0,
      male_2: 100
    });
    expect(result.table.find((row) => row.label === "Ready")?.values).toMatchObject({
      female_1: 100,
      male_2: 0
    });
    expect(result.table[0].bases).toMatchObject({
      female_1: 1,
      male_2: 1
    });
    expect(result.warnings).toContain("Skipped 2 rows without an answer for Q10: Lifestyle approach.");
  });

  it("blocks local imported analysis when a field has labels but no respondent answers", () => {
    const emptyAnswerField = field("q10", "Q10: Lifestyle approach", "q10", {
      nonEmptyCount: 0,
      distinctCount: 0,
      valueLabels: {
        "1": "Not ready",
        "2": "Ready"
      }
    });

    expect(getImportedDatasetQuerySupport(dataset, emptyAnswerField)).toMatchObject({
      executable: false,
      reason: "Q10: Lifestyle approach has answer-choice labels, but no respondent answers were imported for that field."
    });
  });

  it("matches imported row values case-insensitively for SAV variable names", () => {
    const answerField = field("q11ar2", "Q11ar2: Reusable packaging", "Q11AR2", {
      nonEmptyCount: 0,
      distinctCount: 0,
      valueLabels: {
        "1": "Heard a lot",
        "6": "Have not heard"
      }
    });
    const surveyDataset: ImportedDatasetRecord = {
      ...dataset,
      fields: [answerField],
      rows: [
        { Q11ar2: "6" },
        { Q11ar2: "1" },
        { Q11ar2: "6" }
      ],
      rowCount: 3,
      fieldCount: 1
    };

    expect(getImportedDatasetQuerySupport(surveyDataset, answerField).executable).toBe(true);
    expect(importedFieldValues(surveyDataset, answerField)).toEqual(["Have not heard", "Heard a lot"]);

    const result = runImportedDatasetQuery({
      dataset: surveyDataset,
      field: answerField,
      bannerField: null,
      filter: null,
      chartType: "vertical_bar",
      metric: "percent_selected"
    });

    expect(result.table.map((row) => row.values.summary)).toEqual([33.3, 66.7]);
  });

  it("builds grounded imported query recommendations from modeled field roles", () => {
    expect(firstImportedDimensionField(dataset)?.id).toBe("segment");
    expect(firstImportedMeasureField(dataset)?.id).toBe("spend");
    expect(buildImportedFieldSuitability(spendField)).toMatchObject({
      badges: ["Measure"],
      helperText: "Best used as a numeric measure with a categorical grouping field.",
      recommendedQueryMode: "measure",
      readiness: {
        label: "Ready for measure views",
        recommendedAction: "Build measure view"
      }
    });

    const recommendations = buildImportedQueryRecommendations(dataset, segmentField, {
      selectedQueryMode: "categorical",
      measureField: spendField,
      bannerFields: [regionField]
    });

    expect(recommendations).toEqual([
      expect.objectContaining({
        id: "categorical",
        label: "Show responses for this field",
        chartType: "vertical_bar",
        metric: "percent_selected",
        bannerFieldId: null,
        recommended: true
      }),
      expect.objectContaining({
        id: "categorical_breakout",
        label: "Compare responses by a breakout",
        chartType: "grouped_bar",
        metric: "percent_selected",
        bannerFieldId: "region",
        recommended: false
      }),
      expect.objectContaining({
        id: "measure",
        label: "Summarize a numeric field",
        chartType: "grouped_bar",
        metric: "average",
        measureFieldId: "spend"
      })
    ]);
  });

  it("skips record and identifier fields when choosing default imported analysis fields", () => {
    const recordField = field("record", "record: Record number", "RECORD", {
      type: "numeric",
      modelingRole: "candidate_measure",
      nonEmptyCount: 4000,
      distinctCount: 4000,
      eligibleForFilter: false,
      eligibleForSegment: false,
      eligibleForBanner: false
    });
    const uuidField = field("uuid", "uuid: Respondent identifier", "UUID", {
      type: "text",
      modelingRole: "candidate_dimension",
      nonEmptyCount: 4000,
      distinctCount: 4000
    });
    const statusField = field("status", "status: Participant status", "STATUS", {
      distinctCount: 3,
      valueLabels: { "3": "Complete" }
    });
    const scoreField = field("score", "Score", "SCORE", {
      type: "numeric",
      modelingRole: "candidate_measure",
      nonEmptyCount: 4000,
      distinctCount: 12,
      eligibleForFilter: false,
      eligibleForSegment: false,
      eligibleForBanner: false
    });
    const importedSurvey = {
      ...dataset,
      fields: [recordField, uuidField, statusField, scoreField]
    };

    expect(firstImportedDimensionField(importedSurvey)?.id).toBe("status");
    expect(firstImportedMeasureField(importedSurvey)?.id).toBe("score");
    expect(buildImportedFieldSuitability(recordField)).toMatchObject({
      badges: ["Identifier"],
      recommendedQueryMode: "modeling",
      readiness: {
        label: "Reference field",
        recommendedAction: "Choose another field"
      }
    });
  });

  it("does not recommend analysis for metadata-only imported datasets", () => {
    const metadataOnlyDataset: ImportedDatasetRecord = {
      ...dataset,
      rowCount: 0,
      rows: [],
      previewRows: [],
      notes: ["SAV labels imported, but case rows were not readable."]
    };

    expect(buildImportedQueryRecommendations(metadataOnlyDataset, segmentField, {
      selectedQueryMode: "categorical",
      measureField: spendField,
      bannerFields: [regionField]
    })).toEqual([]);
    expect(getImportedDatasetQuerySupport(metadataOnlyDataset, segmentField).reason).toContain("only has SAV labels and field metadata");
  });

  it("explains imported field readiness and modeling gaps", () => {
    expect(buildImportedFieldSuitability(segmentField)).toMatchObject({
      recommendedQueryMode: "categorical",
      readiness: {
        status: "ready_dimension",
        label: "Ready for analysis",
        recommendedAction: "Create analysis"
      }
    });

    expect(buildImportedFieldSuitability(field("zip", "ZIP code", "zip", { distinctCount: 96 }))).toMatchObject({
      recommendedQueryMode: "categorical",
      readiness: {
        status: "limited",
        label: "Limited query support",
        recommendedAction: "Review model"
      }
    });

    expect(buildImportedFieldSuitability(field("raw", "Raw note", "raw_note", {
      type: "text",
      modelingRole: "raw_variable",
      eligibleForFilter: false,
      eligibleForSegment: false,
      eligibleForBanner: false
    }))).toMatchObject({
      recommendedQueryMode: "modeling",
      readiness: {
        status: "needs_modeling",
        label: "Needs modeling review",
        recommendedAction: "Model field"
      }
    });
  });

  it("recommends concrete modeling changes for imported fields", () => {
    expect(buildImportedFieldSuitability(field("raw_segment", "Raw segment", "raw_segment", {
      type: "text",
      modelingRole: "raw_variable",
      distinctCount: 4,
      eligibleForFilter: false,
      eligibleForSegment: false,
      eligibleForBanner: false
    }))).toMatchObject({
      recommendations: expect.arrayContaining([
        expect.objectContaining({
          id: "mark_dimension",
          label: "Mark as dimension",
          workflowAction: {
            label: "Apply and analyze",
            queryMode: "categorical",
            description: "Applies the dimension model and opens the guided query for a categorical tabulation."
          },
          suggestedUpdates: {
            type: "categorical",
            modelingRole: "candidate_dimension",
            eligibleForFilter: true,
            eligibleForSegment: true,
            eligibleForBanner: true
          }
        })
      ])
    });

    expect(buildImportedFieldSuitability(field("raw_spend", "Raw spend", "raw_spend", {
      type: "numeric",
      modelingRole: "raw_variable",
      eligibleForFilter: true,
      eligibleForSegment: true,
      eligibleForBanner: true
    }))).toMatchObject({
      recommendations: expect.arrayContaining([
        expect.objectContaining({
          id: "mark_measure",
          label: "Mark as measure",
          workflowAction: {
            label: "Apply and build measure view",
            queryMode: "measure",
            description: "Applies the measure model and opens the guided query with this field as the selected measure."
          },
          suggestedUpdates: {
            modelingRole: "candidate_measure",
            eligibleForFilter: false,
            eligibleForSegment: false,
            eligibleForBanner: false
          }
        })
      ])
    });

    expect(buildImportedFieldSuitability(field("small_dimension", "Small dimension", "small_dimension", {
      type: "categorical",
      modelingRole: "candidate_dimension",
      distinctCount: 6,
      eligibleForFilter: false,
      eligibleForSegment: true,
      eligibleForBanner: false
    }))).toMatchObject({
      recommendations: expect.arrayContaining([
        expect.objectContaining({ id: "enable_filter", suggestedUpdates: { eligibleForFilter: true } }),
        expect.objectContaining({ id: "enable_banner", suggestedUpdates: { eligibleForBanner: true } })
      ])
    });

    const highCardinalityRecommendation = buildImportedFieldSuitability(field("zip", "ZIP code", "zip", {
      type: "categorical",
      modelingRole: "candidate_dimension",
      distinctCount: 96,
      eligibleForBanner: true
    })).recommendations.find((recommendation) => recommendation.id === "avoid_banner");

    expect(highCardinalityRecommendation).toMatchObject({
      suggestedUpdates: { eligibleForBanner: false }
    });
    expect(highCardinalityRecommendation?.workflowAction).toBeUndefined();
    expect(buildImportedFieldSuitability(field("zip", "ZIP code", "zip", {
      type: "categorical",
      modelingRole: "candidate_dimension",
      distinctCount: 96,
      eligibleForBanner: true
    }))).toMatchObject({
      recommendations: expect.arrayContaining([
        expect.objectContaining({
          id: "avoid_banner",
          suggestedUpdates: { eligibleForBanner: false }
        })
      ])
    });
  });
});
