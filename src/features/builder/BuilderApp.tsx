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
  historyLimit,
  storageKey
} from "./builderConstants";
import {
  buildPageFromTemplate,
  createCanvasElement,
  createTextBlockElement,
  duplicateElement,
  duplicatePage,
  duplicateTile,
  remainingPagesAfterDelete
} from "./builderDocumentCommands";
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
import { useEditorSessionState } from "./hooks/useEditorSessionState";
import { useBuilderDesignCommands } from "./hooks/useBuilderDesignCommands";
import { useBuilderTileCommands } from "./hooks/useBuilderTileCommands";
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
import { clampZIndex, nextZIndex, normalizeDashboard } from "../document/documentModel";
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
  CanvasLayout,
  DashboardCanvasElement,
  DashboardCanvasElementType,
  DashboardDraft,
  DashboardPage,
  DashboardTile,
  DesignColorPalette,
  GradientStop,
  GradientType,
  PageTemplatePreset,
  PageThemePreset,
  SavedBanner,
  SavedFilterSet,
  SavedVariableSet,
  SavedWeightProfile,
  TextBlockPreset,
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

  const sortedPages = [...dashboard.pages].sort((a, b) => a.order - b.order);
  const activePage = sortedPages.find((page) => page.id === activePageId) ?? sortedPages[0];
  const selectedTile = activePage?.tiles.find((tile) => tile.id === selectedTileId) ?? null;
  const selectedElement = activePage?.elements.find((element) => element.id === selectedElementId) ?? null;
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

  useEffect(() => {
    if (!designModal) return;
    designModalRef.current?.scrollTo({ top: 0 });
  }, [designModal]);

  function setDashboard(updater: DashboardDraft | ((current: DashboardDraft) => DashboardDraft), trackHistory = true) {
    setDashboardState((current) => {
      const nextDashboard = typeof updater === "function" ? updater(current) : updater;

      if (trackHistory) {
        setHistory((items) => [...items.slice(-historyLimit + 1), current]);
        setFuture([]);
        setSaveState("Saving...");
      }

      return nextDashboard;
    });
  }

  function undo() {
    const previous = history.at(-1);
    if (!previous) return;

    setFuture((items) => [dashboard, ...items]);
    setHistory((items) => items.slice(0, -1));
    setDashboard(previous, false);
  }

  function redo() {
    const nextDashboard = future[0];
    if (!nextDashboard) return;

    setHistory((items) => [...items, dashboard]);
    setFuture((items) => items.slice(1));
    setDashboard(nextDashboard, false);
  }

  function updateSelectedTile(updates: Partial<DashboardTile>) {
    if (!selectedTileId) return;

    setDashboard((current) => ({
      ...current,
      status: "draft",
      pages: current.pages.map((page) =>
        page.id === activePage.id
          ? {
              ...page,
              tiles: page.tiles.map((tile) => (tile.id === selectedTileId ? { ...tile, ...updates } : tile))
            }
          : page
      )
    }));
  }

  function updateTile(tileId: string, updates: Partial<DashboardTile>) {
    setDashboard((current) => ({
      ...current,
      status: "draft",
      pages: current.pages.map((page) =>
        page.id === activePage.id
          ? {
              ...page,
              tiles: page.tiles.map((tile) => (tile.id === tileId ? { ...tile, ...updates } : tile))
            }
          : page
      )
    }));
  }

  const {
    startDataSourceDrag,
    handleCanvasDrop,
    addTileFromQuery,
    addTileFromSourceWithVisualization,
    rerunTileAnalysis,
    tileWithVisualization,
    duplicateTileAsVisualization
  } = useBuilderTileCommands({
    activePage,
    canvasScale,
    query,
    selectedQuestion,
    selectedVariableSet,
    savedVariableSets,
    setDashboard,
    selectTile,
    updateTile,
    applyQuestionSelection,
    applyVariableSetSelection,
    setIsLoading,
    setError
  });

  function updateTileLayout(tileId: string, layout: Partial<CanvasLayout>) {
    setDashboard((current) => ({
      ...current,
      status: "draft",
      pages: current.pages.map((page) =>
        page.id === activePage.id
          ? {
              ...page,
              tiles: page.tiles.map((tile) => (tile.id === tileId ? { ...tile, layout: { ...tile.layout, ...layout } } : tile))
            }
          : page
      )
    }));
  }

  function updateSelectedElement(updates: Partial<DashboardCanvasElement>) {
    if (!selectedElementId) return;

    setDashboard((current) => ({
      ...current,
      status: "draft",
      pages: current.pages.map((page) =>
        page.id === activePage.id
          ? {
              ...page,
              elements: page.elements.map((element) => (element.id === selectedElementId ? { ...element, ...updates } : element))
            }
          : page
      )
    }));
  }

  function updateElement(elementId: string, updates: Partial<DashboardCanvasElement>) {
    setDashboard((current) => ({
      ...current,
      status: "draft",
      pages: current.pages.map((page) =>
        page.id === activePage.id
          ? {
              ...page,
              elements: page.elements.map((element) => (element.id === elementId ? { ...element, ...updates } : element))
            }
          : page
      )
    }));
  }

  function selectLayer(item: LayerItem) {
    if (item.type === "tile") {
      selectTile(item.id);
    } else {
      selectElement(item.id);
    }

    setSelectedChartPartId("all");
  }

  function selectTile(tileId: string) {
    setSelectedTileId(tileId);
    setSelectedElementId(null);
    setSelectedChartPartId("all");
    setSettingsView("chart");
  }

  function selectElement(elementId: string) {
    setSelectedElementId(elementId);
    setSelectedTileId(null);
    setSelectedChartPartId("all");
    setSettingsView("element");
  }

  function selectPage() {
    setSelectedTileId(null);
    setSelectedElementId(null);
    setSelectedChartPartId("all");
    setSettingsView("page");
  }

  function updateElementLayout(elementId: string, layout: Partial<CanvasLayout>) {
    setDashboard((current) => ({
      ...current,
      status: "draft",
      pages: current.pages.map((page) =>
        page.id === activePage.id
          ? {
              ...page,
              elements: page.elements.map((element) => (element.id === elementId ? { ...element, layout: { ...element.layout, ...layout } } : element))
            }
          : page
      )
    }));
  }

  function changeSelectedLayer(direction: "front" | "back" | "forward" | "backward") {
    const currentZ = selectedTile?.layout.zIndex ?? selectedElement?.layout.zIndex;
    if (!currentZ) return;

    const nextZ =
      direction === "front"
        ? nextZIndex(activePage)
        : direction === "back"
          ? 1
          : direction === "forward"
            ? currentZ + 1
            : clampZIndex(currentZ - 1);

    if (selectedTile) {
      updateTileLayout(selectedTile.id, { zIndex: nextZ });
    }

    if (selectedElement) {
      updateElementLayout(selectedElement.id, { zIndex: nextZ });
    }
  }

  function addCanvasElement(type: DashboardCanvasElementType) {
    const element = createCanvasElement(type, activePage);

    setDashboard((current) => ({
      ...current,
      status: "draft",
      pages: current.pages.map((page) => (page.id === activePage.id ? { ...page, elements: [...page.elements, element] } : page))
    }));
    selectElement(element.id);
  }

  function addTextBlockPreset(block: TextBlockPreset) {
    const element = createTextBlockElement(block, activePage);

    setDashboard((current) => ({
      ...current,
      status: "draft",
      pages: current.pages.map((page) => (page.id === activePage.id ? { ...page, elements: [...page.elements, element] } : page))
    }));
    selectElement(element.id);
    setSettingsView("element");
  }

  function exportDashboardSpec() {
    downloadDashboardExportSpec(dashboard, sortedPages);
  }

  function updateActivePage(updates: Partial<DashboardPage>) {
    setDashboard((current) => ({
      ...current,
      status: "draft",
      pages: current.pages.map((page) => (page.id === activePage.id ? { ...page, ...updates } : page))
    }));
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

  function addPage(template?: PageTemplatePreset) {
    const page = buildPageFromTemplate({ template, pageCount: dashboard.pages.length, pageThemes });

    setDashboard((current) => ({ ...current, status: "draft", pages: [...current.pages, page] }));
    setActivePageId(page.id);
    selectPage();
  }

  function duplicateActivePage() {
    const duplicate = duplicatePage(activePage, dashboard.pages.length);

    setDashboard((current) => ({ ...current, status: "draft", pages: [...current.pages, duplicate] }));
    setActivePageId(duplicate.id);
    selectPage();
  }

  function deleteActivePage() {
    if (dashboard.pages.length <= 1) return;

    const remainingPages = remainingPagesAfterDelete(sortedPages, activePage);
    setDashboard((current) => ({ ...current, status: "draft", pages: remainingPages }));
    setActivePageId(remainingPages[0].id);
    setSelectedTileId(null);
    setSelectedElementId(null);
    setSelectedChartPartId("all");
  }

  function deleteSelectedItem() {
    if (!selectedTile && !selectedElement) return;

    setDashboard((current) => ({
      ...current,
      status: "draft",
      pages: current.pages.map((page) =>
        page.id === activePage.id
          ? {
              ...page,
              tiles: selectedTile ? page.tiles.filter((tile) => tile.id !== selectedTile.id) : page.tiles,
              elements: selectedElement ? page.elements.filter((element) => element.id !== selectedElement.id) : page.elements
            }
          : page
      )
    }));
    setSelectedTileId(null);
    setSelectedElementId(null);
    setSelectedChartPartId("all");
  }

  function duplicateSelectedItem() {
    if (selectedTile) {
      const duplicate = duplicateTile(selectedTile, activePage);

      setDashboard((current) => ({
        ...current,
        status: "draft",
        pages: current.pages.map((page) => (page.id === activePage.id ? { ...page, tiles: [...page.tiles, duplicate] } : page))
      }));
      selectTile(duplicate.id);
      return;
    }

    if (selectedElement) {
      const duplicate = duplicateElement(selectedElement, activePage);

      setDashboard((current) => ({
        ...current,
        status: "draft",
        pages: current.pages.map((page) => (page.id === activePage.id ? { ...page, elements: [...page.elements, duplicate] } : page))
      }));
      selectElement(duplicate.id);
    }
  }

  function resetDashboard() {
    setDashboard(initialDashboard);
    setActivePageId("page_overview");
    setSelectedTileId(null);
    setSelectedElementId(null);
    setSelectedChartPartId("all");
    setSettingsView("page");
    setLeftPanelView("pages");
  }

  function chooseLayer(item: LayerItem) {
    selectLayer(item);
    setLeftPanelView("pages");
    setSettingsView(item.type === "tile" ? "chart" : "element");
  }

  function updateCanvasZoom(value: number) {
    setCanvasZoom(Math.min(160, Math.max(35, value)));
  }

  function publishDashboard() {
    setDashboard((current) => ({ ...current, status: "published" }));
    setViewerMode(true);
  }

  function unpublishDashboard() {
    setDashboard((current) => ({ ...current, status: "draft" }));
    setViewerMode(false);
  }

  function openPublishedReport() {
    setSelectedTileId(null);
    setSelectedElementId(null);
    setSelectedChartPartId("all");
    setViewerMode(true);
  }

  function closePublishedReport() {
    setViewerMode(false);
  }

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
          chooseLayer={chooseLayer}
          updateTile={updateTile}
          updateElement={updateElement}
          sortedPages={sortedPages}
          activePage={activePage}
          setActivePageId={setActivePageId}
          selectPage={selectPage}
          addPage={addPage}
          duplicateActivePage={duplicateActivePage}
          pageTemplates={pageTemplates}
          pageThemes={pageThemes}
          selectedTextElement={selectedTextElement}
          selectedTile={selectedTile}
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
          updateVariableSetRow={updateVariableSetRow}
          reorderVariableSetRow={reorderVariableSetRow}
          removeVariableSetRow={removeVariableSetRow}
          saveCurrentVariableSet={saveCurrentVariableSet}
          deleteVariableSet={deleteVariableSet}
          savedBanners={savedBanners}
          savedFilters={savedFilters}
          savedWeights={savedWeights}
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
          setVariableSetRows={setVariableSetRows}
          setVariableSetOptionSelection={setVariableSetOptionSelection}
          addCanvasElement={addCanvasElement}
          addTileFromQuery={addTileFromQuery}
          addTileFromSourceWithVisualization={addTileFromSourceWithVisualization}
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
          selectedTileQuestion={selectedTileQuestion}
          selectedTileFilterDimension={selectedTileFilterDimension}
          selectedChartPart={selectedChartPart}
          selectedChartPartId={selectedChartPartId}
          setSelectedChartPartId={setSelectedChartPartId}
          chartStyleTargets={chartStyleTargets}
          textStylePresets={textStylePresets}
          designPalettes={designPalettes}
          setDesignModal={setDesignModal}
          changeSelectedLayer={changeSelectedLayer}
          alignSelected={alignSelected}
          applyLayoutPreset={applyLayoutPreset}
          updateSelectedLayout={updateSelectedLayout}
          updateSelectedElement={updateSelectedElement}
          updateSelectedTile={updateSelectedTile}
          updateSelectedAppearance={updateSelectedAppearance}
          updateSelectedBarStyle={updateSelectedBarStyle}
          updateSelectedAxisLabel={updateSelectedAxisLabel}
          applyTextStylePresetToSelection={applyTextStylePresetToSelection}
          applyPalettePresetToBars={applyPalettePresetToBars}
          applyPaletteColorToSelectedBar={applyPaletteColorToSelectedBar}
          applySolidColorToBars={applySolidColorToBars}
          clearBarColorOverrides={clearBarColorOverrides}
          applySelectedElementEffectPreset={applySelectedElementEffectPreset}
          applySelectedTileEffectPreset={applySelectedTileEffectPreset}
          tileWithVisualization={tileWithVisualization}
          duplicateTileAsVisualization={duplicateTileAsVisualization}
          rerunTileAnalysis={rerunTileAnalysis}
          saveSelectedTileVariableSet={saveSelectedTileVariableSet}
          saveSelectedTileBanner={saveSelectedTileBanner}
          saveSelectedTileFilter={saveSelectedTileFilter}
          saveSelectedTileWeight={saveSelectedTileWeight}
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
