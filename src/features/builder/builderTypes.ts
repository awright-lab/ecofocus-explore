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
export type AnalysisLibraryView = "variableSets" | "templates" | "derivedOutputs" | "banners" | "filters" | "weights";
export type SettingsView = "home" | "page" | "layout" | "element" | "chart" | "container";
export type MultiSelectedObject = { id: string; type: "tile" | "element" };
export type SavedLibraryHandoff = { view: AnalysisLibraryView; createdAt: number } | null;
export type SavedSettingOriginKind = "banner" | "filter" | "weight";
export type SavedSettingOriginCue = {
  tileId: string;
  kind: SavedSettingOriginKind;
  label: string;
  status: "applied" | "refreshed";
  createdAt: number;
} | null;
export type RelatedObjectNavigationCue = {
  tileId: string;
  fromTileId: string;
  fromTitle: string;
  targetTitle: string;
  relationship: "canonical" | "derived" | "sibling";
  createdAt: number;
} | null;
export type ReportTreeSelectionCue = {
  objectId: string;
  objectKind: "tile" | "element";
  objectLabel: string;
  objectType: string;
  pageId: string;
  pageTitle: string;
  createdAt: number;
} | null;
export type SavedLibraryInsertionCue = {
  tileId: string;
  sourceKind: "variableSet" | "analyticalTemplate";
  sourceLabel: string;
  objectLabel: string;
  sourceSummary?: string;
  templateDifferenceLabels?: string[];
  createdAt: number;
} | null;
export type DerivedOutputCreationCue = {
  tileId: string;
  sourceTileId: string;
  sourceTitle: string;
  outputKind: NonNullable<DashboardTile["derivedOutput"]>["kind"];
  createdAt: number;
} | null;
export type DerivedOutputRecreationCue = {
  tileId: string;
  sourceTitle: string;
  outputKind: NonNullable<DashboardTile["derivedOutput"]>["kind"];
  readinessLabel: string;
  createdAt: number;
} | null;

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
  savedSettingOriginCue: SavedSettingOriginCue;
  relatedObjectNavigationCue: RelatedObjectNavigationCue;
  reportTreeSelectionCue: ReportTreeSelectionCue;
  savedLibraryInsertionCue: SavedLibraryInsertionCue;
  derivedOutputCreationCue: DerivedOutputCreationCue;
  derivedOutputRecreationCue: DerivedOutputRecreationCue;
  sourceSearch: string;
  settingsView: SettingsView;
  designModal: DesignModal;
  canvasZoom: number;
  viewerMode: boolean;
  saveState: string;
  isLoading: boolean;
  error: string | null;
};
