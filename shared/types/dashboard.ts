import type { BreakById, DatasetId, FilterFieldId, Metric, QuestionId, WeightId } from "./analytics";
import type { AnalyticsQueryRequest, AnalyticsQueryResponse, ChartType } from "./analytics";
import type { ComparisonMode } from "./analytics";

export type DashboardStatus = "draft" | "published";

export interface GradientStop {
  id: string;
  color: string;
  position: number;
  opacity: number;
}

export type GradientType = "linear" | "radial" | "conic";

export interface TileAppearance {
  primaryColor: string;
  palette: string[];
  background: string;
  backgroundMode: "solid" | "gradient";
  gradientFrom: string;
  gradientTo: string;
  gradientType: GradientType;
  gradientStops: GradientStop[];
  borderColor: string;
  borderRadius: number;
  opacity: number;
  shadow: boolean;
  shadowPreset: "soft" | "lifted" | "dramatic" | "glow";
  shadowColor: string;
  shadowOpacity: number;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  glow: boolean;
  glowColor: string;
  glowSize: number;
  showGrid: boolean;
  chartBackground: string;
  titleX: number;
  titleY: number;
  titleWidth: number;
  titleFontSize: number;
  titleTextAlign: "left" | "center" | "right";
  gridColor: string;
  xAxisTextColor: string;
  yAxisTextColor: string;
  axisFontSize: number;
  axisLabelPlacement: "outside" | "insideStart" | "insideCenter";
  axisLabelAlign: "start" | "middle" | "end";
  axisLabelDx: number;
  axisLabelDy: number;
  axisLabelRotation: number;
  axisLabelWrap: boolean;
  axisLabelWidth: number;
  axisLabelMaxLines: number;
  axisHeight: number;
  axisLabelOverrides: Record<string, string>;
  labelColor: string;
  labelFontSize: number;
  labelPosition: "top" | "insideTop" | "insideBottom" | "center";
  labelOffset: number;
  barRadius: number;
  barGap: number;
  barCategoryGap: number;
  barSize: number;
  barFillMode: "solid" | "gradient";
  barGradientTo: string;
  barGradientType: GradientType;
  barGradientAngle: number;
  barGradientStops: GradientStop[];
  barStyles: Record<
    string,
    {
      color: string;
      fillMode: "solid" | "gradient";
      gradientTo: string;
      gradientType?: GradientType;
      gradientAngle?: number;
      gradientStops?: GradientStop[];
      radius: number;
    }
  >;
  showValueLabels: boolean;
  showTable: boolean;
  showBases: boolean;
  showNotes: boolean;
  showAnnotations: boolean;
}

export interface CanvasLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}

export interface DashboardTile {
  id: string;
  name: string;
  title: string;
  source?: {
    kind: "question" | "variableSet" | "importedField";
    id: string;
    label: string;
    datasetId?: string;
    fieldId?: string;
  };
  analysisLifecycle?: {
    role: "canonical" | "derived";
    canonicalTileId: string;
    canonicalLabel: string;
    derivedFrom?: {
      tileId: string;
      title: string;
      visualization: ChartType;
    };
  };
  derivedOutput?: {
    kind: "lead_row_summary" | "top_n_extract" | "bottom_n_extract" | "row_difference" | "row_average";
    sourceTileId: string;
    sourceTitle: string;
    rowId?: string;
    rowLabel?: string;
    comparedRowId?: string;
    comparedRowLabel?: string;
    columnId: string;
    columnLabel: string;
    valueLabel?: string;
    baseLabel?: string;
    rowCount?: number;
    sourceResultSignature?: string;
    lastRecreatedAt?: number;
    savedDefinition?: {
      id: string;
      label: string;
      outputKind: "lead_row_summary" | "top_n_extract" | "bottom_n_extract" | "row_difference" | "row_average";
      sourceTileId: string;
      sourceTileTitle: string;
    };
  };
  segmentProfile?: {
    id: string;
    label: string;
    filterField: FilterFieldId | null;
    filterValue: string;
    dimensionLabel: string;
    valueLabel: string;
  };
  compositionBlock?: {
    id: string;
    label: string;
    insertedAt: number;
    sourceKind?: "savedBlock" | "starter";
    starterContext?: {
      kind: "curated" | "selectedTile" | "activeSource" | "activeComparisonQuery";
      label: string;
      placementLabel?: string;
      nextEditHint?: string;
    };
  };
  locked: boolean;
  hidden: boolean;
  layout: CanvasLayout;
  query: AnalyticsQueryRequest;
  visualization: ChartType;
  appearance: TileAppearance;
  result: AnalyticsQueryResponse;
}

export type DashboardCanvasElementType = "text" | "rectangle" | "circle" | "image";

export interface DashboardCanvasElement {
  id: string;
  name: string;
  type: DashboardCanvasElementType;
  locked: boolean;
  hidden: boolean;
  layout: CanvasLayout;
  content: string;
  style: {
    fill: string;
    fillMode: "solid" | "gradient";
    gradientFrom: string;
    gradientTo: string;
    gradientType: GradientType;
    gradientStops: GradientStop[];
    textColor: string;
    borderColor: string;
    borderWidth: number;
    borderStyle: "solid" | "dashed" | "dotted" | "none";
    borderRadius: number;
    opacity: number;
    shadow: boolean;
    shadowPreset: "soft" | "lifted" | "dramatic" | "glow";
    shadowColor: string;
    shadowOpacity: number;
    shadowBlur: number;
    shadowOffsetX: number;
    shadowOffsetY: number;
    glow: boolean;
    glowColor: string;
    glowSize: number;
    objectFit: "cover" | "contain" | "fill";
    fontFamily: string;
    fontSize: number;
    fontWeight: string;
    fontStyle: "normal" | "italic";
    textDecoration: "none" | "underline";
    textAlign: "left" | "center" | "right";
    lineHeight: number;
    padding: number;
  };
  compositionBlock?: {
    id: string;
    label: string;
    insertedAt: number;
    sourceKind?: "savedBlock" | "starter";
    starterContext?: {
      kind: "curated" | "selectedTile" | "activeSource" | "activeComparisonQuery";
      label: string;
      placementLabel?: string;
      nextEditHint?: string;
    };
  };
  assetSource?: {
    id: string;
    label: string;
    kind: "image";
  };
}

export interface DashboardPage {
  id: string;
  title: string;
  order: number;
  provenance?: {
    templateId?: string;
    templateLabel?: string;
    themeId?: string;
    themeLabel?: string;
    masterId?: string;
    masterLabel?: string;
    masterStatus: "none" | "master-based";
    status: "template-derived" | "custom";
  };
  showCanvasGrid: boolean;
  snapToGrid: boolean;
  gridSize: number;
  background: string;
  backgroundMode: "solid" | "gradient" | "image" | "pattern";
  backgroundPattern: "none" | "teal_grid";
  backgroundImage: string;
  backgroundImageFit: "cover" | "contain" | "fill";
  gradientFrom: string;
  gradientTo: string;
  gradientType: GradientType;
  gradientAngle: number;
  gradientStops: GradientStop[];
  elements: DashboardCanvasElement[];
  tiles: DashboardTile[];
}

export interface SavedVariableSet {
  id: string;
  datasetId: DatasetId;
  label: string;
  description: string;
  topic: string;
  questionIds: QuestionId[];
  primaryQuestionId: QuestionId;
  rowMode?: "question" | "authored";
  rows: Array<{
    id: string;
    label: string;
    kind: "option" | "net" | "topbox" | "bottombox";
    sourceOptionIds: string[];
    rowOrder: number;
    visible: boolean;
    emphasis: "detail" | "summary";
  }>;
  breakBy: BreakById;
  metric: Metric;
  chartType: ChartType;
  comparisonMode?: ComparisonMode;
  comparisonDatasets?: DatasetId[];
  weight: WeightId | null;
  filterField: FilterFieldId | null;
  filterValue: string;
}

export interface SavedBanner {
  id: string;
  datasetId: DatasetId;
  label: string;
  description: string;
  breakBy: BreakById;
}

export interface SavedFilterSet {
  id: string;
  datasetId: DatasetId;
  label: string;
  description: string;
  filterField: FilterFieldId | null;
  filterValue: string;
}

export interface SavedSegmentProfile {
  id: string;
  datasetId: DatasetId;
  label: string;
  description: string;
  filterField: FilterFieldId | null;
  filterValue: string;
  sourceContext?: {
    kind: "question" | "variableSet";
    id: string;
    label: string;
  };
  summary: {
    dimensionLabel: string;
    valueLabel: string;
    contextLabel: string;
  };
}

export interface SavedWeightProfile {
  id: string;
  datasetId: DatasetId;
  label: string;
  description: string;
  weight: WeightId | null;
}

export interface SavedAnalyticalTemplate {
  id: string;
  datasetId: DatasetId;
  label: string;
  description: string;
  source: {
    kind: "question" | "variableSet";
    id: string;
    label: string;
  };
  query: AnalyticsQueryRequest;
  visualization: ChartType;
  summary: {
    sourceLabel: string;
    bannerLabel: string;
    filterLabel: string;
    weightLabel: string;
    confidenceLabel: string;
    comparisonLabel: string;
  };
}

export interface SavedDerivedDefinition {
  id: string;
  datasetId: DatasetId;
  label: string;
  description: string;
  definitionType?: "output" | "metric";
  source: {
    kind: "question" | "variableSet";
    id: string;
    label: string;
  };
  sourceTileId: string;
  sourceTileTitle: string;
  query: AnalyticsQueryRequest;
  outputKind: NonNullable<DashboardTile["derivedOutput"]>["kind"];
  metricKind?: "row_difference" | "row_average";
  spec: {
    columnId: string;
    columnLabel: string;
    rowId?: string;
    rowLabel?: string;
    comparedRowId?: string;
    comparedRowLabel?: string;
    rowCount?: number;
  };
  summary: {
    outputLabel: string;
    sourceLabel: string;
    structureLabel: string;
    queryLabel: string;
  };
}

export interface DesignColorPalette {
  id: string;
  label: string;
  description: string;
  colors: string[];
}

export interface TextStylePreset {
  id: string;
  label: string;
  description: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  lineHeight: number;
  textAlign: "left" | "center" | "right";
  textColor: string;
}

export interface TextBlockPreset {
  id: string;
  label: string;
  description: string;
  content: string;
  width: number;
  height: number;
  style: {
    fill: string;
    fillMode: "solid" | "gradient";
    gradientFrom: string;
    gradientTo: string;
    gradientType: GradientType;
    gradientStops: GradientStop[];
    textColor: string;
    borderColor: string;
    borderWidth: number;
    borderStyle: "solid" | "dashed" | "dotted" | "none";
    borderRadius: number;
    opacity: number;
    shadow: boolean;
    shadowPreset: "soft" | "lifted" | "dramatic" | "glow";
    shadowColor: string;
    shadowOpacity: number;
    shadowBlur: number;
    shadowOffsetX: number;
    shadowOffsetY: number;
    glow: boolean;
    glowColor: string;
    glowSize: number;
    fontFamily: string;
    fontSize: number;
    fontWeight: string;
    fontStyle: "normal" | "italic";
    textDecoration: "none" | "underline";
    textAlign: "left" | "center" | "right";
    lineHeight: number;
    padding: number;
  };
}

export interface SavedDesignAsset {
  id: string;
  label: string;
  description: string;
  kind: "image";
  category: string;
  url: string;
}

export interface SavedCompositionBlock {
  id: string;
  label: string;
  description: string;
  category:
    | "title_section"
    | "chart_commentary"
    | "quote_stat"
    | "methodology"
    | "image_caption"
    | "callout"
    | "narrative"
    | "chart_story"
    | "image_story"
    | "custom";
  createdAt: number;
  updatedAt?: number;
  lastUsedAt?: number;
  summary: {
    objectCount: number;
    tileCount: number;
    elementCount: number;
    width: number;
    height: number;
  };
  items: Array<
    | {
        kind: "tile";
        tile: DashboardTile;
        relativeLayout: CanvasLayout;
      }
    | {
        kind: "element";
        element: DashboardCanvasElement;
        relativeLayout: CanvasLayout;
      }
  >;
}

export interface PageTemplatePreset {
  id: string;
  label: string;
  description: string;
  pageThemeId: string;
  pageMasterId?: string;
  elements: Array<{
    name: string;
    content: string;
    layout: Omit<CanvasLayout, "zIndex">;
    style: TextBlockPreset["style"];
  }>;
}

export interface PageMasterPreset {
  id: string;
  label: string;
  description: string;
  elements: Array<{
    name: string;
    content: string;
    layout: Omit<CanvasLayout, "zIndex">;
    style: TextBlockPreset["style"];
  }>;
}

export interface PageThemePreset {
  id: string;
  label: string;
  description: string;
  backgroundMode: DashboardPage["backgroundMode"];
  backgroundPattern: DashboardPage["backgroundPattern"];
  background: string;
  backgroundImage: string;
  backgroundImageFit: DashboardPage["backgroundImageFit"];
  gradientFrom: string;
  gradientTo: string;
  gradientType: GradientType;
  gradientAngle: number;
  gradientStops: GradientStop[];
  showCanvasGrid: boolean;
}

export interface DesignLibrary {
  palettes: DesignColorPalette[];
  textStyles: TextStylePreset[];
  textBlocks: TextBlockPreset[];
  compositionStarters: SavedCompositionBlock[];
  compositionBlocks: SavedCompositionBlock[];
  assets: SavedDesignAsset[];
  pageThemes: PageThemePreset[];
  pageTemplates: PageTemplatePreset[];
  pageMasters: PageMasterPreset[];
}

export type ImportedDatasetFieldType = "text" | "numeric" | "categorical" | "date";
export type ImportedDatasetFieldRole = "raw_variable" | "candidate_dimension" | "candidate_measure" | "candidate_date";

export interface ImportedDatasetField {
  id: string;
  label: string;
  sourceColumn: string;
  variableLabel?: string;
  valueLabels?: Record<string, string>;
  sourceFormat?: string;
  type: ImportedDatasetFieldType;
  nonEmptyCount: number;
  distinctCount: number;
  sampleValues: string[];
  modelingRole: ImportedDatasetFieldRole;
  eligibleForFilter: boolean;
  eligibleForSegment: boolean;
  eligibleForBanner: boolean;
}

export interface ImportedDatasetRecord {
  id: string;
  title: string;
  sourceType: "local_file" | "supabase" | "netlify";
  fileName: string;
  fileType: "csv" | "xlsx" | "sav" | "unknown";
  remote?: {
    provider: "supabase" | "netlify";
    projectUrl: string;
    bucket: string;
    objectPath: string;
    recordId?: string;
    uploadedAt: string;
  };
  importStatus?: {
    status: "local_ready" | "uploaded" | "parsing" | "ready" | "metadata_only" | "failed";
    label: string;
    detail: string;
    updatedAt: string;
  };
  importMetadata?: {
    formatLabel: string;
    metadataQuality: "raw" | "structured" | "metadata_rich" | "unsupported";
    sheetName?: string;
    parserNotes: string[];
  };
  importedAt: string;
  rowCount: number;
  fieldCount: number;
  fields: ImportedDatasetField[];
  rows: Array<Record<string, string>>;
  previewRows: Array<Record<string, string>>;
  modelingStatus: "initial_model";
  notes: string[];
}

export interface DashboardDraft {
  id: string;
  title: string;
  status: DashboardStatus;
  publishMetadata: {
    publishedAt?: string;
    publishCount: number;
    versionLabel: string;
    publishedSnapshotId?: string;
    viewerPath?: string;
  };
  analysisLibrary: {
    variableSets: SavedVariableSet[];
    banners: SavedBanner[];
    filters: SavedFilterSet[];
    segments: SavedSegmentProfile[];
    weights: SavedWeightProfile[];
    templates: SavedAnalyticalTemplate[];
    derivedDefinitions: SavedDerivedDefinition[];
  };
  importedDatasets: ImportedDatasetRecord[];
  designLibrary: DesignLibrary;
  pages: DashboardPage[];
}

export interface DashboardReportRecord {
  id: string;
  title: string;
  draft: DashboardDraft;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
  archived?: boolean;
}

export interface PublishedDashboardSnapshot {
  id: string;
  reportId: string;
  title: string;
  versionLabel: string;
  publishedAt: string;
  viewerPath: string;
  dashboard: DashboardDraft;
}

export interface DashboardWorkspace {
  id: string;
  label: string;
  activeReportId: string;
  importedDatasets: ImportedDatasetRecord[];
  reports: DashboardReportRecord[];
  publishedSnapshots: PublishedDashboardSnapshot[];
}
