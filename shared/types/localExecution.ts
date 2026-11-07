export interface LocalExecutionCoverage {
 sourceRows:number; audienceExcluded:number; audienceUnknown:number; filterExcluded:number;
 missingGrouping:number; invalidNumeric:number; includedRows:number;
}
export interface LocalExecutionEvidence {
 version:2; method:'local-analysis-inputs-sha256-v2'; sourceDigest:string; resultDigest:string;
 datasetId:string; importedAt:string; executedAt:string; sourceFieldCount:number; projectedFieldCount:number;
 coverage:LocalExecutionCoverage;
}
