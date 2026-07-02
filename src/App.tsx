import { useEffect, useState } from "react";
import BuilderApp from "./features/builder/BuilderApp";
import { loadDashboardWorkspace, parseWorkspaceRoute } from "./features/document/workspacePersistence";
import { WorkspaceHome } from "./features/workspace/WorkspaceHome";

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
    return <WorkspaceHome workspace={workspace} onWorkspaceChange={setWorkspace} />;
  }

  return <BuilderApp key={`${route.mode}:${route.reportId ?? "active"}`} />;
}
