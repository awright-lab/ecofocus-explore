import { lazy, Suspense, useEffect, useState } from "react";
import { loadDashboardWorkspace, parseWorkspaceRoute } from "./features/document/workspacePersistence";

const BuilderApp = lazy(() => import("./features/builder/BuilderApp"));
const WorkspaceHome = lazy(() =>
  import("./features/workspace/WorkspaceHome").then((module) => ({ default: module.WorkspaceHome }))
);

export default function App() {
  const [route, setRoute] = useState(() => parseWorkspaceRoute());
  const [workspace, setWorkspace] = useState(() => loadDashboardWorkspace());

  useEffect(() => {
    function handleRouteChange() {
      setRoute(parseWorkspaceRoute());
      setWorkspace(loadDashboardWorkspace());
    }

    window.addEventListener("hashchange", handleRouteChange);
    window.addEventListener("popstate", handleRouteChange);
    return () => {
      window.removeEventListener("hashchange", handleRouteChange);
      window.removeEventListener("popstate", handleRouteChange);
    };
  }, []);

  if (route.mode === "home") {
    return (
      <Suspense fallback={<div className="app-route-loading">Loading workspace...</div>}>
        <WorkspaceHome workspace={workspace} onWorkspaceChange={setWorkspace} />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<div className="app-route-loading">Loading report...</div>}>
      <BuilderApp key={`${route.mode}:${route.reportId ?? "active"}`} />
    </Suspense>
  );
}
