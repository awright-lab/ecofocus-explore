import { importDatasetBuffer } from "../../data/datasetImportModel";
import { runImportedDatasetQuery } from "../../data/importedDatasetAnalytics";
import { initialDashboard } from "../../document/documentSeeds";
export async function comparisonSuggestionFixture(breakout = true) {
 const rows: string[] = [];
 for (const [group, events, other] of [["Ref", 1, 5], ["A", 8, 2], ["B", 1, 5]] as const) for (let i = 0; i < events + other; i++) rows.push(`${rows.length + 1},${group},${i < events ? "Y" : "N"},${i % 2 ? "Other" : "Core"}`);
 const imported = await importDatasetBuffer(new TextEncoder().encode(["ID,Group,Outcome,Segment", ...rows].join("\n")).buffer, "synthetic-comparison-suggestion.csv"), study = imported.dataset!;
 for (const i of [1, 2, 3]) { study.fields[i].type = "categorical"; study.fields[i].modelingRole = "candidate_dimension"; }
 study.fields[1].valueLabels = { Ref: "Reference", A: "Growth", B: "Comparison" }; study.fields[2].valueLabels = { Y: "Selected event", N: "Other valid", DK: "Excluded option" };
 const result = runImportedDatasetQuery({ dataset: study, field: study.fields[2], bannerField: breakout ? study.fields[1] : undefined, metric: "count", chartType: "table" });
 const draft = structuredClone(initialDashboard), page = draft.pages[0], tile = { ...page.tiles[0], id: "suggestion-source", name: "Event distribution", title: "Event distribution by group", query: result.query, result, visualization: "table" as const, source: { kind: "importedField" as const, id: study.fields[2].id, label: "Outcome", datasetId: study.id, fieldId: study.fields[2].id, sourceRef: result.query.sourceRef } };
 draft.pages = [{ ...page, id: "suggestion-page", title: "Current findings", elements: [], tiles: [tile] }]; draft.importedDatasets = [study]; draft.savedAudiences = [];
 return { draft, studies: [study], study, tile, origin: JSON.stringify([draft.pages[0].id, tile.id]) };
}
