import type { DashboardWorkspace } from "../../../shared/types/dashboard";
import type { DurableHistoryCandidate } from "./durableHistoryRepository";
import { decodeStoredWorkspaceSource, workspaceStorageKey } from "./workspacePersistence";
import { reconcileAcknowledgedHistory } from "./acknowledgedWorkspaceHistory";

export function reviewRetainedHistory(record: Readonly<DurableHistoryCandidate>, current: DashboardWorkspace | null) {
  const saved = decodeStoredWorkspaceSource({ key: workspaceStorageKey, raw: record.payload });
  const snapshot = saved.publishedSnapshots.find(item => item.id === record.snapshotId);
  if (saved.id !== record.workspaceId || !snapshot) throw new Error("The retained record does not match its captured workspace and snapshot.");
  const comparison = current ? reconcileAcknowledgedHistory(current, saved) : null;
  const status = !comparison ? "Open a workspace to compare this copy." : comparison.kind === "needs_review"
    ? "Separate review is required. This copy differs from the current workspace or its history."
    : comparison.kind === "unchanged" ? "All snapshots in this copy match the current workspace history."
    : `${comparison.additions.length} ${comparison.additions.length === 1 ? "snapshot in this copy is" : "snapshots in this copy are"} absent from the current workspace history.`;
  return { title: snapshot.title, versionLabel: snapshot.versionLabel, workspaceLabel: saved.label, reports: saved.reports.length, snapshots: saved.publishedSnapshots.length, studies: saved.importedDatasets.length, status };
}
