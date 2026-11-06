import type { AnalyticsQueryRequest } from "../../../shared/types/analytics";
import type { DashboardTile, ImportedDatasetRecord } from "../../../shared/types/dashboard";
import { getImportedDatasetQuerySupport, importedFieldValues, type ImportedDatasetQueryConfig } from "./importedDatasetAnalytics";
import { allRespondentsGroupingField } from "./numericSummaryScope";
import { runImportedDatasetQueryForRuntime } from "./importedDatasetRuntimeQuery";

export function resolveSavedImportedQuery(query: AnalyticsQueryRequest, datasets: ImportedDatasetRecord[]): ImportedDatasetQueryConfig {
  const source = query.sourceIdentity;
  if (source?.kind !== "imported") throw new Error("This saved analysis is missing its imported study context. Recreate it from the original result.");
  if(source.intersectionAudience !== undefined) throw new Error("This is a temporary linked-view intersection. Recreate the selections in Explore; ordinary replay would lose their scope.");
  const dataset = datasets.find(item => item.id === source.datasetId);
  if (!dataset) throw new Error(`The study "${source.datasetLabel}" is unavailable. Restore its source data before reusing this analysis.`);
  if (source.datasetImportedAt !== undefined && source.datasetImportedAt !== dataset.importedAt) throw new Error("The study was replaced after this analysis ran. Review and rerun the original analysis before reusing it.");
  if ([query.sourceRef, source.sourceRef].some(ref => ref && ref.datasetId !== dataset.id)) throw new Error("This saved analysis has conflicting study references. Its result has not been recreated.");
  if (query.weight !== null) throw new Error("Weighted imported templates are not supported. Recreate this analysis with an explicit unweighted query.");
  if (query.authoredVariableSet || query.comparisonMode === "wave") throw new Error("This imported template contains unsupported authored rows or wave comparisons. Recreate it from the original result.");
  if (query.filters.length || query.breakBy !== "SUMMARY" || query.comparisonDatasets?.length) throw new Error("This imported template contains conflicting generic filters or comparison settings. Its result has not been recreated.");
  if (source.queryKind && (source.queryKind === "measure") !== (query.metric === "average" || query.metric === "sum")) throw new Error("This imported template has conflicting calculation settings. Its result has not been recreated.");
  const requiredField = (id: string | undefined, role: string) => {
    const field = id ? dataset.fields.find(item => item.id === id) : undefined;
    if (!field) throw new Error(`The saved ${role} field is unavailable in "${dataset.title}". Choose a replacement in the original analysis before saving it again.`);
    return field;
  };
  const measure = query.metric === "average" || query.metric === "sum";
  const field = source.groupingScope === "all_respondents" ? allRespondentsGroupingField(dataset) : requiredField(source.primaryFieldId,"grouping");
  const measureField = measure ? requiredField(source.measureFieldId,"numeric") : null;
  const bannerField = source.bannerFieldId ? requiredField(source.bannerFieldId,"comparison") : null;
  const filterField = source.filterFieldId ? requiredField(source.filterFieldId,"filter") : null;
  if (filterField && source.filterValue === undefined) throw new Error("This saved analysis is missing its filter value. Its result has not been recreated.");
  if (!filterField && source.filterValue !== undefined) throw new Error("This saved analysis is missing its filter field. Its result has not been recreated.");
  const filter = filterField ? { field: filterField, value: source.filterValue! } : null;
  if (filter && dataset.remote?.provider !== "netlify" && !importedFieldValues(dataset,filter.field).includes(filter.value)) throw new Error("The saved filter value is no longer present in this study. Its result has not been recreated.");
  const config = { dataset, field, measureField, bannerField, filter, audience:source.audience, metric: query.metric, chartType: query.chartType, groupingScope: source.groupingScope };
  const support = getImportedDatasetQuerySupport(dataset,field,config);
  if (!support.executable) throw new Error(support.reason);
  return config;
}

export function assertSavedImportedTileSource(query: AnalyticsQueryRequest, source: DashboardTile["source"]) {
  const identity = query.sourceIdentity;
  if (identity?.kind !== "imported") return;
  if (source?.kind === "variableSet") throw new Error("This imported analysis has a conflicting saved variable-set source. Its result has not been recreated.");
  if (source?.kind !== "importedField") return;
  if (source.datasetId !== undefined && source.datasetId !== identity.datasetId ||
      source.fieldId !== undefined && source.fieldId !== identity.primaryFieldId ||
      source.sourceRef && source.sourceRef.datasetId !== identity.datasetId) {
    throw new Error("This saved analysis has conflicting study or field references. Its result has not been recreated.");
  }
}

export function runSavedImportedQuery(query: AnalyticsQueryRequest, datasets: ImportedDatasetRecord[]) {
  return runImportedDatasetQueryForRuntime(resolveSavedImportedQuery(query,datasets));
}
