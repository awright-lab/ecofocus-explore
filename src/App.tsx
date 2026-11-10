import { RetainedFailedWorkspaceRecovery } from "./features/document/RetainedFailedWorkspaceRecovery";
import { DeferredWorkspaceHistoryRecovery } from "./features/document/DeferredWorkspaceHistoryRecovery";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { parseWorkspaceRoute } from "./features/document/workspacePersistence";
import { workspaceSaveSession } from "./features/document/workspaceSaveSession";
import { WorkspaceLoadRecovery, WorkspaceSaveRecovery } from "./features/document/WorkspaceSaveRecovery";
import type { DashboardWorkspace } from "../shared/types/dashboard";
import { DeferredWorkspaceImportRecovery } from "./features/document/DeferredWorkspaceImportRecovery";
import { WorkspaceRouteRecovery, workspaceRouteIssue } from "./features/document/WorkspaceRouteRecovery";

function loadWorkspaceSafely(): DashboardWorkspace | null {
  try { return workspaceSaveSession.load(); } catch { return null; }
}

const BuilderApp = lazy(() => import("./features/builder/BuilderApp"));
const WorkspaceHome = lazy(() =>
  import("./features/workspace/WorkspaceHome").then((module) => ({ default: module.WorkspaceHome }))
);

export default function App() {
  const [route, setRoute] = useState(() => parseWorkspaceRoute());
  const [workspace, setWorkspace] = useState(loadWorkspaceSafely);
  const workspaceRevision = useRef(0);
  function commitWorkspace(next: DashboardWorkspace | null) {
    const revision = ++workspaceRevision.current;
    setWorkspace(next);
    return revision;
  }
  function getWorkspaceRevision() { return workspaceRevision.current; }

  useEffect(() => {
    function handleRouteChange() {
      // Let the editor flush its debounce before reading the next route's data.
      queueMicrotask(() => {
        setRoute(parseWorkspaceRoute());
        commitWorkspace(loadWorkspaceSafely());
      });
    }

    window.addEventListener("hashchange", handleRouteChange);
    window.addEventListener("popstate", handleRouteChange);
    return () => {
      window.removeEventListener("hashchange", handleRouteChange);
      window.removeEventListener("popstate", handleRouteChange);
    };
  }, []);

  const recoveryDock = <div className="workspace-recovery-dock">
    <WorkspaceSaveRecovery />
    <RetainedFailedWorkspaceRecovery />
    <DeferredWorkspaceImportRecovery workspace={route.mode === "home" ? workspace : null} onWorkspaceChange={commitWorkspace} getWorkspaceRevision={getWorkspaceRevision} />
    <DeferredWorkspaceHistoryRecovery workspace={route.mode === "home" ? workspace : null} onWorkspaceChange={commitWorkspace} getWorkspaceRevision={getWorkspaceRevision} />
  </div>;
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
          <BuilderApp key={`${route.mode}:${route.reportId ?? "active"}`} />
        </Suspense>
      )}
    </>
  );
}
