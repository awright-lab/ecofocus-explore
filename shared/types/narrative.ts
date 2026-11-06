export interface NarrativeEvidenceLink {
  tileId: string;
  rowId: string;
  columnId: string;
  snapshot: {
    pageTitle: string;
    tileTitle: string;
    rowLabel: string;
    columnLabel: string;
    value: number;
    base: number;
    displayValue: string;
    studyIds: string[];
    context: string;
  };
}

export interface NarrativeEvidence {
  version: 1;
  reviewedContent: string;
  reviewedAt: string;
  links: NarrativeEvidenceLink[];
}
