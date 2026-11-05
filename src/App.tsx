import { lazy, Suspense, useEffect, useState } from "react";
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

  useEffect(() => {
    function handleRouteChange() {
      // Let the editor flush its debounce before reading the next route's data.
      queueMicrotask(() => {
        setRoute(parseWorkspaceRoute());
        setWorkspace(loadWorkspaceSafely());
      });
    }

    window.addEventListener("hashchange", handleRouteChange);
    window.addEventListener("popstate", handleRouteChange);
    return () => {
      window.removeEventListener("hashchange", handleRouteChange);
      window.removeEventListener("popstate", handleRouteChange);
    };
  }, []);

  if (!workspace) return <WorkspaceLoadRecovery />;
  const routeIssue = workspaceRouteIssue(route, workspace);
  return (
    <>
      <WorkspaceSaveRecovery />
      <DeferredWorkspaceImportRecovery workspace={route.mode === "home" ? workspace : null} onWorkspaceChange={setWorkspace} />
      {routeIssue ? <WorkspaceRouteRecovery reason={routeIssue} /> : route.mode === "home" ? (
        <Suspense fallback={<div className="app-route-loading">Loading workspace...</div>}>
          <WorkspaceHome workspace={workspace} onWorkspaceChange={setWorkspace} />
        </Suspense>
      ) : (
        <Suspense fallback={<div className="app-route-loading">Loading report...</div>}>
          <BuilderApp key={`${route.mode}:${route.reportId ?? "active"}`} />
        </Suspense>
      )}
    </>
  );
}
