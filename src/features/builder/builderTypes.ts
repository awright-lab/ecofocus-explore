import type { DashboardCanvasElement, DashboardTile } from "../../../shared/types/dashboard";

export type DesignModal =
  | "pageBackground"
  | "pageGradient"
  | "elementGradient"
  | "tileGradient"
  | "barGradient"
  | "barColor"
  | "chartColors"
  | "labelSettings"
  | "barLayout"
  | "axisSettings"
  | "elementEffects"
  | "tileEffects"
  | null;

export type LeftPanelView = "pages" | "layers" | "insert" | "data" | "brand";
export type ExploreView = "source" | "analyze" | "library";
export type SourceLibraryView = "variableSets" | "questions";
export type AnalysisLibraryView = "variableSets" | "banners" | "filters" | "weights";
export type SettingsView = "home" | "page" | "layout" | "element" | "chart" | "container";
export type SavedLibraryHandoff = { view: AnalysisLibraryView; createdAt: number } | null;

export type LayerItem =
  | { id: string; type: "tile"; name: string; hidden: boolean; locked: boolean; zIndex: number }
  | { id: string; type: "element"; name: string; hidden: boolean; locked: boolean; zIndex: number };

export type EditorSelection = {
  selectedTileId: string | null;
  selectedElementId: string | null;
  selectedChartPartId: string;
  selectedTile: DashboardTile | null;
  selectedElement: DashboardCanvasElement | null;
};

export type EditorUiState = {
  leftPanelView: LeftPanelView;
  exploreView: ExploreView;
  sourceLibraryView: SourceLibraryView;
  analysisLibraryView: AnalysisLibraryView;
  savedLibraryHandoff: SavedLibraryHandoff;
  sourceSearch: string;
  settingsView: SettingsView;
  designModal: DesignModal;
  canvasZoom: number;
  viewerMode: boolean;
  saveState: string;
  isLoading: boolean;
  error: string | null;
};
