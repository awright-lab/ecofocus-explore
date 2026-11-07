import type { DashboardWorkspace, PublishedDashboardSnapshot } from "../../../shared/types/dashboard";

export type HistoryReconciliationIssue = {
  kind: "different_workspace" | "conflicting_snapshot" | "detached_snapshot" | "invalid_history" | "conflicting_version";
  snapshotId: string | null;
};
export type HistoryReconciliation = {
  kind: "unchanged" | "ready" | "needs_review";
  workspace: DashboardWorkspace;
  acknowledged: DashboardWorkspace;
  additions: PublishedDashboardSnapshot[];
  issues: HistoryReconciliationIssue[];
};
function capture<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => item && typeof item === "object" && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)) : item);
}
function valid(snapshot: PublishedDashboardSnapshot) {
  return typeof snapshot.id === "string" && Boolean(snapshot.id.trim()) && typeof snapshot.reportId === "string" && Boolean(snapshot.reportId.trim()) &&
    snapshot.dashboard?.id === snapshot.reportId && Number.isSafeInteger(snapshot.dashboard.publishMetadata?.publishCount) && snapshot.dashboard.publishMetadata.publishCount > 0;
}

// A proposal for the shared save coordinator, not a storage write or an editor
// replacement. Inputs must come from validated workspace decoders or owned saves.
// Only acknowledged historical snapshots can cross route ownership.
// Current reports, studies, libraries and active-report selection always win.
export function reconcileAcknowledgedHistory(latest: DashboardWorkspace, acknowledged: DashboardWorkspace): HistoryReconciliation {
  const current = capture(latest), saved = capture(acknowledged);
  const result: HistoryReconciliation = { kind: "unchanged", workspace: current, acknowledged: saved, additions: [], issues: [] };
  if (typeof current.id !== "string" || !current.id.trim() || current.id !== saved.id) {
    result.kind = "needs_review"; result.issues.push({ kind: "different_workspace", snapshotId: null }); return result;
  }
  const byId = new Map<string, PublishedDashboardSnapshot>();
  const reportIds = new Set(current.reports.map(report => report.id));
  const versions = new Map<string, string>();
  function checkVersion(snapshot: PublishedDashboardSnapshot) {
    if (!valid(snapshot)) return;
    const key = JSON.stringify([snapshot.reportId, snapshot.dashboard.publishMetadata.publishCount]);
    const existing = versions.get(key);
    if (existing !== undefined && existing !== snapshot.id) result.issues.push({ kind: "conflicting_version", snapshotId: snapshot.id });
    else versions.set(key, snapshot.id);
  }
  for (const snapshot of current.publishedSnapshots) {
    if (!valid(snapshot)) result.issues.push({ kind: "invalid_history", snapshotId: typeof snapshot.id === "string" ? snapshot.id : null });
    checkVersion(snapshot);
    const previous = byId.get(snapshot.id);
    if (previous) result.issues.push({ kind: "conflicting_snapshot", snapshotId: snapshot.id });
    else byId.set(snapshot.id, snapshot);
  }
  const savedIds = new Set<string>();
  for (const snapshot of saved.publishedSnapshots) {
    if (savedIds.has(snapshot.id)) result.issues.push({ kind: "conflicting_snapshot", snapshotId: snapshot.id });
    savedIds.add(snapshot.id);
    if (!valid(snapshot)) { result.issues.push({ kind: "invalid_history", snapshotId: typeof snapshot.id === "string" ? snapshot.id : null }); continue; }
    checkVersion(snapshot);
    const previous = byId.get(snapshot.id);
    if (previous) {
      if (canonical(previous) !== canonical(snapshot)) result.issues.push({ kind: "conflicting_snapshot", snapshotId: snapshot.id });
      continue;
    }
    byId.set(snapshot.id, snapshot);
    result.additions.push(capture(snapshot));
    if (!reportIds.has(snapshot.reportId)) result.issues.push({ kind: "detached_snapshot", snapshotId: snapshot.id });
  }
  if (result.issues.length) { result.kind = "needs_review"; return result; }
  if (!result.additions.length) return result;
  // Preserve existing order. Insert new history before a lower version of the
  // same report; a late older acknowledgement cannot become the latest version.
  for (const snapshot of result.additions) {
    const index = current.publishedSnapshots.findIndex(item => item.reportId === snapshot.reportId && item.dashboard.publishMetadata.publishCount < snapshot.dashboard.publishMetadata.publishCount);
    if (index < 0) current.publishedSnapshots.push(snapshot);
    else current.publishedSnapshots.splice(index, 0, snapshot);
  }
  result.kind = "ready";
  return result;
}
