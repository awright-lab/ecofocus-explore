import type {DashboardWorkspace} from "../../../shared/types/dashboard";
import {draftImportedStudyReferences} from "./importedStudyUsage";

/** File import creates a study; it never authorizes updating an existing identity.
 * This guard is deliberately separate from explicit modeling/preparation updates. */
export function newImportIdentityIssue(workspace:DashboardWorkspace,datasetId:string):string|null {
  if(typeof datasetId!=="string"||!datasetId.trim())return "The imported study has no usable identity. Its complete result was kept for recovery; no study was added.";
  try {
  const drafts=[...workspace.reports.map(report=>report.draft),...workspace.publishedSnapshots.map(snapshot=>snapshot.dashboard)];
  const studies=[...workspace.importedDatasets,...drafts.flatMap(draft=>draft.importedDatasets)];
  if(studies.some(study=>study.id===datasetId))return "The imported study identity is already retained in this workspace or its report history. The incoming copy was kept for recovery; existing studies were not replaced. Import the original source again to obtain a new identity.";
  if(studies.some(study=>study.preparation?.sourceDatasetId===datasetId)||drafts.some(draft=>draftImportedStudyReferences(draft).some(reference=>reference.datasetId===datasetId)))return "A report, saved item or preparation history already references this study identity. The incoming copy was kept for recovery; missing sources were not rebound.";
  return null;
  }catch{return "The workspace study identities could not be checked safely. The complete imported result was kept for recovery; no study was replaced.";}
}
