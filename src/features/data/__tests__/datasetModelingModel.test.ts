import { describe, expect, it } from "vitest";
import type { ImportedDatasetField, ImportedDatasetRecord } from "../../../../shared/types/dashboard";
import {
  buildImportedDatasetModelingHealth,
  buildImportedFieldModelingProfile,
  buildImportedDatasetStructureSummary,
  importedFieldAnswerChoiceSummary,
  importedFieldDisplayLabel
} from "../datasetModelingModel";
import { importedSurveyQuestionPrompt } from "../importedSurveyLabelModel";

function field(
  id: string,
  label: string,
  overrides: Partial<ImportedDatasetField> = {}
): ImportedDatasetField {
  return {
    id,
    label,
    sourceColumn: id,
    type: "categorical",
    nonEmptyCount: 10,
    distinctCount: 4,
    sampleValues: ["A", "B"],
    modelingRole: "candidate_dimension",
    eligibleForFilter: true,
    eligibleForSegment: true,
    eligibleForBanner: true,
    ...overrides
  };
}

function dataset(fields: ImportedDatasetField[]): ImportedDatasetRecord {
  return {
    id: "imported_model_test",
    title: "Imported model test",
    sourceType: "local_file",
    fileName: "model.csv",
    fileType: "csv",
    importedAt: "2026-07-03T00:00:00.000Z",
    rowCount: 10,
    fieldCount: fields.length,
    fields,
    rows: [],
    previewRows: [],
    modelingStatus: "initial_model",
    notes: []
  };
}

describe("imported dataset modeling model", () => {
  it("summarizes dataset-level modeling health and analytical structures", () => {
    const imported = dataset([
      field("segment", "Segment"),
      field("spend", "Spend", {
        type: "numeric",
        modelingRole: "candidate_measure",
        eligibleForFilter: false,
        eligibleForSegment: false,
        eligibleForBanner: false
      }),
      field("raw_note", "Raw note", {
        type: "text",
        modelingRole: "raw_variable",
        distinctCount: 48,
        eligibleForFilter: false,
        eligibleForSegment: false,
        eligibleForBanner: false
      }),
      field("created_at", "Created at", {
        type: "date",
        modelingRole: "candidate_date",
        eligibleForFilter: false,
        eligibleForSegment: false,
        eligibleForBanner: false
      })
    ]);

    expect(buildImportedDatasetModelingHealth(imported)).toMatchObject({
      queryReadyDimensions: 1,
      queryReadyMeasures: 1,
      bannerReadyFields: 1,
      filterReadyFields: 1,
      fieldsNeedingReview: 2,
      dateFields: 1,
      rawTextFields: 1,
      statusLabel: "Partially modeled",
      statusTone: "partial"
    });

    expect(buildImportedDatasetStructureSummary(imported)).toMatchObject({
      dimensionLabel: "1 query-ready dimension",
      measureLabel: "1 measure",
      health: expect.objectContaining({
        chips: ["1 dimensions", "1 measures", "1 filters", "1 breakouts", "2 review"]
      })
    });
  });

  it("builds richer field modeling profiles for dimensions, measures, raw text, and dates", () => {
    expect(buildImportedFieldModelingProfile(field("segment", "Segment"))).toMatchObject({
      analyticalRoleSummary: "Modeled as a categorical dimension for grouping, filters, segments, and crosstabs.",
      structureSummary: "can filter results · segment-ready · can break out results",
      chips: expect.arrayContaining(["Categorical", "Dimension", "Ready for analysis", "Grouping field"])
    });

    expect(buildImportedFieldModelingProfile(field("spend", "Spend", {
      type: "numeric",
      modelingRole: "candidate_measure",
      eligibleForFilter: false,
      eligibleForSegment: false,
      eligibleForBanner: false
    }))).toMatchObject({
      analyticalRoleSummary: "Modeled as a numeric measure for averages and sums.",
      chips: expect.arrayContaining(["Numeric", "Measure", "Ready for measure views", "Measure aggregation"])
    });

    expect(buildImportedFieldModelingProfile(field("raw_note", "Raw note", {
      type: "text",
      modelingRole: "raw_variable",
      distinctCount: 60,
      eligibleForFilter: false,
      eligibleForSegment: false,
      eligibleForBanner: false
    }))).toMatchObject({
      analyticalRoleSummary: "Still a raw imported field; choose a role before relying on it for analysis.",
      distinctValueSummary: "60 distinct values · better for tables or recoding before charts"
    });

    expect(buildImportedFieldModelingProfile(field("created_at", "Created at", {
      type: "date",
      modelingRole: "candidate_date",
      eligibleForFilter: false,
      eligibleForSegment: false,
      eligibleForBanner: false
    }))).toMatchObject({
      analyticalRoleSummary: "Modeled as a date/time field; imported date analysis is not supported yet.",
      dateTreatment: "Date fields are preserved as metadata until imported date grouping or trend analysis is added."
    });
  });

  it("turns SAV variable labels into concise survey question labels and answer-choice context", () => {
    const q10 = field("Q10", "Q10: Which one of the following best describes you and your approach to making your lifestyle more eco-friendly?", {
      sourceColumn: "Q10",
      variableLabel: "Q10: Which one of the following best describes you and your approach to making your lifestyle more eco-friendly?",
      valueLabels: {
        "1": "I don't feel any need to make changes",
        "2": "I am not ready to make any changes",
        "3": "I am ready to make moderate or small changes",
        "4": "I am ready to make significant changes",
        "5": "I already lead a very eco-friendly lifestyle"
      }
    });
    const q2g1 = field("Q2G1", "Q2G1: Use cloth or reusable shopping bag when grocery shopping - We are interested in learning about some of your everyday activities and lifestyle choices.", {
      sourceColumn: "Q2G1",
      variableLabel: "Q2G1: Use cloth or reusable shopping bag when grocery shopping - We are interested in learning about some of your everyday activities and lifestyle choices."
    });

    expect(importedFieldDisplayLabel(q10)).toBe("Q10: Which one of the following best describes you and your approach to making your lifestyle more eco-friendly?");
    expect(importedFieldAnswerChoiceSummary(q10)).toBe("5 answer choices imported");
    expect(importedFieldDisplayLabel(q2g1)).toBe("Q2G1: Use cloth or reusable shopping bag when grocery shopping");
    expect(importedSurveyQuestionPrompt(q2g1)).toBe("We are interested in learning about some of your everyday activities and lifestyle choices.");
  });
});
