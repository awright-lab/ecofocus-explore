import { RetainedFailedWorkspaceRecovery } from "./features/document/RetainedFailedWorkspaceRecovery";
import { DeferredWorkspaceHistoryRecovery } from "./features/document/DeferredWorkspaceHistoryRecovery";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { parseWorkspaceRoute } from "./features/document/workspacePersistence";
import { workspaceSaveSession } from "./features/document/workspaceSaveSession";
import { WorkspaceLoadRecovery, WorkspaceSaveRecovery } from "./features/document/WorkspaceSaveRecovery";
import type { DashboardWorkspace } from "../shared/types/dashboard";
import { DeferredWorkspaceImportRecovery } from "./features/document/DeferredWorkspaceImportRecovery";
import { WorkspaceRouteRecovery, workspaceRouteIssue } from "./features/document/WorkspaceRouteRecovery";

async function loadWorkspaceSafely(): Promise<DashboardWorkspace | null> {
  try { return await workspaceSaveSession.loadAsync(); } catch { return null; }
}

const BuilderApp = lazy(() => import("./features/builder/BuilderApp"));
const WorkspaceHome = lazy(() =>
  import("./features/workspace/WorkspaceHome").then((module) => ({ default: module.WorkspaceHome }))
);

export default function App() {
  const [route, setRoute] = useState(() => parseWorkspaceRoute());
  const [workspace, setWorkspace] = useState<DashboardWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const loadOwner = useRef(0);
  const opened = useRef(false);
  const opening = useRef(false);
  const workspaceRevision = useRef(0);
  function commitWorkspace(next: DashboardWorkspace | null) {
    const revision = ++workspaceRevision.current;
    ++loadOwner.current;
    opened.current = true;
    opening.current = false;
    setLoading(false);
    setWorkspace(next);
    return revision;
  }
  function getWorkspaceRevision() { return workspaceRevision.current; }

  useEffect(() => {
    let mounted = true;
    async function openRoute() {
      if (!mounted) return;
      const owner = ++loadOwner.current;
      const nextRoute = parseWorkspaceRoute();
      opening.current = true;
      ++workspaceRevision.current;
      setLoading(true);
      const next = await loadWorkspaceSafely();
      if (!mounted || owner !== loadOwner.current) return;
      setRoute(nextRoute);
      commitWorkspace(next);
    }
    function handleRouteChange() {
      // The editor captures pending work synchronously during route events.
      // Loading must await the active adapter and never read stale legacy data.
      queueMicrotask(() => { if (mounted) void openRoute(); });
    }
    // Fast Refresh replays effects while preserving a dirty mounted editor.
    // Re-register listeners without reopening that already initialized route.
    if (!opened.current || opening.current) void openRoute();
    window.addEventListener("hashchange", handleRouteChange);
    window.addEventListener("popstate", handleRouteChange);
    return () => {
      mounted = false;
      ++loadOwner.current;
      window.removeEventListener("hashchange", handleRouteChange);
      window.removeEventListener("popstate", handleRouteChange);
    };
  }, []);

  const recoveryDock = <div className="workspace-recovery-dock">
    <WorkspaceSaveRecovery />
    <RetainedFailedWorkspaceRecovery />
    <DeferredWorkspaceImportRecovery workspace={!loading && route.mode === "home" ? workspace : null} onWorkspaceChange={commitWorkspace} getWorkspaceRevision={getWorkspaceRevision} />
    <DeferredWorkspaceHistoryRecovery workspace={!loading && route.mode === "home" ? workspace : null} onWorkspaceChange={commitWorkspace} getWorkspaceRevision={getWorkspaceRevision} />
  </div>;
  if (loading) return <>{recoveryDock}<div className="app-route-loading" role="status">Opening workspace...</div></>;
  if (!workspace) return <>{recoveryDock}<WorkspaceLoadRecovery /></>;
  const routeIssue = workspaceRouteIssue(route, workspace);
  return (
    <>
      {recoveryDock}
      {routeIssue ? <WorkspaceRouteRecovery reason={routeIssue} /> : route.mode === "home" ? (
        <Suspense fallback={<div className="app-route-loading">Loading workspace...</div>}>
          <WorkspaceHome workspace={workspace} onWorkspaceChange={commitWorkspace} />
        </Suspense>
      ) : (
        <Suspense fallback={<div className="app-route-loading">Loading report...</div>}>
          <BuilderApp key={`${route.mode}:${route.reportId ?? "active"}`} initialWorkspace={workspace} />
        </Suspense>
      )}
    </>
  );
}
