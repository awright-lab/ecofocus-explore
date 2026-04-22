import type { AnalyticsQueryRequest, AnalyticsQueryResponse, ChartType } from "./analytics";

export type DashboardStatus = "draft" | "published";

export interface TileAppearance {
  primaryColor: string;
  palette: string[];
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
  title: string;
  layout: CanvasLayout;
  query: AnalyticsQueryRequest;
  visualization: ChartType;
  appearance: TileAppearance;
  result: AnalyticsQueryResponse;
}

export type DashboardCanvasElementType = "text" | "rectangle" | "circle" | "image";

export interface DashboardCanvasElement {
  id: string;
  type: DashboardCanvasElementType;
  layout: CanvasLayout;
  content: string;
  style: {
    fill: string;
    textColor: string;
    borderColor: string;
    fontSize: number;
  };
}

export interface DashboardPage {
  id: string;
  title: string;
  order: number;
  elements: DashboardCanvasElement[];
  tiles: DashboardTile[];
}

export interface DashboardDraft {
  id: string;
  title: string;
  status: DashboardStatus;
  pages: DashboardPage[];
}
