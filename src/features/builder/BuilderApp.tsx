import { useEffect, useMemo, useRef, useState } from "react";
import {
  axisFontSizePresets,
  bannerDimensions,
  canvasHeight,
  canvasWidth,
  comparisonDatasetOptions,
  defaultBreakBy,
  defaultDataset,
  defaultFilterDimension,
  defaultQuestion,
  datasets,
  filterDimensions,
  storageKey
} from "./builderConstants";
import { downloadDashboardExportSpec } from "./builderExportPackage";
import { BuilderHeader, BuilderPanel, ToolRail } from "./components/BuilderChrome";
import { BuilderDesignModal } from "./components/BuilderDesignModal";
import { AnalysisAuthoringPanel } from "./components/AnalysisAuthoringPanel";
import { BuilderInspector } from "./components/BuilderInspector";
import {
  CanvasElementRenderer,
  TileRenderer,
  comparisonSummaryLabel,
  confidenceLevelLabel,
  getDocumentColors,
  gradientStylePresets,
  tileSourceKindLabel,
} from "./components/CanvasRenderers";
import { CanvasWorkspace } from "./components/CanvasWorkspace";
import { defaultVisualizationForQuestion, getChartTypeLabel, getCompatibleChartTypes, getQuestionLabel } from "../analytics/analyticsDisplay";
import { useAnalysisAuthoring } from "../analytics/useAnalysisAuthoring";
import { useBuilderDocumentSessionCommands } from "./hooks/useBuilderDocumentSessionCommands";
import { useEditorSessionState } from "./hooks/useEditorSessionState";
import { useBuilderDesignCommands } from "./hooks/useBuilderDesignCommands";
import { useBuilderTileCommands } from "./hooks/useBuilderTileCommands";
import { publishMetadataLabel } from "./builderPublishModel";
import {
  applyGradientStylePreset,
  backgroundStyle,
  canvasBackground,
  canvasBackgroundPosition,
  canvasBackgroundRepeat,
  canvasBackgroundSize,
  colorAlpha,
  hexToRgbObject,
  hslToRgb,
  normalizeGradientStops,
  normalizeHexColor,
  protectedGradientEndpointIds,
  rgbToHex,
  rgbToHsl,
  rgbToHsv,
  setHexAlpha,
  stripHexAlpha,
  svgLinearGradientVector,
  themePreviewBackground,
  hsvToRgb
} from "./builderHelpers";
import {
  defaultVariableSetRows,
  initialDashboard,
  normalizeVariableSetRows,
  rowKindLabel,
} from "../document/documentSeeds";
import { normalizeDashboard } from "../document/documentModel";
import type {
  AnalysisLibraryView,
  DesignModal,
  ExploreView,
  LayerItem,
  LeftPanelView,
  SettingsView,
  SourceLibraryView
} from "./builderTypes";
import type {
  AnalyticsQueryRequest,
  AnalyticsQueryResponse,
  BreakById,
  ChartType,
  ComparisonMode,
  DatasetId,
  FilterFieldId,
  Metric,
  QuestionId,
  WeightId
} from "../../../shared/types/analytics";
import type {
  DashboardDraft,
  GradientStop,
  GradientType,
  SavedAnalyticalTemplate,
  SavedBanner,
  SavedFilterSet,
  SavedVariableSet,
  SavedWeightProfile,
} from "../../../shared/types/dashboard";

export default function BuilderApp() {
  const designModalRef = useRef<HTMLDivElement | null>(null);
  const [dashboard, setDashboardState] = useState<DashboardDraft>(() => {
    try {
      const savedDashboard = window.localStorage.getItem(storageKey);
      return savedDashboard ? normalizeDashboard(JSON.parse(savedDashboard) as DashboardDraft) : initialDashboard;
    } catch {
      return initialDashboard;
    }
  });
  const {
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
    derivedOutputCreationCue,
    setDerivedOutputCreationCue,
    derivedOutputRecreationCue,
    setDerivedOutputRecreationCue,
    derivedOutputLibraryActionCue,
    setDerivedOutputLibraryActionCue,
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
  } = useEditorSessionState();
  const designPalettes = dashboard.designLibrary.palettes;
  const textStylePresets = dashboard.designLibrary.textStyles;
  const textBlockPresets = dashboard.designLibrary.textBlocks;
  const pageThemes = dashboard.designLibrary.pageThemes;
  const pageTemplates = dashboard.designLibrary.pageTemplates;
  const pageMasters = dashboard.designLibrary.pageMasters;
  const sortedPages = [...dashboard.pages].sort((a, b) => a.order - b.order);
  const activePage = sortedPages.find((page) => page.id === activePageId) ?? sortedPages[0];
  const selectedTile = activePage?.tiles.find((tile) => tile.id === selectedTileId) ?? null;
  const selectedElement = activePage?.elements.find((element) => element.id === selectedElementId) ?? null;
  const activeMultiSelectedObjects = multiSelectedObjects.filter((item) =>
    item.type === "tile"
      ? activePage.tiles.some((tile) => tile.id === item.id)
      : activePage.elements.some((element) => element.id === item.id)
  );
  const selectedTextElement = selectedElement?.type === "text" ? selectedElement : null;
  const selectedTileQuestion = selectedTile
    ? defaultDataset.questions.find((item) => item.id === selectedTile.query.question) ?? defaultQuestion
    : null;
  const selectedTileFilterDimension =
    selectedTile?.query.filters[0]?.field ? filterDimensions.find((item) => item.id === selectedTile.query.filters[0]?.field) : undefined;
  const chartStyleTargets =
    selectedTile && ["vertical_bar", "horizontal_bar", "donut"].includes(selectedTile.visualization)
      ? selectedTile.result.table.map((row) => ({ id: row.optionId, label: row.label }))
      : selectedTile?.result.columns.map((column) => ({ id: column.id, label: column.label })) ?? [];
  const selectedChartPart = selectedChartPartId === "all" ? null : chartStyleTargets.find((target) => target.id === selectedChartPartId) ?? null;
  const canvasScale = canvasZoom / 100;
  const layerItems: LayerItem[] = [
    ...activePage.tiles.map((tile) => ({
      id: tile.id,
      type: "tile" as const,
      name: tile.name,
      hidden: tile.hidden,
      locked: tile.locked,
      zIndex: tile.layout.zIndex
    })),
    ...activePage.elements.map((element) => ({
      id: element.id,
      type: "element" as const,
      name: element.name,
      hidden: element.hidden,
      locked: element.locked,
      zIndex: element.layout.zIndex
    }))
  ].sort((a, b) => b.zIndex - a.zIndex);

  function saveSelectedTileVariableSet() {
    if (!selectedTile || !selectedTileQuestion) return;

    const sourceQuestionIds =
      selectedTile.source?.kind === "variableSet"
        ? savedVariableSets.find((item) => item.id === selectedTile.source?.id)?.questionIds ?? [selectedTileQuestion.id]
        : [selectedTileQuestion.id];

    const nextVariableSet: SavedVariableSet = {
      id: `variable_set_${Date.now()}`,
      datasetId: defaultDataset.id,
      label: selectedTile.title.trim() || selectedTileQuestion.shortLabel,
      description: `Saved from tile: ${selectedTile.title.trim() || selectedTileQuestion.shortLabel}`,
      topic: selectedTileQuestion.topic,
      questionIds: sourceQuestionIds,
      primaryQuestionId: selectedTileQuestion.id,
      rowMode: "authored",
      rows:
        selectedTile.source?.kind === "variableSet"
          ? savedVariableSets.find((item) => item.id === selectedTile.source?.id)?.rows ?? defaultVariableSetRows(selectedTileQuestion.id)
          : defaultVariableSetRows(selectedTileQuestion.id),
      breakBy: selectedTile.query.breakBy,
      metric: selectedTile.query.metric,
      chartType: selectedTile.visualization,
      comparisonMode: selectedTile.query.comparisonMode ?? "none",
      comparisonDatasets: selectedTile.query.comparisonDatasets ?? [],
      weight: selectedTile.query.weight,
      filterField: (selectedTile.query.filters[0]?.field as FilterFieldId | undefined) ?? null,
      filterValue: selectedTile.query.filters[0]?.values[0] ?? "all"
    };

    setDashboard((current) => ({
      ...current,
      status: "draft",
      analysisLibrary: {
        ...current.analysisLibrary,
        variableSets: [nextVariableSet, ...current.analysisLibrary.variableSets]
      }
    }));
    setError(null);
  }

  function saveSelectedTileBanner() {
    if (!selectedTile) return;

    const nextBanner: SavedBanner = {
      id: `banner_${Date.now()}`,
      datasetId: defaultDataset.id,
      label: `${selectedTile.title.trim() || "Tile"} banner`,
      description: `Saved from tile: ${bannerDimensions.find((item) => item.id === selectedTile.query.breakBy)?.label ?? selectedTile.query.breakBy}`,
      breakBy: selectedTile.query.breakBy
    };

    setDashboard((current) => ({
      ...current,
      status: "draft",
      analysisLibrary: {
        ...current.analysisLibrary,
        banners: [nextBanner, ...current.analysisLibrary.banners]
      }
    }));
    setError(null);
  }

  function saveSelectedTileFilter() {
    if (!selectedTile) return;

    const nextFilter: SavedFilterSet = {
      id: `filter_${Date.now()}`,
      datasetId: defaultDataset.id,
      label: `${selectedTile.title.trim() || "Tile"} filter`,
      description:
        selectedTile.query.filters[0]?.field && selectedTile.query.filters[0]?.values[0] !== "all"
          ? `Saved from tile filter for ${filterDimensions.find((item) => item.id === selectedTile.query.filters[0]?.field)?.label ?? selectedTile.query.filters[0]?.field}`
          : "No segment filter applied.",
      filterField: (selectedTile.query.filters[0]?.field as FilterFieldId | undefined) ?? null,
      filterValue: selectedTile.query.filters[0]?.values[0] ?? "all"
    };

    setDashboard((current) => ({
      ...current,
      status: "draft",
      analysisLibrary: {
        ...current.analysisLibrary,
        filters: [nextFilter, ...current.analysisLibrary.filters]
      }
    }));
    setError(null);
  }

  function saveSelectedTileWeight() {
    if (!selectedTile) return;

    const nextWeight: SavedWeightProfile = {
      id: `weight_${Date.now()}`,
      datasetId: defaultDataset.id,
      label: `${selectedTile.title.trim() || "Tile"} weight`,
      description: selectedTile.query.weight
        ? `Uses ${defaultDataset.weights.find((item) => item.id === selectedTile.query.weight)?.label ?? selectedTile.query.weight}`
        : "No weight applied.",
      weight: selectedTile.query.weight
    };

    setDashboard((current) => ({
      ...current,
      status: "draft",
      analysisLibrary: {
        ...current.analysisLibrary,
        weights: [nextWeight, ...current.analysisLibrary.weights]
      }
    }));
    setError(null);
  }

  function saveSelectedTileAnalyticalTemplate() {
    if (!selectedTile || !selectedTileQuestion) return;

    const tileTitle = selectedTile.title.trim() || selectedTileQuestion.shortLabel;
    const activeFilter = selectedTile.query.filters[0];
    const activeFilterField = activeFilter ? filterDimensions.find((item) => item.id === activeFilter.field) : undefined;
    const activeFilterValue = activeFilterField && activeFilter ? activeFilterField.values.find((item) => item.id === activeFilter.values[0]) : undefined;
    const comparisonDatasetsLabel =
      selectedTile.query.comparisonMode === "wave" && selectedTile.query.comparisonDatasets?.length
        ? selectedTile.query.comparisonDatasets
            .map((datasetId) => comparisonDatasetOptions.find((item) => item.id === datasetId)?.label ?? datasetId)
            .join(", ")
        : "";
    const source = selectedTile.source ?? {
      kind: "question" as const,
      id: selectedTileQuestion.id,
      label: selectedTileQuestion.shortLabel
    };
    const nextTemplate: SavedAnalyticalTemplate = {
      id: `analysis_template_${Date.now()}`,
      datasetId: selectedTile.query.dataset,
      label: `${tileTitle} template`,
      description: `Saved analytical setup from tile: ${tileTitle}`,
      source,
      query: {
        ...selectedTile.query,
        chartType: selectedTile.visualization,
        confidenceLevel: selectedTile.query.confidenceLevel ?? 0.95
      },
      visualization: selectedTile.visualization,
      summary: {
        sourceLabel: source.label,
        bannerLabel: bannerDimensions.find((item) => item.id === selectedTile.query.breakBy)?.label ?? selectedTile.query.breakBy,
        filterLabel:
          activeFilter && activeFilter.values[0] !== "all"
            ? `${activeFilterField?.label ?? activeFilter.field}: ${activeFilterValue?.label ?? activeFilter.values[0]}`
            : "No filter",
        weightLabel: selectedTile.query.weight
          ? defaultDataset.weights.find((item) => item.id === selectedTile.query.weight)?.label ?? selectedTile.query.weight
          : "Unweighted",
        confidenceLabel: `${Math.round((selectedTile.query.confidenceLevel ?? 0.95) * 100)}% confidence`,
        comparisonLabel: comparisonDatasetsLabel ? `Wave comparison: ${comparisonDatasetsLabel}` : "No wave comparison"
      }
    };

    setDashboard((current) => ({
      ...current,
      status: "draft",
      analysisLibrary: {
        ...current.analysisLibrary,
        templates: [nextTemplate, ...current.analysisLibrary.templates]
      }
    }));
    setError(null);
  }

  function viewSavedSettingInLibrary(view: AnalysisLibraryView, handoff?: { action?: "derivedDefinitionSaved"; itemId?: string }) {
    setLeftPanelView("data");
    setExploreView("library");
    setAnalysisLibraryView(view);
    setSavedLibraryHandoff({ view, ...handoff, createdAt: Date.now() });
  }

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(dashboard));
    setSaveState("Saved locally");
  }, [dashboard]);

  useEffect(() => {
    if (dashboard.status !== "published") {
      setViewerMode(false);
    }
  }, [dashboard.status]);

  useEffect(() => {
    if (!designModal) return;
    designModalRef.current?.scrollTo({ top: 0 });
  }, [designModal]);

  const {
    setDashboard,
    undo,
    redo,
    updateSelectedTile,
    updateTile,
    updateTileLayout,
    updateSelectedElement,
    updateElement,
    updateElementLayout,
    selectLayer,
    selectTile,
    selectElement,
    selectPage,
    toggleMultiSelectedObject,
    clearMultiSelection,
    setMultiSelectedHidden,
    setMultiSelectedLocked,
    alignMultiSelected,
    changeSelectedLayer,
    addCanvasElement,
    addTextBlockPreset,
    updateActivePage,
    renamePage,
    addPage,
    applyPageMasterLayout,
    duplicateActivePage,
    duplicatePageById,
    deleteActivePage,
    deletePageById,
    movePage,
    deleteSelectedItem,
    duplicateSelectedItem,
    resetDashboard,
    chooseLayer,
    updateCanvasZoom,
    publishDashboard,
    unpublishDashboard,
    openPublishedReport,
    closePublishedReport
  } = useBuilderDocumentSessionCommands({
    dashboard,
    setDashboardState,
    history,
    setHistory,
    future,
    setFuture,
    setSaveState,
    activePage,
    sortedPages,
    pageMasters,
    pageThemes,
    selectedTile,
    selectedElement,
    selectedTileId,
    selectedElementId,
    multiSelectedObjects: activeMultiSelectedObjects,
    setActivePageId,
    setSelectedTileId,
    setSelectedElementId,
    setMultiSelectedObjects,
    setSelectedChartPartId,
    setSettingsView,
    setLeftPanelView,
    setCanvasZoom,
    setViewerMode
  });

  const {
    question,
    setQuestion,
    breakBy,
    setBreakBy,
    metric,
    setMetric,
    chartType,
    setChartType,
    weight,
    setWeight,
    filterField,
    setFilterField,
    filterValue,
    setFilterValue,
    comparisonMode,
    setComparisonMode,
    comparisonDatasets,
    setComparisonDatasets,
    weightDraftName,
    setWeightDraftName,
    variableSetDraftName,
    setVariableSetDraftName,
    variableSetDescription,
    setVariableSetDescription,
    variableSetQuestionIds,
    setVariableSetQuestionIds,
    variableSetRows,
    setVariableSetRows,
    variableSetOptionSelection,
    setVariableSetOptionSelection,
    bannerDraftName,
    setBannerDraftName,
    filterDraftName,
    setFilterDraftName,
    savedVariableSets,
    savedBanners,
    savedFilters,
    savedWeights,
    savedAnalyticalTemplates,
    savedDerivedDefinitions,
    saveAnalyticalTemplate,
    deleteAnalyticalTemplate,
    saveDerivedDefinition,
    deleteDerivedDefinition,
    selectedQuestion,
    selectedVariableSet,
    filteredVariableSets,
    filteredQuestions,
    selectedFilterDimension,
    selectedChartTypes,
    query,
    toggleComparisonDataset,
    applyQuestionSelection,
    applyVariableSetSelection,
    saveCurrentVariableSet,
    deleteVariableSet,
    toggleVariableSetQuestion,
    reorderVariableSetRow,
    updateVariableSetRow,
    removeVariableSetRow,
    toggleVariableSetOptionRow,
    toggleVariableSetOptionSelection,
    addVariableSetNet,
    addRowsForUncoveredOptions,
    resetVariableSetRows,
    markVariableSetRowsAsDetails,
    revealAllVariableSetRows,
    applySavedBanner,
    saveCurrentBanner,
    applySavedFilter,
    saveCurrentFilter,
    applySavedWeight,
    saveCurrentWeight
  } = useAnalysisAuthoring({
    dashboard,
    setDashboard,
    sourceSearch,
    selectedDataSource,
    setSelectedDataSource,
    setError
  });

  useEffect(() => {
    if (selectedVariableSet) {
      setVariableSetDraftName(selectedVariableSet.label);
      setVariableSetDescription(selectedVariableSet.description);
      setVariableSetQuestionIds(selectedVariableSet.questionIds);
      return;
    }

    setVariableSetDraftName(selectedQuestion.shortLabel);
    setVariableSetDescription(`Saved view for ${selectedQuestion.shortLabel}`);
    setVariableSetQuestionIds([selectedQuestion.id]);
  }, [selectedQuestion.id, selectedQuestion.shortLabel, selectedVariableSet]);

  useEffect(() => {
    setBannerDraftName(bannerDimensions.find((item) => item.id === breakBy)?.label ?? "Saved banner");
  }, [breakBy]);

  useEffect(() => {
    if (!filterField || filterValue === "all") {
      setFilterDraftName("All shopper segments");
      return;
    }

    const field = filterDimensions.find((item) => item.id === filterField);
    const value = field?.values.find((item) => item.id === filterValue);
    setFilterDraftName(value?.label ?? field?.label ?? "Saved filter");
  }, [filterField, filterValue]);

  useEffect(() => {
    setWeightDraftName(weight ? defaultDataset.weights.find((item) => item.id === weight)?.label ?? "Saved weight" : "Unweighted sample");
  }, [weight]);

  const {
    startDataSourceDrag,
    handleCanvasDrop,
    addTileFromQuery,
    addTileFromSourceWithVisualization,
    addTileFromVariableSet,
    addTileFromAnalyticalTemplate,
    rerunTileAnalysis,
    tileWithVisualization,
    duplicateTileAsVisualization,
    duplicateDerivedOutputTile,
    duplicateDerivedOutputFromLibrary,
    createDerivedOutputTile,
    createDerivedOutputFromDefinition,
    recreateDerivedOutputTile
  } = useBuilderTileCommands({
    activePage,
    canvasScale,
    query,
    selectedQuestion,
    selectedVariableSet,
    savedVariableSets,
    selectedTile,
    selectedElement,
    setDashboard,
    selectTile,
    setActivePageId,
    updateTile,
    applyQuestionSelection,
    applyVariableSetSelection,
    recordDerivedOutputCreationCue: (cue) => setDerivedOutputCreationCue({ ...cue, createdAt: Date.now() }),
    recordDerivedOutputRecreationCue: (cue) => setDerivedOutputRecreationCue({ ...cue, createdAt: Date.now() }),
    setIsLoading,
    setError
  });

  function exportDashboardSpec() {
    downloadDashboardExportSpec(dashboard, sortedPages);
  }

  const {
    applyPaletteToTile,
    applyTextStylePresetToSelection,
    applyPageTheme,
    updateSelectedAppearance,
    applySelectedElementEffectPreset,
    applySelectedTileEffectPreset,
    updateSelectedBarStyle,
    clearBarColorOverrides,
    applyPalettePresetToBars,
    applyPaletteColorToSelectedBar,
    applySolidColorToBars,
    updateSelectedAxisLabel,
    updateSelectedLayout,
    alignSelected,
    applyLayoutPreset
  } = useBuilderDesignCommands({
    activePage,
    selectedTile,
    selectedTileId,
    selectedElement,
    selectedTextElement,
    selectedChartPart,
    setDashboard,
    updateActivePage,
    updateSelectedTile,
    updateSelectedElement,
    updateTileLayout,
    updateElementLayout
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isEditingText = target?.tagName === "INPUT" || target?.tagName === "SELECT" || target?.tagName === "TEXTAREA";

      if (isEditingText) return;

      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key) && (selectedTile || selectedElement)) {
        event.preventDefault();
        const layout = selectedTile?.layout ?? selectedElement?.layout;
        if (!layout) return;

        const distance = event.shiftKey ? activePage.gridSize : activePage.snapToGrid ? activePage.gridSize : 1;
        const nextPosition = {
          x: event.key === "ArrowLeft" ? layout.x - distance : event.key === "ArrowRight" ? layout.x + distance : layout.x,
          y: event.key === "ArrowUp" ? layout.y - distance : event.key === "ArrowDown" ? layout.y + distance : layout.y
        };
        updateSelectedLayout({
          x: Math.max(0, nextPosition.x),
          y: Math.max(0, nextPosition.y)
        });
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelectedItem();
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        duplicateSelectedItem();
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      }

      if ((event.metaKey || event.ctrlKey) && (event.key.toLowerCase() === "y" || (event.shiftKey && event.key.toLowerCase() === "z"))) {
        event.preventDefault();
        redo();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dashboard, history, future, selectedTile, selectedElement, activePage]);

  if (viewerMode) {
    return (
      <main className="published-shell">
        <header className="published-header">
          <div className="published-header__copy">
            <span className="published-kicker">{dashboard.status === "published" ? "Published report" : "Report preview"}</span>
            <h1>{dashboard.title}</h1>
            <small className="published-version-cue">{publishMetadataLabel(dashboard)}</small>
          </div>
          <div className="published-header__actions">
            <span className="status published">{dashboard.status}</span>
            <button type="button" className="secondary" onClick={closePublishedReport}>Back to builder</button>
            {dashboard.status === "published" && (
              <button type="button" className="secondary" onClick={unpublishDashboard}>Unpublish</button>
            )}
          </div>
        </header>

        <section className="published-body">
          <nav className="published-page-nav" aria-label="Published pages">
            {sortedPages.map((page) => (
              <button
                type="button"
                key={page.id}
                className={page.id === activePage.id ? "published-page-tab active" : "published-page-tab"}
                onClick={() => setActivePageId(page.id)}
              >
                <span>{page.order}</span>
                {page.title}
              </button>
            ))}
          </nav>

          <div className="published-stage-wrap">
            <div className="published-page-header">
              <div>
                <p className="eyebrow">Page {activePage.order}</p>
                <h2>{activePage.title}</h2>
              </div>
              <span className="published-page-meta">
                {activePage.tiles.filter((tile) => !tile.hidden).length} tile{activePage.tiles.filter((tile) => !tile.hidden).length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="published-stage-scroll">
              <div
                className="published-canvas"
                style={{
                  width: canvasWidth,
                  height: canvasHeight,
                  background: canvasBackground(activePage),
                  backgroundSize: canvasBackgroundSize(activePage),
                  backgroundRepeat: canvasBackgroundRepeat(activePage),
                  backgroundPosition: canvasBackgroundPosition(activePage)
                }}
              >
                {activePage.elements.filter((element) => !element.hidden).map((element) => (
                  <div
                    key={element.id}
                    className="published-canvas-item"
                    style={{
                      left: element.layout.x,
                      top: element.layout.y,
                      width: element.layout.width,
                      height: element.layout.height,
                      zIndex: element.layout.zIndex
                    }}
                  >
                    <CanvasElementRenderer element={element} selected={false} onSelect={() => undefined} />
                  </div>
                ))}
                {activePage.tiles.filter((tile) => !tile.hidden).map((tile) => (
                  <div
                    key={tile.id}
                    className="published-canvas-item"
                    style={{
                      left: tile.layout.x,
                      top: tile.layout.y,
                      width: tile.layout.width,
                      height: tile.layout.height,
                      zIndex: tile.layout.zIndex
                    }}
                  >
                    <TileRenderer tile={tile} selected={false} onSelect={() => undefined} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="builder-shell">
      <BuilderHeader
        dashboard={dashboard}
        saveState={saveState}
        canUndo={history.length > 0}
        canRedo={future.length > 0}
        canUseSelection={Boolean(selectedTile || selectedElement)}
        onUndo={undo}
        onRedo={redo}
        onDuplicate={duplicateSelectedItem}
        onDelete={deleteSelectedItem}
        onReset={resetDashboard}
        onExport={exportDashboardSpec}
        onOpenPublished={openPublishedReport}
        onPublish={publishDashboard}
        onUnpublish={unpublishDashboard}
      />

      <section className="builder-workspace">
        <ToolRail activeView={leftPanelView} onChange={setLeftPanelView} />
        <AnalysisAuthoringPanel
          leftPanelView={leftPanelView}
          setLeftPanelView={setLeftPanelView}
          layerItems={layerItems}
          selectedTileId={selectedTileId}
          selectedElementId={selectedElementId}
          multiSelectedObjects={activeMultiSelectedObjects}
          toggleMultiSelectedObject={toggleMultiSelectedObject}
          clearMultiSelection={clearMultiSelection}
          chooseLayer={chooseLayer}
          selectTile={selectTile}
          selectElement={selectElement}
          recordReportTreeSelectionCue={(cue) => setReportTreeSelectionCue({ ...cue, createdAt: Date.now() })}
          recordSavedLibraryInsertionCue={(cue) => setSavedLibraryInsertionCue({ ...cue, createdAt: Date.now() })}
          updateTile={updateTile}
          updateElement={updateElement}
          sortedPages={sortedPages}
          activePage={activePage}
          setActivePageId={setActivePageId}
          selectPage={selectPage}
          renamePage={renamePage}
          addPage={addPage}
          duplicateActivePage={duplicateActivePage}
          duplicatePageById={duplicatePageById}
          deleteActivePage={deleteActivePage}
          deletePageById={deletePageById}
          movePage={movePage}
          pageTemplates={pageTemplates}
          pageThemes={pageThemes}
          selectedTextElement={selectedTextElement}
          selectedTile={selectedTile}
          focusSelectedTileInspector={() => setSettingsView("chart")}
          recordSavedSettingOriginCue={(kind, label, tileId) => setSavedSettingOriginCue({ kind, label, tileId, status: "applied", createdAt: Date.now() })}
          recordDerivedOutputLibraryActionCue={(cue) => setDerivedOutputLibraryActionCue({ ...cue, createdAt: Date.now() })}
          designPalettes={designPalettes}
          applyPaletteToTile={applyPaletteToTile}
          textStylePresets={textStylePresets}
          applyTextStylePresetToSelection={applyTextStylePresetToSelection}
          textBlockPresets={textBlockPresets}
          addTextBlockPreset={addTextBlockPreset}
          applyPageTheme={applyPageTheme}
          exploreView={exploreView}
          setExploreView={setExploreView}
          sourceLibraryView={sourceLibraryView}
          setSourceLibraryView={setSourceLibraryView}
          analysisLibraryView={analysisLibraryView}
          setAnalysisLibraryView={setAnalysisLibraryView}
          savedLibraryHandoff={savedLibraryHandoff}
          sourceSearch={sourceSearch}
          setSourceSearch={setSourceSearch}
          filteredVariableSets={filteredVariableSets}
          filteredQuestions={filteredQuestions}
          selectedDataSource={selectedDataSource}
          applyVariableSetSelection={applyVariableSetSelection}
          applyQuestionSelection={applyQuestionSelection}
          startDataSourceDrag={startDataSourceDrag}
          selectedVariableSet={selectedVariableSet}
          question={question}
          setQuestion={setQuestion}
          variableSetDraftName={variableSetDraftName}
          setVariableSetDraftName={setVariableSetDraftName}
          variableSetDescription={variableSetDescription}
          setVariableSetDescription={setVariableSetDescription}
          variableSetQuestionIds={variableSetQuestionIds}
          toggleVariableSetQuestion={toggleVariableSetQuestion}
          selectedQuestion={selectedQuestion}
          resetVariableSetRows={resetVariableSetRows}
          revealAllVariableSetRows={revealAllVariableSetRows}
          markVariableSetRowsAsDetails={markVariableSetRowsAsDetails}
          variableSetRows={variableSetRows}
          variableSetOptionSelection={variableSetOptionSelection}
          toggleVariableSetOptionRow={toggleVariableSetOptionRow}
          toggleVariableSetOptionSelection={toggleVariableSetOptionSelection}
          addVariableSetNet={addVariableSetNet}
          addRowsForUncoveredOptions={addRowsForUncoveredOptions}
          updateVariableSetRow={updateVariableSetRow}
          reorderVariableSetRow={reorderVariableSetRow}
          removeVariableSetRow={removeVariableSetRow}
          saveCurrentVariableSet={saveCurrentVariableSet}
          deleteVariableSet={deleteVariableSet}
          savedBanners={savedBanners}
          savedFilters={savedFilters}
          savedWeights={savedWeights}
          savedAnalyticalTemplates={savedAnalyticalTemplates}
          savedDerivedDefinitions={savedDerivedDefinitions}
          saveAnalyticalTemplate={saveAnalyticalTemplate}
          deleteAnalyticalTemplate={deleteAnalyticalTemplate}
          saveDerivedDefinition={saveDerivedDefinition}
          deleteDerivedDefinition={deleteDerivedDefinition}
          duplicateDerivedOutputFromLibrary={duplicateDerivedOutputFromLibrary}
          createDerivedOutputFromDefinition={createDerivedOutputFromDefinition}
          savedVariableSets={savedVariableSets}
          breakBy={breakBy}
          setBreakBy={setBreakBy}
          metric={metric}
          setMetric={setMetric}
          chartType={chartType}
          setChartType={setChartType}
          weight={weight}
          setWeight={setWeight}
          filterField={filterField}
          setFilterField={setFilterField}
          filterValue={filterValue}
          setFilterValue={setFilterValue}
          comparisonMode={comparisonMode}
          setComparisonMode={setComparisonMode}
          comparisonDatasets={comparisonDatasets}
          setComparisonDatasets={setComparisonDatasets}
          toggleComparisonDataset={toggleComparisonDataset}
          selectedFilterDimension={selectedFilterDimension}
          selectedChartTypes={selectedChartTypes}
          query={query}
          setVariableSetRows={setVariableSetRows}
          setVariableSetOptionSelection={setVariableSetOptionSelection}
          addCanvasElement={addCanvasElement}
          addTileFromQuery={addTileFromQuery}
          addTileFromSourceWithVisualization={addTileFromSourceWithVisualization}
          addTileFromVariableSet={addTileFromVariableSet}
          addTileFromAnalyticalTemplate={addTileFromAnalyticalTemplate}
          isLoading={isLoading}
          applySavedBanner={applySavedBanner}
          bannerDraftName={bannerDraftName}
          setBannerDraftName={setBannerDraftName}
          saveCurrentBanner={saveCurrentBanner}
          applySavedFilter={applySavedFilter}
          filterDraftName={filterDraftName}
          setFilterDraftName={setFilterDraftName}
          saveCurrentFilter={saveCurrentFilter}
          applySavedWeight={applySavedWeight}
          weightDraftName={weightDraftName}
          setWeightDraftName={setWeightDraftName}
          saveCurrentWeight={saveCurrentWeight}
          error={error}
        />

        <CanvasWorkspace
          activePage={activePage}
          sortedPages={sortedPages}
          canvasScale={canvasScale}
          canvasZoom={canvasZoom}
          selectedTileId={selectedTileId}
          selectedElementId={selectedElementId}
          hasSelection={Boolean(selectedTile || selectedElement)}
          canvasBackground={canvasBackground}
          canvasBackgroundSize={canvasBackgroundSize}
          canvasBackgroundRepeat={canvasBackgroundRepeat}
          canvasBackgroundPosition={canvasBackgroundPosition}
          onZoomChange={updateCanvasZoom}
          onSelectPage={selectPage}
          onSelectTile={selectTile}
          onSelectElement={selectElement}
          onDrop={(event) => {
            void handleCanvasDrop(event);
          }}
          onOpenPageDesign={() => setSettingsView("page")}
          onOpenLayout={() => setSettingsView("layout")}
          onBringForward={() => changeSelectedLayer("front")}
          onDuplicateSelection={duplicateSelectedItem}
          onDeleteSelection={deleteSelectedItem}
          onAddPage={() => addPage()}
          onSetActivePage={setActivePageId}
          onUpdateTileLayout={updateTileLayout}
          onUpdateElementLayout={updateElementLayout}
          renderTile={(tile, selected, onSelect) => <TileRenderer tile={tile} selected={selected} onSelect={onSelect} />}
          renderElement={(element, selected, onSelect) => <CanvasElementRenderer element={element} selected={selected} onSelect={onSelect} />}
        />

        <BuilderInspector
          settingsView={settingsView}
          setSettingsView={setSettingsView}
          activePage={activePage}
          dashboardPageCount={dashboard.pages.length}
          updateActivePage={updateActivePage}
          duplicateActivePage={duplicateActivePage}
          deleteActivePage={deleteActivePage}
          selectedTile={selectedTile}
          selectedElement={selectedElement}
          multiSelectedObjects={activeMultiSelectedObjects}
          setMultiSelectedHidden={setMultiSelectedHidden}
          setMultiSelectedLocked={setMultiSelectedLocked}
          alignMultiSelected={alignMultiSelected}
          clearMultiSelection={clearMultiSelection}
          savedBanners={savedBanners}
          savedFilters={savedFilters}
          savedVariableSets={savedVariableSets}
          savedWeights={savedWeights}
          selectedTileQuestion={selectedTileQuestion}
          selectedTileFilterDimension={selectedTileFilterDimension}
          selectedChartPart={selectedChartPart}
          selectedChartPartId={selectedChartPartId}
          setSelectedChartPartId={setSelectedChartPartId}
          chartStyleTargets={chartStyleTargets}
          textStylePresets={textStylePresets}
          designPalettes={designPalettes}
          pageMasters={pageMasters}
          pageThemes={pageThemes}
          applyPageMasterLayout={applyPageMasterLayout}
          setDesignModal={setDesignModal}
          changeSelectedLayer={changeSelectedLayer}
          alignSelected={alignSelected}
          applyLayoutPreset={applyLayoutPreset}
          updateSelectedLayout={updateSelectedLayout}
          updateSelectedElement={updateSelectedElement}
          updateSelectedTile={updateSelectedTile}
          selectTile={selectTile}
          updateSelectedAppearance={updateSelectedAppearance}
          updateSelectedBarStyle={updateSelectedBarStyle}
          updateSelectedAxisLabel={updateSelectedAxisLabel}
          applyTextStylePresetToSelection={applyTextStylePresetToSelection}
          applyPageTheme={applyPageTheme}
          applyPalettePresetToBars={applyPalettePresetToBars}
          applyPaletteColorToSelectedBar={applyPaletteColorToSelectedBar}
          applySolidColorToBars={applySolidColorToBars}
          clearBarColorOverrides={clearBarColorOverrides}
          applySelectedElementEffectPreset={applySelectedElementEffectPreset}
          applySelectedTileEffectPreset={applySelectedTileEffectPreset}
          tileWithVisualization={tileWithVisualization}
          duplicateTileAsVisualization={duplicateTileAsVisualization}
          duplicateDerivedOutputTile={duplicateDerivedOutputTile}
          createDerivedOutputTile={createDerivedOutputTile}
          recreateDerivedOutputTile={recreateDerivedOutputTile}
          saveDerivedDefinition={saveDerivedDefinition}
          rerunTileAnalysis={rerunTileAnalysis}
          saveSelectedTileVariableSet={saveSelectedTileVariableSet}
          saveSelectedTileAnalyticalTemplate={saveSelectedTileAnalyticalTemplate}
          saveSelectedTileBanner={saveSelectedTileBanner}
          saveSelectedTileFilter={saveSelectedTileFilter}
          saveSelectedTileWeight={saveSelectedTileWeight}
          onViewSavedSettingInLibrary={viewSavedSettingInLibrary}
          savedSettingOriginCue={savedSettingOriginCue}
          recordSavedSettingOriginCue={(kind, label, tileId) => setSavedSettingOriginCue({ kind, label, tileId, status: "applied", createdAt: Date.now() })}
          completeSavedSettingOriginCue={(tileId) => {
            setSavedSettingOriginCue((current) => current?.tileId === tileId ? { ...current, status: "refreshed", createdAt: Date.now() } : current);
          }}
          relatedObjectNavigationCue={relatedObjectNavigationCue}
          recordRelatedObjectNavigationCue={(cue) => setRelatedObjectNavigationCue({ ...cue, createdAt: Date.now() })}
          reportTreeSelectionCue={reportTreeSelectionCue}
          savedLibraryInsertionCue={savedLibraryInsertionCue}
          derivedOutputCreationCue={derivedOutputCreationCue}
          derivedOutputRecreationCue={derivedOutputRecreationCue}
          derivedOutputLibraryActionCue={derivedOutputLibraryActionCue}
          deleteSelectedItem={deleteSelectedItem}
          isLoading={isLoading}
          comparisonDatasets={comparisonDatasets}
        />
      </section>
      {designModal && (
        <BuilderDesignModal
          designModal={designModal}
          designModalRef={designModalRef}
          activePage={activePage}
          selectedTile={selectedTile}
          selectedElement={selectedElement}
          selectedChartPart={selectedChartPart}
          selectedChartPartId={selectedChartPartId}
          setDesignModal={setDesignModal}
          setSelectedChartPartId={setSelectedChartPartId}
          updateActivePage={updateActivePage}
          updateSelectedElement={updateSelectedElement}
          updateSelectedAppearance={updateSelectedAppearance}
          updateSelectedBarStyle={updateSelectedBarStyle}
          updateSelectedAxisLabel={updateSelectedAxisLabel}
          applyPalettePresetToBars={applyPalettePresetToBars}
          applyPaletteColorToSelectedBar={applyPaletteColorToSelectedBar}
          applySolidColorToBars={applySolidColorToBars}
          clearBarColorOverrides={clearBarColorOverrides}
          applySelectedElementEffectPreset={applySelectedElementEffectPreset}
          applySelectedTileEffectPreset={applySelectedTileEffectPreset}
        />
      )}
    </main>
  );
}
