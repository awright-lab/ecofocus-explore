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

export interface DashboardTile {
  id: string;
  title: string;
  query: AnalyticsQueryRequest;
  visualization: ChartType;
  appearance: TileAppearance;
  result: AnalyticsQueryResponse;
}

export interface DashboardPage {
  id: string;
  title: string;
  order: number;
  tiles: DashboardTile[];
}

export interface DashboardDraft {
  id: string;
  title: string;
  status: DashboardStatus;
  pages: DashboardPage[];
}
