import type { DashboardWorkspace } from "../../../shared/types/dashboard";
import { useEffect, useRef } from "react";
import { findPublishedSnapshot, findReport, type WorkspaceRoute } from "./workspacePersistence";

export function workspaceRouteIssue(route: WorkspaceRoute, workspace: DashboardWorkspace): string | null {
  if (route.mode === "invalid") return "This link is incomplete or could not be read. Return to your report library and open the report again.";
  if (route.mode === "published" && !findPublishedSnapshot(workspace, route.reportId, route.snapshotId)) {
    return "This saved snapshot is unavailable in this browser. Local snapshot links require the browser workspace that contains that version.";
  }
  if (route.mode === "builder" && route.reportId && !findReport(workspace, route.reportId)) {
    return "This report is unavailable in this browser workspace. Return to your library to choose an available report.";
  }
  return null;
}

export function WorkspaceRouteRecovery({ reason }: { reason: string }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [reason]);
  return <main className="workspace-load-recovery" aria-labelledby="workspace-link-title">
    <span className="studio-eyebrow">REPORT LINK</span>
    <h1 id="workspace-link-title" ref={heading} tabIndex={-1}>This report link is unavailable.</h1>
    <p>{reason}</p>
    <a className="workspace-recovery-link" href="#/">Return to report library</a>
  </main>;
}
