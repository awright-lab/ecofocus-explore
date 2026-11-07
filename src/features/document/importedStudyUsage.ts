import type { AnalyticsQueryRequest } from "../../../shared/types/analytics";
import { narrativeStudyIds } from "../narratives/narrativeEvidence";
import type { DashboardDraft, DashboardTile, DashboardWorkspace } from "../../../shared/types/dashboard";

export interface ImportedStudyUsage { reportId: string; reportTitle: string; location: string }

function refStudyIds(ref: AnalyticsQueryRequest["sourceRef"]): string[] {
  return ref?.datasetId && ["imported_file", "workspace_database"].includes(ref.kind) ? [ref.datasetId] : [];
}
function queryStudyIds(query: AnalyticsQueryRequest | undefined): string[] {
  const identity = query?.sourceIdentity?.kind === "imported" ? query.sourceIdentity : undefined;
  return [...(identity?.datasetId ? [identity.datasetId] : []), ...refStudyIds(query?.sourceIdentity?.sourceRef), ...refStudyIds(query?.sourceRef)];
}
function sourceStudyIds(source: DashboardTile["source"]): string[] {
  return [...(source?.kind === "importedField" && source.datasetId ? [source.datasetId] : []), ...refStudyIds(source?.sourceRef)];
}
function tileStudyIds(tile: DashboardTile): string[] {
  const metadata = tile.result.metadataRefs.source;
  return [...sourceStudyIds(tile.source), ...queryStudyIds(tile.query), ...queryStudyIds(tile.result.query),
    ...(metadata?.kind === "imported" ? [metadata.datasetId] : []), ...refStudyIds(metadata?.sourceRef)];
}

// One dependency contract for immutable snapshot capture and mutable-study
// removal. Keep every explicit source, including conflicting/legacy context;
// an unexecutable saved object must not make its source rows disposable.
export function draftImportedStudyReferences(draft: DashboardDraft): Array<{ datasetId: string; location: string }> {
  const references: Array<{ datasetId: string; location: string }> = [];
  function add(location: string, ids: string[]) {
    for (const datasetId of new Set(ids)) references.push({ datasetId, location });
  }
  for (const audience of draft.savedAudiences??[]) add(`Saved audience: ${audience.label}`,[audience.datasetId]);
  for (const study of draft.importedDatasets) if (study.preparation) add(`Preparation history: ${study.title}`, [study.preparation.sourceDatasetId]);
  for (const page of draft.pages) for (const element of page.elements) if(element.evidence!==undefined) add(`${page.title}: evidence for ${element.name}`,narrativeStudyIds(element.evidence));
  for (const page of draft.pages) for (const tile of page.tiles) add(`${page.title}: ${tile.title}`, tileStudyIds(tile));
  for (const template of draft.analysisLibrary.templates) add(`Saved analysis: ${template.label}`, [...sourceStudyIds(template.source), ...queryStudyIds(template.query)]);
  for (const definition of draft.analysisLibrary.derivedDefinitions) add(`Saved calculation: ${definition.label}`, [...sourceStudyIds(definition.source), ...queryStudyIds(definition.query)]);
  for (const block of [...draft.designLibrary.compositionBlocks, ...draft.designLibrary.compositionStarters]) {
    add(`Saved layout: ${block.label}`, block.items.flatMap(item => item.kind === "tile" ? tileStudyIds(item.tile) : narrativeStudyIds(item.element.evidence)));
  }
  return references;
}
function draftLocations(draft: DashboardDraft, datasetId: string) {
  return draftImportedStudyReferences(draft).filter(reference => reference.datasetId === datasetId).map(reference => reference.location);
}

// Inspect current report drafts and reusable objects. Snapshots owning their
// historical study copy do not depend on the mutable workspace library entry.
export function importedStudyUsage(workspace: DashboardWorkspace, datasetId: string): ImportedStudyUsage[] {
  const usage = workspace.reports.flatMap(report => draftLocations(report.draft, datasetId).map(location => ({
    reportId: report.id, reportTitle: report.title, location,
  })));
  for (const study of workspace.importedDatasets) if (study.preparation?.sourceDatasetId === datasetId) usage.push({ reportId: "workspace", reportTitle: "Study library", location: `Preparation history: ${study.title}` });
  for (const snapshot of workspace.publishedSnapshots) {
    if (!snapshot.dashboard.importedDatasets.some(dataset => dataset.id === datasetId)) {
      for (const location of draftLocations(snapshot.dashboard, datasetId)) usage.push({
        reportId: snapshot.reportId, reportTitle: snapshot.title, location: `Snapshot ${snapshot.versionLabel}: ${location}`,
      });
    }
  }
  return usage;
}

export function importedStudyRemovalBlocker(workspace: DashboardWorkspace, datasetId: string): string | null {
  const usage = importedStudyUsage(workspace, datasetId);
  if (!usage.length) return null;
  const details = usage.slice(0, 3).map(item => `${item.reportTitle} — ${item.location}`).join("; ");
  return `This study is still used by ${usage.length} analysis or saved item${usage.length === 1 ? "" : "s"}: ${details}${usage.length > 3 ? "; …" : ""}. Remove or replace those references before removing the study. Its data has been kept.`;
}

export function editorStudyRemovalBlocker(datasetId: string, history: DashboardDraft[], future: DashboardDraft[], isLoading: boolean): string | null {
  if (isLoading) return "Wait for the running analysis to finish before removing a study. Its data has been kept.";
  if ([...history, ...future].some(draft => draftLocations(draft, datasetId).length > 0 || draft.importedDatasets.some(dataset => dataset.id === datasetId))) {
    return "Undo or Redo can still restore this study or an analysis that uses it. Its data has been kept. Save your report and reopen it before removing an unused study; this ends the current editing history.";
  }
  return null;
}
