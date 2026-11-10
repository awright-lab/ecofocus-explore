import { useState } from "react";
import { createRoot } from "react-dom/client";
import { WorkspaceLoadRecovery } from "../../WorkspaceSaveRecovery";
import { inspectStoredWorkspaceCopies } from "../../storedWorkspaceRecovery";
import { createReportRecord, normalizeDashboardWorkspace, workspaceStorageKey, legacyWorkspaceStorageKey } from "../../workspacePersistence";
import { initialDashboard } from "../../documentSeeds";
import { syntheticStudy } from "./syntheticStudy";
import "../../../../styles.css";
import "../../../../studio.css";

const { dataset } = await syntheticStudy(1000, 60);
const legacy = normalizeDashboardWorkspace({ reports: [createReportRecord({ ...structuredClone(initialDashboard), title: "Synthetic recovery study" })], importedDatasets: [dataset] });
const values = new Map([[workspaceStorageKey, "{synthetic damaged current copy"], [legacyWorkspaceStorageKey, JSON.stringify(legacy)]]);
const original = localStorage.getItem(workspaceStorageKey);
function Harness() {
  const [unchanged, setUnchanged] = useState(true);
  return <><aside style={{padding:16,background:"#eaf3ed"}}>Developer acceptance fixture · synthetic 1,000-row, 60-field study · original browser save: {unchanged ? "unchanged" : "CHANGED"}</aside><WorkspaceLoadRecovery inspectCopies={() => {
    const copies = inspectStoredWorkspaceCopies({ getItem: key => values.get(key) ?? null });
    setUnchanged(localStorage.getItem(workspaceStorageKey) === original);
    return copies;
  }} /></>;
}
createRoot(document.querySelector("#root")!).render(<Harness />);
