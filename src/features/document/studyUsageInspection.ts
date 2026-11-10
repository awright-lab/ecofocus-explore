import type { DashboardDraft, DashboardWorkspace } from "../../../shared/types/dashboard";
import { editorStudyRemovalBlocker, importedStudyUsage, importedStudySafeguards } from "./importedStudyUsage";

export type StudyUsageInspection = Readonly<{
  datasetId: string; title: string; importedAt: string; capturedAt: string;
  context: string; editorBlocker: string | null; unknownDependencies: boolean;
  safeguards: readonly Readonly<{ reportId: string; reportTitle: string; location: string }>[];
  references: readonly Readonly<{ reportId: string; reportTitle: string; location: string }>[];
  copies: readonly Readonly<{ snapshotId: string; reportId: string; reportTitle: string; versionLabel: string; publishedAt: string; studyTitle: string; importedAt: string }>[];
}>;
type Editor = { reportId: string; draft: DashboardDraft; history: DashboardDraft[]; future: DashboardDraft[]; isLoading: boolean };

function text(value: unknown, maximum = 8192) { if (typeof value !== "string" || value.length > maximum) throw Error("Usage metadata is unsupported or exceeds the inspection limit. No data was changed."); return value; }
// Read-only projection: do not call upsertDraftReport, normalize, save, or clone response tables.
export function inspectStudyUsage(workspace: DashboardWorkspace, datasetId: string, editor?: Editor): StudyUsageInspection {
  if (!datasetId || workspace.reports.length > 500 || workspace.publishedSnapshots.length > 1000 || workspace.importedDatasets.length > 1000) throw Error("This workspace exceeds the bounded usage inspection, or its study identity is unavailable. No data was changed.");
  const studies = workspace.importedDatasets.filter(study => study.id === datasetId);
  if (studies.length !== 1) throw Error("The requested current study is missing or ambiguous. No other source was substituted.");
  const study = studies[0]; let projected = workspace;
  if (editor) {
    if (workspace.reports.filter(report => report.id === editor.reportId).length !== 1 || editor.draft.id !== editor.reportId) throw Error("The current report identity is unavailable or ambiguous. Usage inspection was not substituted.");
    projected = { ...workspace, reports: workspace.reports.map(report => report.id === editor.reportId ? { ...report, title: editor.draft.title, draft: editor.draft } : report) };
  }
  const references = importedStudyUsage(projected, datasetId).map(item => Object.freeze({ reportId: text(item.reportId, 512), reportTitle: text(item.reportTitle, 4096), location: text(item.location) }));
  const safeguards = importedStudySafeguards(projected, datasetId).map(item => Object.freeze({ reportId: text(item.reportId, 512), reportTitle: text(item.reportTitle, 4096), location: text(item.location) }));
  const unknownDependencies = safeguards.length > 0;
  const copies: StudyUsageInspection["copies"][number][] = [];
  for (const snapshot of workspace.publishedSnapshots) for (const retained of snapshot.dashboard.importedDatasets) if (retained.id === datasetId) {
    copies.push(Object.freeze({ snapshotId: text(snapshot.id, 512), reportId: text(snapshot.reportId, 512), reportTitle: text(snapshot.title, 4096), versionLabel: text(snapshot.versionLabel, 512), publishedAt: text(snapshot.publishedAt, 128), studyTitle: text(retained.title, 4096), importedAt: text(retained.importedAt, 128) }));
  }
  if (references.length > 5000 || copies.length > 5000 || safeguards.length > 5000) throw Error("This study has more than 5,000 recorded references, historical copies or safeguards. The complete list was withheld, not truncated; no data was changed.");
  return Object.freeze({ datasetId: text(datasetId, 512), title: text(study.title, 4096), importedAt: text(study.importedAt, 128), unknownDependencies, capturedAt: new Date().toISOString(), context: editor ? "Workspace reports, including current unsaved report edits" : "Supplied workspace report drafts", editorBlocker: editor ? editorStudyRemovalBlocker(datasetId, editor.history, editor.future, editor.isLoading) : null, references: Object.freeze(references), safeguards: Object.freeze(safeguards), copies: Object.freeze(copies) });
}
