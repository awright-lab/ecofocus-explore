import type { DashboardDraft } from '../../../shared/types/dashboard';
import { narrativeState } from '../narratives/narrativeEvidence';

/** New-wave snapshots require recorded human review and current linked evidence. */
export function assertRefreshedReportReady(draft: DashboardDraft) {
  const review=draft.waveRefresh;
  if(review===undefined)return;
  const validDate=(value:unknown)=>typeof value==='string'&&Number.isFinite(Date.parse(value));
  if(!review || review.version!==1 || !review.sourceReportId || !review.sourceStudy?.datasetId || !review.targetStudy?.datasetId ||
      review.sourceStudy.datasetId===review.targetStudy.datasetId || !validDate(review.sourceStudy.importedAt) || !validDate(review.targetStudy.importedAt) ||
      !validDate(review.reviewedAt) || typeof review.declaration!=='string' || !review.declaration.trim() || !Array.isArray(review.fieldMappings))
    throw Error('This refreshed report is missing its recorded source review. Recreate it from a reviewed new-wave preview before saving a snapshot.');
  for(const page of draft.pages)for(const element of page.elements){
    const state=narrativeState(element,draft.pages);
    if(state&&!state.current)throw Error(`Review or relink evidence for “${element.name}” before saving a snapshot of this refreshed report. ${state.reasons.join(' ')}`);
  }
}
