import type { AnalyticsQueryRequest } from "../types/analytics";
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.entries(value).filter(([,item]) => item !== undefined).sort(([a],[b]) => a.localeCompare(b)).map(([key,item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
}
function executedSettings(query: AnalyticsQueryRequest) {
  const { chartType: _chartType, ...settings } = query;
  return { ...settings, confidenceLevel: query.confidenceLevel ?? 0.95, comparisonMode: query.comparisonMode ?? "none", comparisonDatasets: [...(query.comparisonDatasets ?? [])],
    filters: query.filters.filter(filter => !filter.values.includes("all")).map(filter => ({...filter,values:[...filter.values].sort()})).sort((a,b) => a.field.localeCompare(b.field)) };
}
// Cosmetic chart changes do not change observations. Wave order does.
export function analysisSettingsMatch(current: AnalyticsQueryRequest, executed: AnalyticsQueryRequest) {
  return canonical(executedSettings(current)) === canonical(executedSettings(executed));
}
