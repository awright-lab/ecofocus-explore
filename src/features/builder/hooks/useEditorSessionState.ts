import { useState } from "react";
import { defaultQuestion } from "../builderConstants";
import { initialDashboard } from "../../document/documentSeeds";
import type {
  AnalysisLibraryView,
  DesignModal,
  ExploreView,
  LeftPanelView,
  RelatedObjectNavigationCue,
  ReportTreeSelectionCue,
  SavedLibraryInsertionCue,
  SavedLibraryHandoff,
  SavedSettingOriginCue,
  SettingsView,
  SourceLibraryView
} from "../builderTypes";
import type { DashboardDraft } from "../../../../shared/types/dashboard";

export function useEditorSessionState() {
  const [history, setHistory] = useState<DashboardDraft[]>([]);
  const [future, setFuture] = useState<DashboardDraft[]>([]);
  const [saveState, setSaveState] = useState("Saved locally");
  const [activePageId, setActivePageId] = useState("page_overview");
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [multiSelectedObjects, setMultiSelectedObjects] = useState<Array<{ id: string; type: "tile" | "element" }>>([]);
  const [selectedChartPartId, setSelectedChartPartId] = useState("all");
  const [leftPanelView, setLeftPanelView] = useState<LeftPanelView>("pages");
  const [exploreView, setExploreView] = useState<ExploreView>("source");
  const [sourceLibraryView, setSourceLibraryView] = useState<SourceLibraryView>("variableSets");
  const [analysisLibraryView, setAnalysisLibraryView] = useState<AnalysisLibraryView>("variableSets");
  const [savedLibraryHandoff, setSavedLibraryHandoff] = useState<SavedLibraryHandoff>(null);
  const [savedSettingOriginCue, setSavedSettingOriginCue] = useState<SavedSettingOriginCue>(null);
  const [relatedObjectNavigationCue, setRelatedObjectNavigationCue] = useState<RelatedObjectNavigationCue>(null);
  const [reportTreeSelectionCue, setReportTreeSelectionCue] = useState<ReportTreeSelectionCue>(null);
  const [savedLibraryInsertionCue, setSavedLibraryInsertionCue] = useState<SavedLibraryInsertionCue>(null);
  const [sourceSearch, setSourceSearch] = useState("");
  const [settingsView, setSettingsView] = useState<SettingsView>("home");
  const [designModal, setDesignModal] = useState<DesignModal>(null);
  const [canvasZoom, setCanvasZoom] = useState(85);
  const [viewerMode, setViewerMode] = useState(false);
  const [selectedDataSource, setSelectedDataSource] = useState<{ kind: "question" | "variableSet"; id: string }>({
    kind: "variableSet",
    id: initialDashboard.analysisLibrary.variableSets[0]?.id ?? defaultQuestion.id
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return {
    history,
    setHistory,
    future,
    setFuture,
    saveState,
    setSaveState,
    activePageId,
    setActivePageId,
    selectedTileId,
    setSelectedTileId,
    selectedElementId,
    setSelectedElementId,
    multiSelectedObjects,
    setMultiSelectedObjects,
    selectedChartPartId,
    setSelectedChartPartId,
    leftPanelView,
    setLeftPanelView,
    exploreView,
    setExploreView,
    sourceLibraryView,
    setSourceLibraryView,
    analysisLibraryView,
    setAnalysisLibraryView,
    savedLibraryHandoff,
    setSavedLibraryHandoff,
    savedSettingOriginCue,
    setSavedSettingOriginCue,
    relatedObjectNavigationCue,
    setRelatedObjectNavigationCue,
    reportTreeSelectionCue,
    setReportTreeSelectionCue,
    savedLibraryInsertionCue,
    setSavedLibraryInsertionCue,
    sourceSearch,
    setSourceSearch,
    settingsView,
    setSettingsView,
    designModal,
    setDesignModal,
    canvasZoom,
    setCanvasZoom,
    viewerMode,
    setViewerMode,
    selectedDataSource,
    setSelectedDataSource,
    isLoading,
    setIsLoading,
    error,
    setError
  };
}
