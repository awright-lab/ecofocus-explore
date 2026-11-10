import type {ImportedDatasetRecord} from "../../../shared/types/dashboard";
export interface LocalImportReview {dataset:ImportedDatasetRecord;notice?:string}
// A parsed file awaiting a choice is not an approved import. Keep it separate
// from deferredWorkspaceImports, whose records are eligible for automatic recovery.
let pending:LocalImportReview|null=null;
function protect(event:BeforeUnloadEvent){if(pending){event.preventDefault();event.returnValue="";}}
export const localImportReviewSession={
 peek:()=>pending,
 remember(review:LocalImportReview){if(pending&&pending.dataset!==review.dataset)throw Error("Another parsed import is awaiting review. Keep both original files.");pending=review;if(typeof window!=="undefined")window.addEventListener("beforeunload",protect);},
 clear(dataset:ImportedDatasetRecord){if(pending?.dataset===dataset){pending=null;if(typeof window!=="undefined")window.removeEventListener("beforeunload",protect);}}
};
