import { expect, it, vi } from "vitest";
import { formatPercentageNumber, formatPercentageSample, percentageValueMode, unroundedPercentage } from "../percentagePrecision";
import { hasValidRecordedCalculations, recordedCalculation } from "../recordedCalculation";
import frozen from "../../../src/features/data/__tests__/fixtures/legacy-percentage-v1.json";
import type { ImportedDatasetRecord } from "../../types/dashboard";
import type { AnalyticsQueryResponse } from "../../types/analytics";
import { runImportedDatasetQuery } from "../../../src/features/data/importedDatasetAnalytics";
import { decodeStoredWorkspaceSource, saveDashboardWorkspace, workspaceStorageKey } from "../../../src/features/document/workspacePersistence";
import { narrativeState } from "../../../src/features/narratives/narrativeEvidence";
import { analysisChangeReview } from "../../../src/features/analytics/analysisChangeReview";
import { supportsDonutResult } from "../../../src/features/analytics/analyticsDisplay";
import { formatValue } from "../../../src/features/builder/components/CanvasRenderers";
import { analysisTileSvg } from "../../../src/features/export/analysisVisualExport";
import { buildResultEvidence } from "../../../src/features/analytics/resultEvidence";
import { assertImportedQueryResponse } from "../../../src/features/data/importedQueryResponse";
import rationalReference from "./percentage-rational-reference.json";
import { buildXlsxWorkbookPlan } from "../../../src/features/export/xlsxWorkbookPlan";
import { verifyLocalExecution } from "../localExecutionEvidence";
import { webcrypto } from "node:crypto";

const legacy = () => decodeStoredWorkspaceSource({ key: workspaceStorageKey, raw: frozen.raw });
it.each(rationalReference.cases)("matches exact rational reference %s/%s",(n,d,value)=>expect(unroundedPercentage(n,d)).toBe(value));
it.each([[0,"0"],[100,"100"],[50,"50"],[33.333,"33.3"],[.002,"0.002"],[99.998,"99.998"]] as const)("preserves compact sample formatting for %s",(value,label)=>expect(formatPercentageSample(value)).toBe(label));
it("verifies the actual old receipt cryptographically without adding a new precision marker",async()=>{
  vi.stubGlobal("crypto",webcrypto);
  try {const result=legacy().reports[0].draft.pages[0].tiles[0].result;expect(await verifyLocalExecution(result)).toBe(true);expect(result.calculationInputs?.percentageValueMode).toBeUndefined();}
  finally {vi.unstubAllGlobals();}
});
function rareStudy(): ImportedDatasetRecord {
  const header = structuredClone(frozen.rareHeader) as Omit<ImportedDatasetRecord, "rows" | "previewRows">;
  const rows = Array.from({ length: 50000 }, (_, i) => ({ [header.fields[0].sourceColumn]: i === 0 ? "Rare" : "Common" }));
  return { ...header, rows, previewRows: rows.slice(0, 5) };
}
it.each([[1,50000,.002],[49999,50000,99.998],[1,3,33.333333333333336],[2,3,66.66666666666667],[0,0,0],[0,50000,0],[50000,50000,100]])("preserves integer-ratio percentage %i/%i", (n,d,value) => expect(unroundedPercentage(n,d)).toBe(value));
it.each([[-1,5],[6,5],[1.5,5],[1,0],[1,Infinity],[Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER]])("refuses unsupported integer ratio %s/%s", (n,d) => expect(() => unroundedPercentage(n,d)).toThrow());
it.each([[.002,0,false,"0.002"],[99.998,0,false,"99.998"],[99.998,0,true,"99.998"],[0,0,false,"0"],[100,1,false,"100.0"],[33.333333333333336,1,false,"33.3"],[33.31,1,true,"33.4"],[Number.MIN_VALUE,0,false,"5e-324"],[99.99999999999999,0,false,"99.99999999999999"]] as const)("does not display partial %s as an endpoint", (v,d,ceil,label) => {
  expect(formatPercentageNumber(v,d,ceil)).toBe(label);
  expect(formatValue(v,"percent","percent_selected",{percentDecimals:d as 0|1,percentRounding:ceil?"ceil":"nearest"})).toBe(label+"%");
});
it("preserves actual prior storage, sealed results, reviewed claims and snapshots without migrating rounded values", () => {
  const workspace=legacy(), before=structuredClone(workspace), draft=workspace.reports[0].draft;
  expect(draft.pages[0].tiles[0].result.table.find(row=>row.label==="Rare")?.values.summary).toBe(33.3);
  expect(hasValidRecordedCalculations(draft.pages[0].tiles[0].result)).toBe(true);
  expect(narrativeState(draft.pages[0].elements[0],draft.pages)?.current).toBe(true);
  let raw="";vi.stubGlobal("window",{localStorage:{setItem:(key:string,value:string)=>{expect(key).toBe(frozen.key);raw=value;}}});
  try {expect(saveDashboardWorkspace(workspace)).toBe(true);} finally {vi.unstubAllGlobals();}
  expect(raw).toBe(frozen.raw);expect(workspace).toEqual(before);
  expect(decodeStoredWorkspaceSource({key:workspaceStorageKey,raw})).toEqual(before);
  expect((frozen.rareResult as AnalyticsQueryResponse).table.find(row=>row.label==="Rare")?.values.summary).toBe(0);
});
it("executes 50000 synthetic rows with rare .002% / partial 99.998%, intact counts and no input mutation", () => {
  const dataset=rareStudy(), original=structuredClone(dataset), config={dataset,field:dataset.fields[0],metric:"percent_selected" as const,chartType:"table" as const};
  const result=runImportedDatasetQuery(config), rare=result.table.find(row=>row.label==="Rare")!,common=result.table.find(row=>row.label==="Common")!;
  expect(result.calculationInputs?.percentageValueMode).toBe(percentageValueMode);
  expect(rare.values.summary).toBe(.002);expect(common.values.summary).toBe(99.998);
  expect(recordedCalculation(result,rare,"summary")).toMatchObject({numerator:1,denominator:50000,percentageValueMode});
  expect(hasValidRecordedCalculations(result)).toBe(true);expect(()=>assertImportedQueryResponse(result,config)).not.toThrow();
  expect(result.series.find(series=>series.id===rare.optionId)?.values[0]).toBe(.002);
  expect(supportsDonutResult(result)).toBe(true);expect(dataset).toEqual(original);
  const draft=legacy().reports[0].draft,tile=draft.pages[0].tiles[0];tile.result=result;tile.query=result.query;
  const svg=analysisTileSvg(tile);expect(svg).toContain("0.002%");expect(svg).toContain("99.998%");
  draft.pages[0].elements=[];
  const cells=buildXlsxWorkbookPlan(draft,draft.pages,"2026-11-07T12:00:00Z").flatMap(sheet=>sheet.rows.flat());
  expect(cells).toContain(.002);expect(cells).toContain(99.998);expect(cells).toContain(50000);
  expect(buildResultEvidence(tile,rare.optionId,"summary")?.explanation).toContain("unrounded percentage");
  const incomplete=structuredClone(result);incomplete.table=incomplete.table.filter(row=>row.label!=="Rare");expect(supportsDonutResult(incomplete)).toBe(false);
  for(const corrupt of ["unknown","rounded","stripped"]){const changed=structuredClone(result);if(corrupt==="unknown")(changed.calculationInputs as unknown as {percentageValueMode:string}).percentageValueMode="other";if(corrupt==="stripped")delete changed.calculationInputs!.percentageValueMode;if(corrupt==="rounded")changed.table.find(row=>row.label==="Rare")!.values.summary=0;expect(hasValidRecordedCalculations(changed)).toBe(false);expect(()=>assertImportedQueryResponse(changed,config)).toThrow();if(corrupt!=="stripped"){tile.result=changed;tile.query=changed.query;expect(()=>analysisTileSvg(tile)).toThrow(/percentage precision/);expect(()=>buildXlsxWorkbookPlan(draft,draft.pages,"2026-11-07T12:00:00Z")).toThrow(/percentage precision/);}}
});
it("requires explicit fresh execution and keeps legacy precision changes separate from real population deltas", () => {
  const workspace=legacy(),before=structuredClone(workspace),draft=workspace.reports[0].draft,old=draft.pages[0].tiles[0].result,dataset=workspace.importedDatasets[0];
  const fresh=runImportedDatasetQuery({dataset,field:dataset.fields[0],metric:"percent_selected",chartType:"table"});
  expect(fresh.table.find(row=>row.label==="Rare")?.values.summary).toBe(100/3);
  expect(analysisChangeReview(old,fresh).deltaUnavailable).toContain("different recorded percentage precision");
  expect(analysisChangeReview(fresh,structuredClone(fresh)).deltaUnavailable).toBeNull();
  draft.pages[0].tiles[0].result=fresh;draft.pages[0].tiles[0].query=fresh.query;
  expect(narrativeState(draft.pages[0].elements[0],draft.pages)?.current).toBe(false);
  expect(workspace.publishedSnapshots).toEqual(before.publishedSnapshots);expect(workspace.importedDatasets).toEqual(before.importedDatasets);
});
