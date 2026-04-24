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
    kind: "question" | "variableSet";
    id: string;
    label: string;
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
}

export interface DashboardPage {
  id: string;
  title: string;
  order: number;
  showCanvasGrid: boolean;
  snapToGrid: boolean;
  gridSize: number;
  background: string;
  backgroundMode: "solid" | "gradient" | "image";
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

export interface SavedWeightProfile {
  id: string;
  datasetId: DatasetId;
  label: string;
  description: string;
  weight: WeightId | null;
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

export interface PageTemplatePreset {
  id: string;
  label: string;
  description: string;
  pageThemeId: string;
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
  pageThemes: PageThemePreset[];
  pageTemplates: PageTemplatePreset[];
}

export interface DashboardDraft {
  id: string;
  title: string;
  status: DashboardStatus;
  analysisLibrary: {
    variableSets: SavedVariableSet[];
    banners: SavedBanner[];
    filters: SavedFilterSet[];
    weights: SavedWeightProfile[];
  };
  designLibrary: DesignLibrary;
  pages: DashboardPage[];
}
