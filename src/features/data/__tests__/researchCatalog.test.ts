import { expect, it } from "vitest";
import { importDatasetBuffer } from "../datasetImportModel";
import { filterResearchCatalog, importedResearchCatalog, parseResearchLabels, sampleResearchCatalog } from "../researchCatalog";
import { defaultDataset } from "../../builder/builderConstants";

async function study() { return (await importDatasetBuffer(new TextEncoder().encode("Respondent_ID,Q1,Q2\n1,secret raw answer,Yes\n2,another raw answer,No\n").buffer, "fabricated.csv")).dataset!; }
it("finds full wording, topics, declared concepts and answer labels without indexing respondent values", async () => {
  const dataset = await study(), field = dataset.fields[1]; field.variableLabel = "Q1: How much do you trust sustainable packaging?";
  field.researchTopic = "Food packaging"; field.researchConcepts = ["confidence", "café sustainability"]; field.valueLabels = { "1": "Completely trust" };
  const before = structuredClone(dataset), entries = importedResearchCatalog([dataset]);
  for (const query of ["sustainable trust", "packaging food", "confidence", "CAFE", "completely", "q1"]) expect(filterResearchCatalog(entries, query).map(item => item.field?.id)).toContain(field.id);
  expect(filterResearchCatalog(entries, "secret raw")).toEqual([]);
  expect(filterResearchCatalog(entries, "environmental")).toEqual([]);
  expect(dataset).toEqual(before);
});
it("keeps study and field identities separate when wording or field IDs repeat", async () => {
  const first = await study(), second = {...structuredClone(first), id: "second-study", title: "Second study"};
  const entries = importedResearchCatalog([first, second]);
  expect(new Set(entries.map(entry => entry.key)).size).toBe(entries.length);
  expect(filterResearchCatalog(entries, "", second.id).every(entry => entry.studyId === second.id)).toBe(true);
  expect(filterResearchCatalog(entries, "", "missing")).toEqual([]);
});
it("does not launch identifiers, empty or unmodeled fields as a different question", async () => {
  const dataset=await study();dataset.fields[1].type="date";dataset.fields[1].modelingRole="candidate_date";dataset.fields[2].nonEmptyCount=0;
  expect(importedResearchCatalog([dataset]).map(entry=>entry.available)).toEqual([false,false,false]);
});
it("retains declared topics and source IDs for sample questions", () => {
 const entries=sampleResearchCatalog(defaultDataset.id,"Sample",defaultDataset.questions);
 expect(entries.every(entry=>entry.kind==="sample"&&entry.available&&entry.question)).toBe(true);
 expect(filterResearchCatalog(entries,"",defaultDataset.id,entries[0].topic).every(entry=>entry.topic===entries[0].topic)).toBe(true);
 expect(filterResearchCatalog(entries,defaultDataset.questions[0].label)).toHaveLength(1);
});
it("trims and deduplicates declared concepts without changing their meaning",()=>{expect(parseResearchLabels("  Packaging  "," trust, confidence, trust, , café ")).toEqual({researchTopic:"Packaging",researchConcepts:["trust","confidence","café"]});expect(parseResearchLabels("","")).toEqual({researchTopic:"",researchConcepts:[]});});
it.each([["x".repeat(121),""],["","x".repeat(81)],["",Array.from({length:21},(_,i)=>String(i)).join(",")]])("rejects overlong discovery metadata",(topic,concepts)=>expect(()=>parseResearchLabels(topic,concepts)).toThrow());
