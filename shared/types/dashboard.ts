import type { AnalyticsQueryRequest, AnalyticsQueryResponse, ChartType } from "./analytics";

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
  gridColor: string;
  axisColor: string;
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
  barGradientStops: GradientStop[];
  barStyles: Record<
    string,
    {
      color: string;
      fillMode: "solid" | "gradient";
      gradientTo: string;
      gradientType?: GradientType;
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
  backgroundMode: "solid" | "gradient";
  gradientFrom: string;
  gradientTo: string;
  gradientType: GradientType;
  gradientStops: GradientStop[];
  elements: DashboardCanvasElement[];
  tiles: DashboardTile[];
}

export interface DashboardDraft {
  id: string;
  title: string;
  status: DashboardStatus;
  pages: DashboardPage[];
}
