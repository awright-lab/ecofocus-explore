import { lazy, Suspense, useEffect, useState } from "react";
import { parseWorkspaceRoute } from "./features/document/workspacePersistence";
import { workspaceSaveSession } from "./features/document/workspaceSaveSession";
import { WorkspaceSaveRecovery } from "./features/document/WorkspaceSaveRecovery";

const BuilderApp = lazy(() => import("./features/builder/BuilderApp"));
const WorkspaceHome = lazy(() =>
  import("./features/workspace/WorkspaceHome").then((module) => ({ default: module.WorkspaceHome }))
);

export default function App() {
  const [route, setRoute] = useState(() => parseWorkspaceRoute());
  const [workspace, setWorkspace] = useState(() => workspaceSaveSession.load());

  useEffect(() => {
    function handleRouteChange() {
      // Let the editor flush its debounce before reading the next route's data.
      queueMicrotask(() => {
        setRoute(parseWorkspaceRoute());
        setWorkspace(workspaceSaveSession.load());
      });
    }

    window.addEventListener("hashchange", handleRouteChange);
    window.addEventListener("popstate", handleRouteChange);
    return () => {
      window.removeEventListener("hashchange", handleRouteChange);
      window.removeEventListener("popstate", handleRouteChange);
    };
  }, []);

  return (
    <>
      <WorkspaceSaveRecovery />
      {route.mode === "home" ? (
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
