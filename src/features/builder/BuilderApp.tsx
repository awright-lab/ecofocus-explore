import { useEffect, useMemo, useRef, useState } from "react";
import { runAnalyticsQuery } from "../../lib/api";
import { applyVariableSetRows } from "../../../shared/analytics/variableSets";
import {
  axisFontSizePresets,
  axisRotationPresets,
  bannerDimensions,
  canvasHeight,
  canvasWidth,
  comparisonDatasetOptions,
  defaultAppearance,
  defaultBreakBy,
  defaultDataset,
  defaultFilterDimension,
  defaultGridSize,
  defaultQuestion,
  datasets,
  effectPresets,
  effectPresetValues,
  filterDimensions,
  fontFamilies,
  historyLimit,
  palettes,
  storageKey,
  waveComparisonChartTypes,
  type EffectPreset
} from "./builderConstants";
import { BuilderHeader, BuilderPanel, ToolRail } from "./components/BuilderChrome";
import {
  CanvasElementRenderer,
  TileRenderer,
  comparisonSummaryLabel,
  confidenceLevelLabel,
  getAxisLabel,
  getBarStyle,
  getDocumentColors,
  getPaletteId,
  gradientStylePresets,
  pageSummary,
  resultConfidenceLevel,
  sampleSizeLabel,
  slugifyFileName,
  tilePresentationNotes,
  tileSourceKindLabel,
  trendSpanLabel
} from "./components/CanvasRenderers";
import { CanvasWorkspace } from "./components/CanvasWorkspace";
import { BarColorField, ColorField, GradientEditor, PageBackgroundField, rangeFill } from "../design-system/DesignControls";
import { defaultVisualizationForQuestion, getChartTypeLabel, getCompatibleChartTypes, getQuestionLabel } from "../analytics/analyticsDisplay";
import { queryForQuestion, queryForVariableSet, useAnalysisAuthoring } from "../analytics/useAnalysisAuthoring";
import { useEditorSessionState } from "./hooks/useEditorSessionState";
import {
  applyGradientStylePreset,
  backgroundStyle,
  canvasBackground,
  canvasBackgroundPosition,
  canvasBackgroundRepeat,
  canvasBackgroundSize,
  colorAlpha,
  effectShadow,
  gradientCss,
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
  defaultElementStyle,
  defaultPageDesign,
  defaultVariableSetRows,
  initialDashboard,
  normalizeVariableSetRows,
  rowKindLabel,
} from "../document/documentSeeds";
import { clampZIndex, makeElementId, makePageId, makeTileId, nextZIndex, normalizeDashboard } from "../document/documentModel";
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
  AnalyticsAnnotation,
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
  TextStylePreset,
  TileAppearance
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

  async function createTileFromSource(
    tileQuery: AnalyticsQueryRequest,
    sourceLabel: string,
    position?: { x: number; y: number },
    source?: DashboardTile["source"]
  ) {
    setIsLoading(true);
    setError(null);

    try {
      const response = await runAnalyticsQuery(tileQuery);
      const resolvedResponse =
        source?.kind === "variableSet"
          ? applyVariableSetRows(response, savedVariableSets.find((item) => item.id === source.id) ?? {
              id: source.id,
              datasetId: defaultDataset.id,
              label: source.label,
              description: "",
              topic: source.label,
              questionIds: [tileQuery.question],
              primaryQuestionId: tileQuery.question,
              rowMode: "authored",
              rows: defaultVariableSetRows(tileQuery.question),
              breakBy: tileQuery.breakBy,
              metric: tileQuery.metric,
              chartType: tileQuery.chartType,
              weight: tileQuery.weight,
              filterField: (tileQuery.filters[0]?.field as FilterFieldId | undefined) ?? null,
              filterValue: tileQuery.filters[0]?.values[0] ?? "all"
            })
          : response;
      const tile: DashboardTile = {
        id: makeTileId(),
        name: sourceLabel,
        title: sourceLabel,
        source,
        locked: false,
        hidden: false,
        layout: {
          x: position?.x ?? 48,
          y: position?.y ?? 72 + activePage.tiles.length * 28,
          width: 760,
          height: 460,
          zIndex: nextZIndex(activePage)
        },
        query: tileQuery,
        visualization: tileQuery.chartType,
        appearance: { ...defaultAppearance, palette: [...defaultAppearance.palette] },
        result: resolvedResponse
      };

      setDashboard((current) => ({
        ...current,
        status: "draft",
        pages: current.pages.map((page) => (page.id === activePage.id ? { ...page, tiles: [...page.tiles, tile] } : page))
      }));
      selectTile(tile.id);
    } catch (queryError) {
      setError(queryError instanceof Error ? queryError.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  }

  function startDataSourceDrag(source: { kind: "question" | "variableSet"; id: string }, event: React.DragEvent<HTMLElement>) {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("application/ecofocus-source", JSON.stringify(source));
  }

  async function handleCanvasDrop(event: React.DragEvent<HTMLDivElement>) {
    const raw = event.dataTransfer.getData("application/ecofocus-source");
    if (!raw) return;

    event.preventDefault();

    try {
      const parsed = JSON.parse(raw) as { kind: "question" | "variableSet"; id: string };
      const bounds = event.currentTarget.getBoundingClientRect();
      const dropX = Math.max(24, Math.min(canvasWidth - 784, Math.round((event.clientX - bounds.left) / canvasScale) - 120));
      const dropY = Math.max(24, Math.min(canvasHeight - 484, Math.round((event.clientY - bounds.top) / canvasScale) - 48));

      if (parsed.kind === "variableSet") {
        const variableSet = savedVariableSets.find((item) => item.id === parsed.id);
        if (!variableSet) return;
        applyVariableSetSelection(variableSet);
        await createTileFromSource(
          queryForVariableSet(variableSet),
          variableSet.label,
          { x: dropX, y: dropY },
          { kind: "variableSet", id: variableSet.id, label: variableSet.label }
        );
        return;
      }

      const nextQuestion = defaultDataset.questions.find((item) => item.id === parsed.id);
      if (!nextQuestion) return;
      applyQuestionSelection(nextQuestion);
      await createTileFromSource(
        queryForQuestion(nextQuestion),
        nextQuestion.shortLabel,
        { x: dropX, y: dropY },
        { kind: "question", id: nextQuestion.id, label: nextQuestion.shortLabel }
      );
    } catch {
      setError("Could not drop that source onto the canvas.");
    }
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

  async function addTileFromQuery() {
    await createTileFromSource(
      query,
      selectedVariableSet?.label ?? selectedQuestion.shortLabel,
      undefined,
      selectedVariableSet
        ? { kind: "variableSet", id: selectedVariableSet.id, label: selectedVariableSet.label }
        : { kind: "question", id: selectedQuestion.id, label: selectedQuestion.shortLabel }
    );
  }

  async function addTileFromSourceWithVisualization(nextVisualization: ChartType) {
    const nextQuery = { ...query, chartType: nextVisualization };
    await createTileFromSource(
      nextQuery,
      selectedVariableSet?.label ?? selectedQuestion.shortLabel,
      undefined,
      selectedVariableSet
        ? { kind: "variableSet", id: selectedVariableSet.id, label: selectedVariableSet.label }
        : { kind: "question", id: selectedQuestion.id, label: selectedQuestion.shortLabel }
    );
  }

  function tileWithVisualization(tile: DashboardTile, nextVisualization: ChartType): Partial<DashboardTile> {
    return {
      visualization: nextVisualization,
      query: { ...tile.query, chartType: nextVisualization },
      result: { ...tile.result, query: { ...tile.result.query, chartType: nextVisualization } }
    };
  }

  async function rerunTileAnalysis(tile: DashboardTile, nextQuery: AnalyticsQueryRequest) {
    setIsLoading(true);
    setError(null);

    try {
      const response = await runAnalyticsQuery(nextQuery);
      const resolvedResponse =
        tile.source?.kind === "variableSet"
          ? applyVariableSetRows(
              response,
              savedVariableSets.find((item) => item.id === tile.source?.id) ?? {
                id: tile.source?.id ?? `variable_set_${Date.now()}`,
                datasetId: defaultDataset.id,
                label: tile.source?.label ?? tile.title,
                description: "",
                topic: tile.title,
                questionIds: [nextQuery.question],
                primaryQuestionId: nextQuery.question,
                rowMode: "authored",
                rows: defaultVariableSetRows(nextQuery.question),
                breakBy: nextQuery.breakBy,
                metric: nextQuery.metric,
                chartType: nextQuery.chartType,
                weight: nextQuery.weight,
                filterField: (nextQuery.filters[0]?.field as FilterFieldId | undefined) ?? null,
                filterValue: nextQuery.filters[0]?.values[0] ?? "all"
              }
            )
          : response;
      const compatibleVisualizations = getCompatibleChartTypes(resolvedResponse);
      const nextVisualization = compatibleVisualizations.includes(tile.visualization)
        ? tile.visualization
        : compatibleVisualizations[0] ?? "table";

      updateTile(tile.id, {
        query: { ...nextQuery, chartType: nextVisualization, confidenceLevel: nextQuery.confidenceLevel ?? 0.95 },
        visualization: nextVisualization,
        result: {
          ...resolvedResponse,
          query: { ...resolvedResponse.query, chartType: nextVisualization, confidenceLevel: resolvedResponse.query.confidenceLevel ?? nextQuery.confidenceLevel ?? 0.95 }
        }
      });
    } catch (queryError) {
      setError(queryError instanceof Error ? queryError.message : "Something went wrong refreshing this analysis.");
    } finally {
      setIsLoading(false);
    }
  }

  function duplicateTileAsVisualization(tile: DashboardTile, nextVisualization: ChartType) {
    const duplicate: DashboardTile = {
      ...tile,
      ...tileWithVisualization(tile, nextVisualization),
      id: makeTileId(),
      name: `${tile.name} ${getChartTypeLabel(nextVisualization).toLowerCase()}`,
      title: tile.title,
      layout: {
        ...tile.layout,
        x: tile.layout.x + 28,
        y: tile.layout.y + 28,
        zIndex: nextZIndex(activePage)
      },
      appearance: {
        ...tile.appearance,
        palette: [...tile.appearance.palette],
        barStyles: { ...tile.appearance.barStyles }
      }
    };

    setDashboard((current) => ({
      ...current,
      status: "draft",
      pages: current.pages.map((page) => (page.id === activePage.id ? { ...page, tiles: [...page.tiles, duplicate] } : page))
    }));
    selectTile(duplicate.id);
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

  function applyPaletteToTile(palette: DesignColorPalette, scope: "selected" | "all" = "selected") {
    const updateAppearance = (appearance: TileAppearance): TileAppearance => ({
      ...appearance,
      primaryColor: palette.colors[0],
      palette: palette.colors,
      labelColor: palette.colors[0],
      barFillMode: "solid",
      barGradientStops: [],
      barStyles: {},
      gridColor: appearance.gridColor,
      xAxisTextColor: appearance.xAxisTextColor,
      yAxisTextColor: appearance.yAxisTextColor
    });

    setDashboard((current) => ({
      ...current,
      status: "draft",
      pages: current.pages.map((page) =>
        page.id === activePage.id
          ? {
              ...page,
              tiles: page.tiles.map((tile) => {
                if (scope === "selected" && tile.id !== selectedTileId) {
                  return tile;
                }
                return {
                  ...tile,
                  appearance: updateAppearance(tile.appearance)
                };
              })
            }
          : page
      )
    }));
  }

  function applyTextStylePresetToSelection(preset: TextStylePreset) {
    if (!selectedTextElement) return;
    updateSelectedElement({
      style: {
        ...selectedTextElement.style,
        fontFamily: preset.fontFamily,
        fontSize: preset.fontSize,
        fontWeight: preset.fontWeight,
        textAlign: preset.textAlign,
        lineHeight: preset.lineHeight,
        textColor: preset.textColor
      }
    });
  }

  function applyPageTheme(theme: PageThemePreset) {
    updateActivePage({
      backgroundMode: theme.backgroundMode,
      background: theme.background,
      backgroundImage: theme.backgroundImage,
      backgroundImageFit: theme.backgroundImageFit,
      gradientFrom: theme.gradientFrom,
      gradientTo: theme.gradientTo,
      gradientType: theme.gradientType,
      gradientAngle: theme.gradientAngle,
      gradientStops: theme.gradientStops,
      showCanvasGrid: theme.showCanvasGrid
    });
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

  function updateSelectedLayout(layout: Partial<CanvasLayout>) {
    if (selectedTile) {
      updateTileLayout(selectedTile.id, layout);
    }

    if (selectedElement) {
      updateElementLayout(selectedElement.id, layout);
    }
  }

  function alignSelected(direction: "left" | "center" | "right" | "top" | "middle" | "bottom") {
    const layout = selectedTile?.layout ?? selectedElement?.layout;
    if (!layout) return;

    if (direction === "left") updateSelectedLayout({ x: 0 });
    if (direction === "center") updateSelectedLayout({ x: Math.round((canvasWidth - layout.width) / 2) });
    if (direction === "right") updateSelectedLayout({ x: canvasWidth - layout.width });
    if (direction === "top") updateSelectedLayout({ y: 0 });
    if (direction === "middle") updateSelectedLayout({ y: Math.round((canvasHeight - layout.height) / 2) });
    if (direction === "bottom") updateSelectedLayout({ y: canvasHeight - layout.height });
  }

  function addCanvasElement(type: DashboardCanvasElementType) {
    const element: DashboardCanvasElement = {
      id: makeElementId(),
      name: type === "text" ? "Text" : type === "image" ? "Image" : type === "circle" ? "Circle" : "Rectangle",
      type,
      locked: false,
      hidden: false,
      layout: { x: 64, y: 64, width: type === "text" ? 280 : 220, height: type === "text" ? 80 : 160, zIndex: nextZIndex(activePage) },
      content: type === "text" ? "Text box" : "",
      style: defaultElementStyle(type)
    };

    setDashboard((current) => ({
      ...current,
      status: "draft",
      pages: current.pages.map((page) => (page.id === activePage.id ? { ...page, elements: [...page.elements, element] } : page))
    }));
    selectElement(element.id);
  }

  function addTextBlockPreset(block: TextBlockPreset) {
    const element: DashboardCanvasElement = {
      id: makeElementId(),
      name: block.label,
      type: "text",
      locked: false,
      hidden: false,
      layout: {
        x: Math.round((canvasWidth - block.width) / 2),
        y: Math.round((canvasHeight - block.height) / 2),
        width: block.width,
        height: block.height,
        zIndex: nextZIndex(activePage)
      },
      content: block.content,
      style: {
        ...defaultElementStyle("text"),
        ...block.style
      }
    };

    setDashboard((current) => ({
      ...current,
      status: "draft",
      pages: current.pages.map((page) => (page.id === activePage.id ? { ...page, elements: [...page.elements, element] } : page))
    }));
    selectElement(element.id);
    setSettingsView("element");
  }

  function applyLayoutPreset(preset: "hero" | "leftColumn" | "rightColumn" | "footer") {
    const layout = selectedTile?.layout ?? selectedElement?.layout;
    if (!layout) return;

    const nextLayout: Partial<CanvasLayout> =
      preset === "hero"
        ? { x: 80, y: 72, width: Math.min(720, canvasWidth - 160) }
        : preset === "leftColumn"
          ? { x: 72, y: layout.y, width: Math.min(460, canvasWidth / 2 - 96) }
          : preset === "rightColumn"
            ? { x: Math.round(canvasWidth / 2 + 24), y: layout.y, width: Math.min(460, canvasWidth / 2 - 96) }
            : { x: 72, y: canvasHeight - Math.min(layout.height, 120) - 48, width: Math.min(460, canvasWidth - 144), height: Math.min(layout.height, 120) };

    updateSelectedLayout(nextLayout);
  }

  function updateSelectedAppearance(updates: Partial<TileAppearance>) {
    if (!selectedTile) return;
    updateSelectedTile({ appearance: { ...selectedTile.appearance, ...updates } });
  }

  function applySelectedElementEffectPreset(preset: EffectPreset) {
    if (!selectedElement) return;
    updateSelectedElement({
      style: {
        ...selectedElement.style,
        shadowPreset: preset,
        shadow: true,
        ...effectPresetValues(preset),
        glow: preset === "glow" ? true : selectedElement.style.glow
      }
    });
  }

  function applySelectedTileEffectPreset(preset: EffectPreset) {
    if (!selectedTile) return;
    updateSelectedAppearance({
      shadowPreset: preset,
      shadow: true,
      ...effectPresetValues(preset),
      glow: preset === "glow" ? true : selectedTile.appearance.glow
    });
  }

  function updateSelectedBarStyle(updates: Partial<TileAppearance["barStyles"][string]>) {
    if (!selectedTile || !selectedChartPart) return;

    const fallback = getBarStyle(selectedTile.appearance, selectedChartPart.id, selectedTile.appearance.primaryColor);
    updateSelectedAppearance({
      barStyles: {
        ...selectedTile.appearance.barStyles,
        [selectedChartPart.id]: {
          ...fallback,
          ...updates
        }
      }
    });
  }

  function clearBarColorOverrides(nextShared?: Partial<TileAppearance>) {
    if (!selectedTile) return;

    const nextBarStyles = Object.fromEntries(
      Object.entries(selectedTile.appearance.barStyles).map(([id, style]) => [
        id,
        {
          radius: style.radius ?? selectedTile.appearance.barRadius
        }
      ])
    ) as TileAppearance["barStyles"];

    updateSelectedAppearance({
      ...nextShared,
      barStyles: nextBarStyles
    });
  }

  function applyPalettePresetToBars(paletteColors: string[]) {
    if (!selectedTile) return;

    const nextBarStyles = selectedTile.result.table.reduce<TileAppearance["barStyles"]>((styles, row, index) => {
      styles[row.optionId] = {
        color: paletteColors[index % paletteColors.length] ?? paletteColors[0],
        fillMode: "solid",
        gradientTo: selectedTile.appearance.barGradientTo,
        gradientType: selectedTile.appearance.barGradientType,
        gradientAngle: selectedTile.appearance.barGradientAngle,
        gradientStops: selectedTile.appearance.barGradientStops,
        radius: selectedTile.appearance.barStyles[row.optionId]?.radius ?? selectedTile.appearance.barRadius
      };
      return styles;
    }, {});

    updateSelectedAppearance({
      palette: paletteColors,
      primaryColor: paletteColors[0],
      barFillMode: "solid",
      barStyles: nextBarStyles
    });
  }

  function applyPaletteColorToSelectedBar(color: string) {
    if (!selectedTile || !selectedChartPart) return;

    updateSelectedBarStyle({
      color,
      fillMode: "solid",
      gradientTo: selectedTile.appearance.barGradientTo,
      gradientType: selectedTile.appearance.barGradientType,
      gradientAngle: selectedTile.appearance.barGradientAngle,
      gradientStops: selectedTile.appearance.barGradientStops
    });
  }

  function applySolidColorToBars(color: string) {
    if (!selectedTile) return;

    const nextBarStyles = selectedTile.result.table.reduce<TileAppearance["barStyles"]>((styles, row) => {
      styles[row.optionId] = {
        color,
        fillMode: "solid",
        gradientTo: selectedTile.appearance.barGradientTo,
        gradientType: selectedTile.appearance.barGradientType,
        gradientAngle: selectedTile.appearance.barGradientAngle,
        gradientStops: selectedTile.appearance.barGradientStops,
        radius: selectedTile.appearance.barStyles[row.optionId]?.radius ?? selectedTile.appearance.barRadius
      };
      return styles;
    }, {});

    updateSelectedAppearance({
      primaryColor: color,
      palette: [color, ...selectedTile.appearance.palette.slice(1)],
      barFillMode: "solid",
      barStyles: nextBarStyles
    });
  }

  function updateSelectedAxisLabel(value: string) {
    if (!selectedTile || !selectedChartPart) return;

    updateSelectedAppearance({
      axisLabelOverrides: {
        ...selectedTile.appearance.axisLabelOverrides,
        [selectedChartPart.id]: value
      }
    });
  }

  function exportDashboardSpec() {
    const exportSpec = {
      exportType: "ecofocus-presentation-package",
      generatedAt: new Date().toISOString(),
      canvas: {
        width: canvasWidth,
        height: canvasHeight
      },
      dashboard: {
        id: dashboard.id,
        title: dashboard.title,
        status: dashboard.status
      },
      slides: sortedPages.map((page) => ({
        id: page.id,
        title: page.title,
        order: page.order,
        summary: pageSummary(page),
        background: {
          mode: page.backgroundMode,
          solid: page.background,
          image: page.backgroundImage,
          imageFit: page.backgroundImageFit,
          gradient: {
            from: page.gradientFrom,
            to: page.gradientTo,
            type: page.gradientType,
            angle: page.gradientAngle,
            stops: page.gradientStops
          }
        },
        canvas: {
          width: canvasWidth,
          height: canvasHeight
        },
        elements: page.elements
          .filter((element) => !element.hidden)
          .sort((a, b) => a.layout.zIndex - b.layout.zIndex)
          .map((element) => ({
            id: element.id,
            type: element.type,
            name: element.name,
            frame: {
              x: element.layout.x,
              y: element.layout.y,
              width: element.layout.width,
              height: element.layout.height,
              zIndex: element.layout.zIndex
            },
            content: element.content,
            style: element.style
          })),
        tiles: page.tiles
          .filter((tile) => !tile.hidden)
          .sort((a, b) => a.layout.zIndex - b.layout.zIndex)
          .map((tile) => ({
            id: tile.id,
            title: tile.title,
            source: tile.source ?? null,
            visualization: tile.visualization,
            frame: {
              x: tile.layout.x,
              y: tile.layout.y,
              width: tile.layout.width,
              height: tile.layout.height,
              zIndex: tile.layout.zIndex
            },
            query: tile.query,
            appearance: tile.appearance,
            exportHints: {
              slideTitle: tile.title,
              metricLabel: tile.result.metric.label,
              questionLabel: getQuestionLabel(tile.result.metadataRefs.question),
              comparison: comparisonSummaryLabel(tile.query),
              trendSpan: trendSpanLabel(tile.query),
              sampleSize: sampleSizeLabel(tile.result),
              weighting: tile.result.weighting.applied ? tile.result.weighting.label : "Unweighted",
              confidence: confidenceLevelLabel(resultConfidenceLevel(tile.result)),
              narrativeNotes: tilePresentationNotes(tile)
            },
            result: {
              columns: tile.result.columns,
              table: tile.result.table,
              notes: tile.result.notes,
              warnings: tile.result.warnings,
              annotations: tile.result.annotations
            }
          }))
      })),
      analysisLibrary: dashboard.analysisLibrary,
      presentationManifest: {
        title: dashboard.title,
        pageCount: sortedPages.length,
        exportedSlides: sortedPages.map((page) => ({
          id: page.id,
          title: page.title,
          order: page.order,
          summary: pageSummary(page)
        }))
      },
      originalDraft: dashboard
    };
    const blob = new Blob([JSON.stringify(exportSpec, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slugifyFileName(dashboard.title)}-presentation-package.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function updateActivePage(updates: Partial<DashboardPage>) {
    setDashboard((current) => ({
      ...current,
      status: "draft",
      pages: current.pages.map((page) => (page.id === activePage.id ? { ...page, ...updates } : page))
    }));
  }

  function buildPageFromTemplate(template?: PageTemplatePreset) {
    const pageTheme = pageThemes.find((item) => item.id === template?.pageThemeId) ?? pageThemes[0];
    return {
      id: makePageId(),
      title: template ? template.label : `Page ${dashboard.pages.length + 1}`,
      order: dashboard.pages.length + 1,
      ...defaultPageDesign(),
      ...(pageTheme
        ? {
            backgroundMode: pageTheme.backgroundMode,
            background: pageTheme.background,
            backgroundImage: pageTheme.backgroundImage,
            backgroundImageFit: pageTheme.backgroundImageFit,
            gradientFrom: pageTheme.gradientFrom,
            gradientTo: pageTheme.gradientTo,
            gradientType: pageTheme.gradientType,
            gradientAngle: pageTheme.gradientAngle,
            gradientStops: pageTheme.gradientStops,
            showCanvasGrid: pageTheme.showCanvasGrid
          }
        : {}),
      elements:
        template?.elements.map((element, index) => ({
          id: makeElementId(),
          name: element.name,
          type: "text" as const,
          locked: false,
          hidden: false,
          layout: { ...element.layout, zIndex: index + 1 },
          content: element.content,
          style: {
            ...defaultElementStyle("text"),
            ...element.style
          }
        })) ?? [],
      tiles: []
    } satisfies DashboardPage;
  }

  function addPage(template?: PageTemplatePreset) {
    const page = buildPageFromTemplate(template);

    setDashboard((current) => ({ ...current, status: "draft", pages: [...current.pages, page] }));
    setActivePageId(page.id);
    selectPage();
  }

  function duplicateActivePage() {
    const duplicate: DashboardPage = {
      ...activePage,
      id: makePageId(),
      title: `${activePage.title} copy`,
      order: dashboard.pages.length + 1,
      elements: activePage.elements.map((element) => ({
        ...element,
        id: makeElementId(),
        layout: { ...element.layout, zIndex: element.layout.zIndex }
      })),
      tiles: activePage.tiles.map((tile) => ({
        ...tile,
        id: makeTileId(),
        layout: { ...tile.layout, zIndex: tile.layout.zIndex },
        appearance: {
          ...tile.appearance,
          palette: [...tile.appearance.palette],
          gradientStops: [...tile.appearance.gradientStops],
          barGradientStops: [...tile.appearance.barGradientStops],
          barStyles: Object.fromEntries(
            Object.entries(tile.appearance.barStyles).map(([id, style]) => [
              id,
              {
                ...style,
                gradientStops: style.gradientStops ? [...style.gradientStops] : style.gradientStops
              }
            ])
          )
        }
      }))
    };

    setDashboard((current) => ({ ...current, status: "draft", pages: [...current.pages, duplicate] }));
    setActivePageId(duplicate.id);
    selectPage();
  }

  function deleteActivePage() {
    if (dashboard.pages.length <= 1) return;

    const remainingPages = sortedPages.filter((page) => page.id !== activePage.id).map((page, index) => ({ ...page, order: index + 1 }));
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
      const duplicate: DashboardTile = {
        ...selectedTile,
        id: makeTileId(),
        name: `${selectedTile.name} copy`,
        title: `${selectedTile.title} copy`,
        layout: {
          ...selectedTile.layout,
          x: selectedTile.layout.x + 24,
          y: selectedTile.layout.y + 24,
          zIndex: nextZIndex(activePage)
        },
        appearance: {
          ...selectedTile.appearance,
          palette: [...selectedTile.appearance.palette],
          barStyles: { ...selectedTile.appearance.barStyles }
        }
      };

      setDashboard((current) => ({
        ...current,
        status: "draft",
        pages: current.pages.map((page) => (page.id === activePage.id ? { ...page, tiles: [...page.tiles, duplicate] } : page))
      }));
      selectTile(duplicate.id);
      return;
    }

    if (selectedElement) {
      const duplicate: DashboardCanvasElement = {
        ...selectedElement,
        id: makeElementId(),
        name: `${selectedElement.name} copy`,
        layout: {
          ...selectedElement.layout,
          x: selectedElement.layout.x + 24,
          y: selectedElement.layout.y + 24,
          zIndex: nextZIndex(activePage)
        },
        style: { ...selectedElement.style }
      };

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
        <BuilderPanel className="panel controls" label="Data controls">
          {leftPanelView === "layers" ? (
            <>
              <div className="panel-title with-action">
                <h2>Layers</h2>
                <button type="button" className="mini-button" onClick={() => setLeftPanelView("pages")}>Close</button>
              </div>
              <div className="layers-list expanded">
                {layerItems.length === 0 ? (
                  <div className="empty-state compact">No layers yet.</div>
                ) : (
                  layerItems.map((item) => (
                    <div
                      className={(item.type === "tile" && item.id === selectedTileId) || (item.type === "element" && item.id === selectedElementId) ? "layer-row active" : "layer-row"}
                      key={`${item.type}-${item.id}`}
                    >
                      <button type="button" className="layer-name" onClick={() => chooseLayer(item)}>
                        <span>{item.type === "tile" ? "Chart" : "Item"}</span>
                        {item.name}
                      </button>
                      <button
                        type="button"
                        className="mini-button"
                        onClick={() => (item.type === "tile" ? updateTile(item.id, { hidden: !item.hidden }) : updateElement(item.id, { hidden: !item.hidden }))}
                      >
                        {item.hidden ? "Show" : "Hide"}
                      </button>
                      <button
                        type="button"
                        className="mini-button"
                        onClick={() => (item.type === "tile" ? updateTile(item.id, { locked: !item.locked }) : updateElement(item.id, { locked: !item.locked }))}
                      >
                        {item.locked ? "Unlock" : "Lock"}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <>
              {leftPanelView === "pages" && (
                <>
              <div className="panel-title">
                <h2>Pages</h2>
              </div>
              <div className="page-list">
                {sortedPages.map((page) => (
                  <button
                    type="button"
                    key={page.id}
                    className={page.id === activePage.id ? "page-tab active" : "page-tab"}
                    onClick={() => {
                      setActivePageId(page.id);
                      selectPage();
                    }}
                  >
                    <span>{page.order}</span>
                    {page.title}
                  </button>
                ))}
              </div>
              <div className="brand-card-actions">
                <button type="button" className="secondary" onClick={() => addPage()}>
                New page
                </button>
                <button type="button" className="secondary" onClick={duplicateActivePage}>
                  Duplicate page
                </button>
              </div>
              <div className="explorer-section-card">
                <div className="explorer-section-header">
                  <strong>Page templates</strong>
                  <small>{pageTemplates.length} ready to use</small>
                </div>
                <div className="brand-theme-list">
                  {pageTemplates.map((template) => (
                    <button type="button" key={template.id} className="brand-theme-card" onClick={() => addPage(template)}>
                      <span
                        className="brand-theme-preview"
                        style={{ background: themePreviewBackground(pageThemes.find((theme) => theme.id === template.pageThemeId)) }}
                      />
                      <div>
                        <strong>{template.label}</strong>
                        <small>{template.description}</small>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              </>
              )}

              {leftPanelView === "insert" && (
                <>
              <div className="panel-title">
                <h2>Insert</h2>
              </div>
              <div className="insert-grid">
                <button type="button" className="secondary" onClick={() => addCanvasElement("text")}>Text</button>
                <button type="button" className="secondary" onClick={() => addCanvasElement("rectangle")}>Rectangle</button>
                <button type="button" className="secondary" onClick={() => addCanvasElement("circle")}>Circle</button>
                <button type="button" className="secondary" onClick={() => addCanvasElement("image")}>Image</button>
              </div>
              </>
              )}

              {leftPanelView === "brand" && (
                <>
              <div className="panel-title">
                <h2>Brand</h2>
              </div>
              <div className="brand-panel">
                <div className="color-summary-card">
                  <div>
                    <span>Design library</span>
                    <strong>EcoFocus system</strong>
                  </div>
                  <small>Reusable palettes, typography presets, and page themes for faster report building.</small>
                </div>
                <div className="brand-context-card">
                  <span>Current focus</span>
                  <strong>
                    {selectedTextElement
                      ? "Selected text block"
                      : selectedTile
                      ? selectedTile.title
                      : "Active page"}
                  </strong>
                  <small>
                    {selectedTextElement
                      ? "Apply text styles directly to the selected text element."
                      : selectedTile
                      ? "Apply a palette to the selected chart tile or across all chart tiles."
                      : "Apply page themes to the active canvas while you build."}
                  </small>
                </div>
                <div className="explorer-section-card">
                  <div className="explorer-section-header">
                    <strong>Palettes</strong>
                    <small>{designPalettes.length} saved</small>
                  </div>
                  <div className="brand-palette-list">
                    {designPalettes.map((palette) => (
                      <div key={palette.id} className="brand-palette-card">
                        <div className="brand-palette-header">
                          <div>
                            <strong>{palette.label}</strong>
                            <small>{palette.description}</small>
                          </div>
                          <div className="brand-swatch-row">
                            {palette.colors.map((color) => (
                              <span key={color} className="brand-swatch" style={{ background: color }} />
                            ))}
                          </div>
                        </div>
                        <div className="brand-card-actions">
                          <button type="button" className="secondary" onClick={() => applyPaletteToTile(palette, "selected")} disabled={!selectedTile}>
                            Apply to tile
                          </button>
                          <button type="button" className="secondary" onClick={() => applyPaletteToTile(palette, "all")}>
                            Apply to all charts
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="explorer-section-card">
                  <div className="explorer-section-header">
                    <strong>Text styles</strong>
                    <small>{textStylePresets.length} presets</small>
                  </div>
                  <div className="brand-style-list">
                    {textStylePresets.map((preset) => (
                      <button type="button" key={preset.id} className="brand-text-style-card" onClick={() => applyTextStylePresetToSelection(preset)} disabled={!selectedTextElement}>
                        <span>{preset.label}</span>
                        <strong
                          style={{
                            fontFamily: preset.fontFamily,
                            fontSize: Math.min(preset.fontSize, 22),
                            fontWeight: preset.fontWeight,
                            color: preset.textColor,
                            textAlign: preset.textAlign
                          }}
                        >
                          EcoFocus
                        </strong>
                        <small>{preset.description}</small>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="explorer-section-card">
                  <div className="explorer-section-header">
                    <strong>Content blocks</strong>
                    <small>{textBlockPresets.length} ready to place</small>
                  </div>
                  <div className="brand-block-list">
                    {textBlockPresets.map((block) => (
                      <button type="button" key={block.id} className="brand-block-card" onClick={() => addTextBlockPreset(block)}>
                        <div className="brand-block-card__header">
                          <strong>{block.label}</strong>
                          <small>{block.description}</small>
                        </div>
                        <p>{block.content}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="explorer-section-card">
                  <div className="explorer-section-header">
                    <strong>Page themes</strong>
                    <small>{pageThemes.length} saved</small>
                  </div>
                  <div className="brand-theme-list">
                    {pageThemes.map((theme) => (
                      <button type="button" key={theme.id} className="brand-theme-card" onClick={() => applyPageTheme(theme)}>
                        <span
                          className="brand-theme-preview"
                          style={{
                            background:
                              theme.backgroundMode === "gradient"
                                ? gradientCss(theme.gradientFrom, theme.gradientTo, theme.gradientStops, theme.gradientType, `${theme.gradientAngle}deg`)
                                : theme.background
                          }}
                        />
                        <div>
                          <strong>{theme.label}</strong>
                          <small>{theme.description}</small>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              </>
              )}

              {leftPanelView === "data" && (
                <>
              <div className="panel-title">
                <h2>Explore</h2>
              </div>
              <div className="data-explorer">
                <div className="color-summary-card">
                  <div>
                    <span>Dataset</span>
                    <strong>{defaultDataset.label}</strong>
                  </div>
                  <small>{defaultDataset.description}</small>
                </div>
                <div className="explore-flow-tabs">
                  <button type="button" className={exploreView === "source" ? "active" : ""} onClick={() => setExploreView("source")}>
                    1. Source
                  </button>
                  <button type="button" className={exploreView === "analyze" ? "active" : ""} onClick={() => setExploreView("analyze")}>
                    2. Analyze
                  </button>
                  <button type="button" className={exploreView === "library" ? "active" : ""} onClick={() => setExploreView("library")}>
                    3. Library
                  </button>
                </div>
                <div className="explore-step-card">
                  {exploreView === "source" && (
                    <>
                      <div>
                        <span>Step 1</span>
                        <strong>Choose a source</strong>
                      </div>
                      <small>Pick a saved variable set or question. You can click to load it or drag it straight onto the canvas.</small>
                    </>
                  )}
                  {exploreView === "analyze" && (
                    <>
                      <div>
                        <span>Step 2</span>
                        <strong>Shape the analysis</strong>
                      </div>
                      <small>Adjust banner, metric, weight, filter, and chart type for the currently selected source before adding a tile.</small>
                    </>
                  )}
                  {exploreView === "library" && (
                    <>
                      <div>
                        <span>Step 3</span>
                        <strong>Save reusable objects</strong>
                      </div>
                      <small>Turn the current setup into reusable variable sets, banners, filters, or weights for faster reporting.</small>
                    </>
                  )}
                </div>

                {exploreView === "source" && (
                  <>
                    <div className="color-summary-card compact">
                      <div>
                        <span>Current source</span>
                        <strong>{selectedVariableSet ? selectedVariableSet.label : selectedQuestion.shortLabel}</strong>
                      </div>
                      <small>{selectedVariableSet ? selectedVariableSet.description : selectedQuestion.topic}</small>
                    </div>
                    <label>
                      Search sources
                      <input value={sourceSearch} onChange={(event) => setSourceSearch(event.target.value)} placeholder="Search questions or variable sets" />
                    </label>
                    <div className="explore-subtabs">
                      <button type="button" className={sourceLibraryView === "variableSets" ? "active" : ""} onClick={() => setSourceLibraryView("variableSets")}>
                        Variable sets
                      </button>
                      <button type="button" className={sourceLibraryView === "questions" ? "active" : ""} onClick={() => setSourceLibraryView("questions")}>
                        Questions
                      </button>
                    </div>
                    {sourceLibraryView === "variableSets" && (
                    <div className="explorer-section-card">
                      <div className="explorer-section-header">
                        <strong>Variable sets</strong>
                        <small>{filteredVariableSets.length} shown</small>
                      </div>
                      <div className="explorer-item-list">
                        {filteredVariableSets.map((item) => (
                          <button
                            type="button"
                            key={item.id}
                            draggable
                            className={selectedDataSource.kind === "variableSet" && selectedDataSource.id === item.id ? "explorer-item active" : "explorer-item"}
                            onClick={() => applyVariableSetSelection(item)}
                            onDragStart={(event) => startDataSourceDrag({ kind: "variableSet", id: item.id }, event)}
                          >
                            <strong>{item.label}</strong>
                            <span>{item.topic} · Drag to canvas</span>
                          </button>
                        ))}
                        {filteredVariableSets.length === 0 && <div className="empty-state compact">No variable sets match that search.</div>}
                      </div>
                    </div>
                    )}
                    {sourceLibraryView === "questions" && (
                    <div className="explorer-section-card">
                      <div className="explorer-section-header">
                        <strong>Questions</strong>
                        <small>{filteredQuestions.length} shown</small>
                      </div>
                      <div className="explorer-item-list">
                        {filteredQuestions.map((item) => (
                          <button
                            type="button"
                            key={item.id}
                            draggable
                            className={selectedDataSource.kind === "question" && selectedDataSource.id === item.id ? "explorer-item active" : "explorer-item"}
                            onClick={() => applyQuestionSelection(item)}
                            onDragStart={(event) => startDataSourceDrag({ kind: "question", id: item.id }, event)}
                          >
                            <strong>{item.shortLabel}</strong>
                            <span>{item.topic} · Drag to canvas</span>
                          </button>
                        ))}
                        {filteredQuestions.length === 0 && <div className="empty-state compact">No questions match that search.</div>}
                      </div>
                    </div>
                    )}
                  </>
                )}

                {exploreView === "analyze" && (
                  <>
                    <div className="explorer-section-card compact">
                      <div className="explorer-section-header">
                        <strong>Analysis summary</strong>
                        <small>Current setup</small>
                      </div>
                      <div className="explorer-chip-row">
                        <span className="explorer-chip">Banner: {bannerDimensions.find((item) => item.id === breakBy)?.label ?? breakBy}</span>
                        <span className="explorer-chip">
                          Compare: {comparisonMode === "wave"
                            ? comparisonDatasetOptions
                                .filter((dataset) => comparisonDatasets.includes(dataset.id))
                                .map((dataset) => dataset.wave)
                                .join(" vs ") || "Choose wave(s)"
                            : "None"}
                        </span>
                        <span className="explorer-chip">Metric: {defaultDataset.metrics.find((item) => item.id === metric)?.label ?? metric}</span>
                        <span className="explorer-chip">Weight: {weight ? defaultDataset.weights.find((item) => item.id === weight)?.label ?? weight : "Unweighted"}</span>
                        <span className="explorer-chip">
                          Filter: {selectedFilterDimension && filterValue !== "all"
                            ? selectedFilterDimension.values.find((item) => item.id === filterValue)?.label ?? filterValue
                            : "None"}
                        </span>
                      </div>
                    </div>
                    <div className="explorer-section-card">
                      <div className="explorer-section-header">
                        <strong>Analysis settings</strong>
                        <small>Current query</small>
                      </div>
                      <label>
                        Banner
                        <select value={breakBy} onChange={(event) => setBreakBy(event.target.value as BreakById)} disabled={comparisonMode === "wave"}>
                          {bannerDimensions
                            .filter((item) => selectedQuestion.allowedBreakBys.includes(item.id as BreakById))
                            .map((item) => (
                              <option value={item.id} key={item.id}>
                                {item.label}
                              </option>
                            ))}
                        </select>
                      </label>
                      <div className="compact-grid">
                        <label>
                          Cells
                          <select value={metric} onChange={(event) => setMetric(event.target.value as Metric)}>
                            {selectedQuestion.allowedMetrics.map((item) => (
                              <option value={item} key={item}>
                                {defaultDataset.metrics.find((metricItem) => metricItem.id === item)?.label ?? item}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Weight
                          <select value={weight ?? "none"} onChange={(event) => setWeight(event.target.value === "none" ? null : (event.target.value as WeightId))}>
                            <option value="none">Unweighted</option>
                            {defaultDataset.weights.map((item) => (
                              <option value={item.id} key={item.id}>
                                {item.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="compact-grid">
                        <label>
                          Filter field
                          <select value={filterField ?? "none"} onChange={(event) => setFilterField(event.target.value === "none" ? null : (event.target.value as FilterFieldId))}>
                            <option value="none">No filter</option>
                            {filterDimensions.map((item) => (
                              <option value={item.id} key={item.id}>
                                {item.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        {selectedFilterDimension ? (
                          <label>
                            Filter value
                            <select value={filterValue} onChange={(event) => setFilterValue(event.target.value)}>
                              <option value="all">All {selectedFilterDimension.label.toLowerCase()}s</option>
                              {selectedFilterDimension.values.map((item) => (
                                <option value={item.id} key={item.id}>
                                  {item.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : (
                          <div className="explorer-meta-block">
                            <span>No filter selected</span>
                          </div>
                        )}
                      </div>
                      <div className="compact-grid">
                        <label>
                          Comparison
                          <select
                            value={comparisonMode}
                            onChange={(event) => {
                              const nextMode = event.target.value as ComparisonMode;
                              setComparisonMode(nextMode);
                              if (nextMode === "none") {
                                setComparisonDatasets([]);
                              }
                            }}
                          >
                            <option value="none">None</option>
                            <option value="wave">Wave comparison</option>
                          </select>
                        </label>
                        {comparisonMode === "wave" ? (
                          <div className="explorer-meta-block">
                            <span>Wave comparisons use Summary as the banner.</span>
                          </div>
                        ) : (
                          <div className="explorer-meta-block">
                            <span>Use comparisons to trend the same question across waves.</span>
                          </div>
                        )}
                      </div>
                      {comparisonMode === "wave" && (
                        <div className="explorer-section-card compact nested">
                          <div className="explorer-section-header">
                            <strong>Comparison waves</strong>
                            <small>Select one or more historical datasets</small>
                          </div>
                          <div className="explorer-chip-row comparison-chip-row">
                            {comparisonDatasetOptions.map((dataset) => (
                              <button
                                type="button"
                                key={dataset.id}
                                className={comparisonDatasets.includes(dataset.id) ? "explorer-chip-button active" : "explorer-chip-button secondary-chip"}
                                onClick={() => toggleComparisonDataset(dataset.id)}
                              >
                                {dataset.wave}
                              </button>
                            ))}
                          </div>
                          <small className="explorer-helper-copy">
                            Compare the active dataset against one or more prior waves using the same question and summary breakout.
                          </small>
                        </div>
                      )}
                      <label>
                        Output
                        <select value={chartType} onChange={(event) => setChartType(event.target.value as ChartType)}>
                          {selectedChartTypes.map((item) => (
                            <option value={item} key={item}>
                              {defaultDataset.chartTypes.find((chartItem) => chartItem.id === item)?.label ?? item}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="explorer-output-card">
                        <div className="explorer-section-header">
                          <strong>Create output</strong>
                          <small>Start with a table or place a chart directly</small>
                        </div>
                        <div className="explorer-output-actions">
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => addTileFromSourceWithVisualization("table")}
                            disabled={isLoading || !selectedChartTypes.includes("table")}
                          >
                            {isLoading && chartType === "table" ? "Adding..." : "Add table"}
                          </button>
                          <button
                            type="button"
                            onClick={() => addTileFromSourceWithVisualization(chartType === "table" ? (selectedChartTypes.find((item) => item !== "table") ?? "vertical_bar") : chartType)}
                            disabled={isLoading}
                          >
                            {isLoading && chartType !== "table" ? "Adding..." : `Add ${getChartTypeLabel(chartType === "table" ? (selectedChartTypes.find((item) => item !== "table") ?? "vertical_bar") : chartType)}`}
                          </button>
                        </div>
                        <small className="explorer-helper-copy">
                          Tables are the analytical starting point. You can convert them into charts after placement.
                        </small>
                      </div>
                    </div>
                  </>
                )}

                {exploreView === "library" && (
                  <>
                    <div className="explore-subtabs library">
                      <button type="button" className={analysisLibraryView === "variableSets" ? "active" : ""} onClick={() => setAnalysisLibraryView("variableSets")}>
                        Variable sets
                      </button>
                      <button type="button" className={analysisLibraryView === "banners" ? "active" : ""} onClick={() => setAnalysisLibraryView("banners")}>
                        Banners
                      </button>
                      <button type="button" className={analysisLibraryView === "filters" ? "active" : ""} onClick={() => setAnalysisLibraryView("filters")}>
                        Filters
                      </button>
                      <button type="button" className={analysisLibraryView === "weights" ? "active" : ""} onClick={() => setAnalysisLibraryView("weights")}>
                        Weights
                      </button>
                    </div>
                    {analysisLibraryView === "variableSets" && (
                    <div className="explorer-section-card">
                      <div className="explorer-section-header">
                        <strong>Variable set editor</strong>
                        <small>Save and update reusable sources</small>
                      </div>
                      <label>
                        Variable set name
                        <input value={variableSetDraftName} onChange={(event) => setVariableSetDraftName(event.target.value)} placeholder="Name this saved set" />
                      </label>
                      <label>
                        Description
                        <input value={variableSetDescription} onChange={(event) => setVariableSetDescription(event.target.value)} placeholder="Describe this variable set" />
                      </label>
                      <label>
                        Primary question
                        <select
                          value={question}
                          onChange={(event) => {
                            const nextQuestion = defaultDataset.questions.find((item) => item.id === event.target.value) ?? defaultQuestion;
                            setQuestion(nextQuestion.id);
                            setBreakBy(nextQuestion.allowedBreakBys[0]);
                            setMetric(nextQuestion.defaultMetric);
                            setChartType(defaultVisualizationForQuestion(nextQuestion));
                            setVariableSetRows(defaultVariableSetRows(nextQuestion.id));
                            setVariableSetOptionSelection([]);
                          }}
                        >
                          {variableSetQuestionIds.map((questionId) => {
                            const item = defaultDataset.questions.find((entry) => entry.id === questionId);
                            if (!item) return null;
                            return (
                              <option value={item.id} key={item.id}>
                                {item.shortLabel}
                              </option>
                            );
                          })}
                        </select>
                      </label>
                      <div className="explorer-question-picker">
                        <span>Included questions</span>
                        <div className="explorer-question-list">
                          {defaultDataset.questions.map((item) => (
                            <label key={item.id} className={variableSetQuestionIds.includes(item.id) ? "explorer-question-option active" : "explorer-question-option"}>
                              <input
                                type="checkbox"
                                checked={variableSetQuestionIds.includes(item.id)}
                                onChange={() => toggleVariableSetQuestion(item.id)}
                              />
                              <div>
                                <strong>{item.shortLabel}</strong>
                                <span>{item.topic}</span>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="explorer-section-card compact nested">
                        <div className="explorer-section-header">
                          <strong>Variable logic</strong>
                          <small>Author visible rows, nets, and boxes</small>
                        </div>
                        <div className="explorer-chip-row">
                          <button type="button" className="explorer-chip-button secondary-chip" onClick={resetVariableSetRows}>
                            Reset rows
                          </button>
                          <button type="button" className="explorer-chip-button secondary-chip" onClick={revealAllVariableSetRows}>
                            Reveal all
                          </button>
                          <button type="button" className="explorer-chip-button secondary-chip" onClick={markVariableSetRowsAsDetails}>
                            Mark all detail
                          </button>
                        </div>
                        <div className="explorer-question-list compact">
                          {selectedQuestion.options.map((option) => {
                            const included = variableSetRows.some((row) => row.kind === "option" && row.sourceOptionIds[0] === option.id);
                            const selectedForNet = variableSetOptionSelection.includes(option.id);
                            return (
                              <label key={option.id} className={included || selectedForNet ? "explorer-question-option active" : "explorer-question-option"}>
                                <input
                                  type="checkbox"
                                  checked={included}
                                  onChange={() => toggleVariableSetOptionRow(option.id, option.label)}
                                />
                                <div>
                                  <strong>{option.label}</strong>
                                  <span>
                                    <button type="button" className={selectedForNet ? "mini-button active" : "mini-button"} onClick={() => toggleVariableSetOptionSelection(option.id)}>
                                      {selectedForNet ? "Selected for net" : "Select for net"}
                                    </button>
                                  </span>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                        <div className="compact-grid">
                          <button type="button" className="secondary" onClick={() => addVariableSetNet("net")}>
                            Add net
                          </button>
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => addVariableSetNet("top")}
                            disabled={selectedQuestion.type !== "single_select"}
                          >
                            Add top 2 box
                          </button>
                        </div>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => addVariableSetNet("bottom")}
                          disabled={selectedQuestion.type !== "single_select"}
                        >
                          Add bottom 2 box
                        </button>
                        <div className="explorer-item-list compact">
                          {variableSetRows
                            .slice()
                            .sort((a, b) => a.rowOrder - b.rowOrder)
                            .map((row, index) => (
                              <div key={row.id} className="explorer-item active variable-set-row">
                                <div className="variable-set-row__top">
                                  <strong>{rowKindLabel(row.kind)}</strong>
                                  <span>{row.sourceOptionIds.join(", ")}</span>
                                </div>
                                <div className="explorer-chip-row variable-set-row__chips">
                                  <span className="explorer-chip">{row.emphasis === "summary" ? "Summary row" : "Detail row"}</span>
                                  <span className="explorer-chip">{row.visible ? "Visible" : "Hidden"}</span>
                                </div>
                                <input value={row.label} onChange={(event) => updateVariableSetRow(row.id, { label: event.target.value })} />
                                <div className="compact-grid">
                                  <label>
                                    Row style
                                    <select
                                      value={row.emphasis}
                                      onChange={(event) => updateVariableSetRow(row.id, { emphasis: event.target.value as "detail" | "summary" })}
                                    >
                                      <option value="detail">Detail</option>
                                      <option value="summary">Summary</option>
                                    </select>
                                  </label>
                                  <label>
                                    Visibility
                                    <select
                                      value={row.visible ? "visible" : "hidden"}
                                      onChange={(event) => updateVariableSetRow(row.id, { visible: event.target.value === "visible" })}
                                    >
                                      <option value="visible">Visible</option>
                                      <option value="hidden">Hidden</option>
                                    </select>
                                  </label>
                                </div>
                                <div className="variable-set-row__actions">
                                  <button type="button" className="secondary" onClick={() => reorderVariableSetRow(row.id, "up")} disabled={index === 0}>
                                    Up
                                  </button>
                                  <button
                                    type="button"
                                    className="secondary"
                                    onClick={() => reorderVariableSetRow(row.id, "down")}
                                    disabled={index === variableSetRows.length - 1}
                                  >
                                    Down
                                  </button>
                                  <button type="button" className="secondary" onClick={() => removeVariableSetRow(row.id)}>
                                    Remove
                                  </button>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                      <div className="compact-grid">
                        <button type="button" className="secondary" onClick={() => saveCurrentVariableSet(!selectedVariableSet)}>
                          {selectedVariableSet ? "Update set" : "Save set"}
                        </button>
                        <button type="button" className="secondary" disabled={!selectedVariableSet} onClick={() => selectedVariableSet && deleteVariableSet(selectedVariableSet.id)}>
                          Delete set
                        </button>
                      </div>
                    </div>
                    )}
                    {analysisLibraryView === "banners" && (
                    <div className="explorer-section-card">
                      <div className="explorer-section-header">
                        <strong>Saved banners</strong>
                        <small>{savedBanners.length} saved</small>
                      </div>
                      <div className="explorer-item-list compact">
                        {savedBanners.map((item) => (
                          <button type="button" key={item.id} className={item.breakBy === breakBy ? "explorer-item active" : "explorer-item"} onClick={() => applySavedBanner(item)}>
                            <strong>{item.label}</strong>
                            <span>{item.description}</span>
                          </button>
                        ))}
                      </div>
                      <div className="compact-grid">
                        <input value={bannerDraftName} onChange={(event) => setBannerDraftName(event.target.value)} placeholder="Save current banner" />
                        <button type="button" className="secondary" onClick={saveCurrentBanner}>Save banner</button>
                      </div>
                    </div>
                    )}
                    {analysisLibraryView === "filters" && (
                    <div className="explorer-section-card">
                      <div className="explorer-section-header">
                        <strong>Saved filters</strong>
                        <small>{savedFilters.length} saved</small>
                      </div>
                      <div className="explorer-item-list compact">
                        {savedFilters.map((item) => (
                          <button type="button" key={item.id} className={item.filterField === filterField && item.filterValue === filterValue ? "explorer-item active" : "explorer-item"} onClick={() => applySavedFilter(item)}>
                            <strong>{item.label}</strong>
                            <span>{item.description}</span>
                          </button>
                        ))}
                      </div>
                      <div className="compact-grid">
                        <input value={filterDraftName} onChange={(event) => setFilterDraftName(event.target.value)} placeholder="Save current filter" />
                        <button type="button" className="secondary" onClick={saveCurrentFilter}>Save filter</button>
                      </div>
                    </div>
                    )}
                    {analysisLibraryView === "weights" && (
                    <div className="explorer-section-card">
                      <div className="explorer-section-header">
                        <strong>Saved weights</strong>
                        <small>{savedWeights.length} saved</small>
                      </div>
                      <div className="explorer-item-list compact">
                        {savedWeights.map((item) => (
                          <button type="button" key={item.id} className={item.weight === weight ? "explorer-item active" : "explorer-item"} onClick={() => applySavedWeight(item)}>
                            <strong>{item.label}</strong>
                            <span>{item.description}</span>
                          </button>
                        ))}
                      </div>
                      <div className="compact-grid">
                        <input value={weightDraftName} onChange={(event) => setWeightDraftName(event.target.value)} placeholder="Save current weight" />
                        <button type="button" className="secondary" onClick={saveCurrentWeight}>Save weight</button>
                      </div>
                    </div>
                    )}
                  </>
                )}
              </div>
              {error && <div className="error">{error}</div>}
              </>
              )}
            </>
          )}
        </BuilderPanel>

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

        <BuilderPanel className="panel settings" label="Tile settings">
          <div className="panel-title">
            <h2>Settings</h2>
          </div>
          {settingsView === "home" ? (
            <div className="settings-menu">
              <button type="button" className="menu-card" onClick={() => setSettingsView("page")}>
                <strong>Page</strong>
                <span>Title, grid, snap, and background</span>
              </button>
              <button type="button" className="menu-card" onClick={() => setSettingsView("layout")} disabled={!selectedTile && !selectedElement}>
                <strong>Arrange</strong>
                <span>Layer order, alignment, size, and position</span>
              </button>
              <button type="button" className="menu-card" onClick={() => setSettingsView(selectedElement ? "element" : "chart")} disabled={!selectedTile && !selectedElement}>
                <strong>{selectedElement ? "Element" : "Tile"}</strong>
                <span>{selectedElement ? "Shape, image, and text styling" : "Chart design and visualization"}</span>
              </button>
              <button type="button" className="menu-card" onClick={() => setSettingsView("container")} disabled={!selectedTile}>
                <strong>Container</strong>
                <span>Tile background, borders, and notes</span>
              </button>
            </div>
          ) : (
            <>
              <div className="panel-title with-action">
                <h2>{settingsView === "page" ? "Page" : settingsView === "layout" ? "Arrange" : settingsView === "container" ? "Container" : selectedElement ? "Element" : "Chart"}</h2>
                <button type="button" className="mini-button" onClick={() => setSettingsView("home")}>Back</button>
              </div>
          {settingsView === "page" && (
            <>
          <label>
            Page title
            <input value={activePage.title} onChange={(event) => updateActivePage({ title: event.target.value })} />
          </label>
          <div className="panel-title subtle">
            <h2>Canvas</h2>
          </div>
          <label>
            Grid size
            <input
              type="number"
              min="8"
              max="96"
              step="4"
              value={activePage.gridSize}
              onChange={(event) => updateActivePage({ gridSize: Math.min(96, Math.max(8, Number(event.target.value) || defaultGridSize)) })}
            />
          </label>
          <div className="toggle-list">
            <label>
              <input type="checkbox" checked={activePage.showCanvasGrid} onChange={(event) => updateActivePage({ showCanvasGrid: event.target.checked })} /> Show grid
            </label>
            <label>
              <input type="checkbox" checked={activePage.snapToGrid} onChange={(event) => updateActivePage({ snapToGrid: event.target.checked })} /> Snap to grid
            </label>
          </div>
          <button type="button" className="design-popover-button" onClick={() => setDesignModal("pageBackground")}>
            <span
              className="gradient-button-preview"
              style={{
                background:
                  activePage.backgroundMode === "image" && activePage.backgroundImage
                    ? `center / cover no-repeat url("${activePage.backgroundImage.replace(/"/g, '\\"')}")`
                    : activePage.backgroundMode === "gradient"
                      ? gradientCss(activePage.gradientFrom, activePage.gradientTo, activePage.gradientStops, activePage.gradientType, `${activePage.gradientAngle}deg`)
                      : activePage.background
              }}
            />
            <span>Background</span>
            <small>{activePage.backgroundMode === "image" ? "Image" : activePage.backgroundMode[0].toUpperCase() + activePage.backgroundMode.slice(1)}</small>
          </button>
          <div className="brand-card-actions">
            <button type="button" className="secondary" onClick={duplicateActivePage}>
              Duplicate page
            </button>
          <button type="button" className="secondary" onClick={deleteActivePage} disabled={dashboard.pages.length <= 1}>
            Delete page
          </button>
          </div>
            </>
          )}
          {settingsView === "layout" && (selectedTile || selectedElement) && (
            <>
              <div className="panel-title subtle">
                <h2>Layers</h2>
              </div>
              <div className="layer-grid">
                <button type="button" className="secondary" onClick={() => changeSelectedLayer("front")}>Front</button>
                <button type="button" className="secondary" onClick={() => changeSelectedLayer("forward")}>Forward</button>
                <button type="button" className="secondary" onClick={() => changeSelectedLayer("backward")}>Backward</button>
                <button type="button" className="secondary" onClick={() => changeSelectedLayer("back")}>Back</button>
              </div>
              <div className="panel-title subtle">
                <h2>Arrange</h2>
              </div>
              <div className="layer-grid">
                <button type="button" className="secondary" onClick={() => alignSelected("left")}>Left</button>
                <button type="button" className="secondary" onClick={() => alignSelected("center")}>Center</button>
                <button type="button" className="secondary" onClick={() => alignSelected("right")}>Right</button>
                <button type="button" className="secondary" onClick={() => alignSelected("top")}>Top</button>
                <button type="button" className="secondary" onClick={() => alignSelected("middle")}>Middle</button>
                <button type="button" className="secondary" onClick={() => alignSelected("bottom")}>Bottom</button>
              </div>
              <div className="panel-title subtle">
                <h2>Quick layouts</h2>
              </div>
              <div className="settings-menu">
                <button type="button" className="menu-card" onClick={() => applyLayoutPreset("hero")}>
                  <strong>Hero frame</strong>
                  <span>Wide placement near the top for lead stories and opening statements.</span>
                </button>
                <button type="button" className="menu-card" onClick={() => applyLayoutPreset("leftColumn")}>
                  <strong>Left column</strong>
                  <span>Anchor the selected item into a narrow left reading column.</span>
                </button>
                <button type="button" className="menu-card" onClick={() => applyLayoutPreset("rightColumn")}>
                  <strong>Right column</strong>
                  <span>Move the selected item into a right-side comparison or support slot.</span>
                </button>
                <button type="button" className="menu-card" onClick={() => applyLayoutPreset("footer")}>
                  <strong>Footer note</strong>
                  <span>Place the selected item low on the canvas for sources or supporting notes.</span>
                </button>
              </div>
              <div className="layout-grid">
                <label>
                  X
                  <input type="number" value={selectedTile?.layout.x ?? selectedElement?.layout.x ?? 0} onChange={(event) => updateSelectedLayout({ x: Number(event.target.value) })} />
                </label>
                <label>
                  Y
                  <input type="number" value={selectedTile?.layout.y ?? selectedElement?.layout.y ?? 0} onChange={(event) => updateSelectedLayout({ y: Number(event.target.value) })} />
                </label>
                <label>
                  W
                  <input type="number" value={selectedTile?.layout.width ?? selectedElement?.layout.width ?? 0} onChange={(event) => updateSelectedLayout({ width: Number(event.target.value) })} />
                </label>
                <label>
                  H
                  <input type="number" value={selectedTile?.layout.height ?? selectedElement?.layout.height ?? 0} onChange={(event) => updateSelectedLayout({ height: Number(event.target.value) })} />
                </label>
              </div>
            </>
          )}
          {(settingsView === "element" || settingsView === "chart" || settingsView === "container") && (
            <>
          <div className="panel-title subtle">
            <h2>{selectedElement ? "Element" : "Tile"}</h2>
          </div>
          {selectedElement ? (
            <>
              <label>
                Layer name
                <input value={selectedElement.name} onChange={(event) => updateSelectedElement({ name: event.target.value })} />
              </label>
              {selectedElement.type !== "rectangle" && selectedElement.type !== "circle" && (
                <>
                  <label>
                    {selectedElement.type === "image" ? "Image URL" : "Text"}
                    <input value={selectedElement.content} onChange={(event) => updateSelectedElement({ content: event.target.value })} />
                  </label>
                </>
              )}
              {selectedElement.type === "image" && (
                <label>
                  Image fit
                  <select
                    value={selectedElement.style.objectFit}
                    onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, objectFit: event.target.value as DashboardCanvasElement["style"]["objectFit"] } })}
                  >
                    <option value="cover">Crop to fill</option>
                    <option value="contain">Fit inside</option>
                    <option value="fill">Stretch</option>
                  </select>
                </label>
              )}
              {selectedElement.type === "text" && (
                <>
                  <div className="panel-title subtle">
                    <h2>Typography</h2>
                  </div>
                  <div className="settings-menu">
                    {textStylePresets.map((preset) => (
                      <button type="button" key={preset.id} className="menu-card" onClick={() => applyTextStylePresetToSelection(preset)}>
                        <strong>{preset.label}</strong>
                        <span>{preset.description}</span>
                      </button>
                    ))}
                  </div>
                  <label>
                    Font
                    <select
                      value={selectedElement.style.fontFamily}
                      onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, fontFamily: event.target.value } })}
                    >
                      {fontFamilies.map((font) => (
                        <option key={font.label} value={font.value}>
                          {font.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Text color
                    <input
                      type="color"
                      value={selectedElement.style.textColor}
                      onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, textColor: event.target.value } })}
                    />
                  </label>
                  <label>
                    Font size
                    <input
                      type="number"
                      min="10"
                      max="72"
                      value={selectedElement.style.fontSize}
                      onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, fontSize: Number(event.target.value) } })}
                    />
                  </label>
                  <label>
                    Weight
                    <select
                      value={selectedElement.style.fontWeight}
                      onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, fontWeight: event.target.value } })}
                    >
                      <option value="400">Regular</option>
                      <option value="600">Semibold</option>
                      <option value="700">Bold</option>
                      <option value="800">Heavy</option>
                    </select>
                  </label>
                  <div className="segmented three" aria-label="Text alignment">
                    {(["left", "center", "right"] as const).map((alignment) => (
                      <button
                        type="button"
                        key={alignment}
                        className={selectedElement.style.textAlign === alignment ? "active" : ""}
                        onClick={() => updateSelectedElement({ style: { ...selectedElement.style, textAlign: alignment } })}
                      >
                        {alignment}
                      </button>
                    ))}
                  </div>
                  <label>
                    Line height
                    <input
                      type="range"
                      min="0.8"
                      max="2"
                      step="0.05"
                      value={selectedElement.style.lineHeight}
                      style={{ "--range-fill": rangeFill(selectedElement.style.lineHeight, 0.8, 2) } as React.CSSProperties}
                      onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, lineHeight: Number(event.target.value) } })}
                    />
                  </label>
                  <label>
                    Padding
                    <input
                      type="range"
                      min="0"
                      max="40"
                      value={selectedElement.style.padding}
                      style={{ "--range-fill": rangeFill(selectedElement.style.padding, 0, 40) } as React.CSSProperties}
                      onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, padding: Number(event.target.value) } })}
                    />
                  </label>
                  <div className="toggle-list">
                    <label>
                      <input
                        type="checkbox"
                        checked={selectedElement.style.fontStyle === "italic"}
                        onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, fontStyle: event.target.checked ? "italic" : "normal" } })}
                      /> Italic
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={selectedElement.style.textDecoration === "underline"}
                        onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, textDecoration: event.target.checked ? "underline" : "none" } })}
                      /> Underline
                    </label>
                  </div>
                </>
              )}
              {selectedElement.type !== "image" && (
                <label>
                  Fill style
                  <select
                    value={selectedElement.style.fillMode}
                    onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, fillMode: event.target.value as "solid" | "gradient" } })}
                  >
                    <option value="solid">Solid</option>
                    <option value="gradient">Gradient</option>
                  </select>
                </label>
              )}
              {selectedElement.type !== "image" && selectedElement.style.fillMode === "solid" && (
                <label>
                  Fill
                  <input
                    type="color"
                    value={selectedElement.style.fill === "transparent" ? "#ffffff" : selectedElement.style.fill}
                    onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, fill: event.target.value } })}
                  />
                </label>
              )}
              {selectedElement.type !== "image" && selectedElement.style.fillMode === "gradient" && (
                <button type="button" className="design-popover-button" onClick={() => setDesignModal("elementGradient")}>
                  <span className="gradient-button-preview" style={{ background: gradientCss(selectedElement.style.gradientFrom, selectedElement.style.gradientTo, selectedElement.style.gradientStops, selectedElement.style.gradientType) }} />
                  <span>Edit fill gradient</span>
                </button>
              )}
              {(selectedElement.type === "rectangle" || selectedElement.type === "circle" || selectedElement.type === "image" || selectedElement.type === "text") && (
                <>
                  <label>
                    Border
                    <input
                      type="color"
                      value={selectedElement.style.borderColor}
                      onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, borderColor: event.target.value } })}
                    />
                  </label>
                  <label>
                    Border width
                    <input
                      type="range"
                      min="0"
                      max="16"
                      value={selectedElement.style.borderWidth}
                      style={{ "--range-fill": rangeFill(selectedElement.style.borderWidth, 0, 16) } as React.CSSProperties}
                      onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, borderWidth: Number(event.target.value), borderStyle: Number(event.target.value) === 0 ? "none" : selectedElement.style.borderStyle === "none" ? "solid" : selectedElement.style.borderStyle } })}
                    />
                  </label>
                  <label>
                    Border style
                    <select
                      value={selectedElement.style.borderStyle}
                      onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, borderStyle: event.target.value as DashboardCanvasElement["style"]["borderStyle"] } })}
                    >
                      <option value="solid">Solid</option>
                      <option value="dashed">Dashed</option>
                      <option value="dotted">Dotted</option>
                      <option value="none">None</option>
                    </select>
                  </label>
                  {selectedElement.type !== "circle" && (
                    <label>
                      Rounded corners
                      <input
                        type="range"
                        min="0"
                        max="48"
                        value={selectedElement.style.borderRadius}
                        style={{ "--range-fill": rangeFill(selectedElement.style.borderRadius, 0, 48) } as React.CSSProperties}
                        onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, borderRadius: Number(event.target.value) } })}
                      />
                    </label>
                  )}
                  <label>
                    Transparency
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={selectedElement.style.opacity}
                      style={{ "--range-fill": rangeFill(selectedElement.style.opacity, 10, 100) } as React.CSSProperties}
                      onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, opacity: Number(event.target.value) } })}
                    />
                  </label>
                  <button type="button" className="design-popover-button" onClick={() => setDesignModal("elementEffects")}>
                    <span className="effect-button-preview" style={{ boxShadow: effectShadow({ ...selectedElement.style, shadow: selectedElement.style.shadow || selectedElement.style.glow }) }} />
                    <span>Effects</span>
                    <small>{selectedElement.style.shadow || selectedElement.style.glow ? "On" : "None"}</small>
                  </button>
                </>
              )}
              <button
                type="button"
                className="secondary"
                onClick={deleteSelectedItem}
              >
                Remove element
              </button>
            </>
          ) : !selectedTile ? (
            <div className="empty-state compact">Select a canvas item to edit its display.</div>
          ) : settingsView === "container" ? (
            <>
              <div className="panel-title subtle">
                <h2>Tile container</h2>
              </div>
              <label>
                Tile background
                <select
                  value={selectedTile.appearance.backgroundMode}
                  onChange={(event) => updateSelectedAppearance({ backgroundMode: event.target.value as "solid" | "gradient" })}
                >
                  <option value="solid">Solid</option>
                  <option value="gradient">Gradient</option>
                </select>
              </label>
              {selectedTile.appearance.backgroundMode === "solid" ? (
                <ColorField label="Fill color" value={selectedTile.appearance.background} onChange={(value) => updateSelectedAppearance({ background: value })} />
              ) : (
                <button type="button" className="design-popover-button" onClick={() => setDesignModal("tileGradient")}>
                  <span className="gradient-button-preview" style={{ background: gradientCss(selectedTile.appearance.gradientFrom, selectedTile.appearance.gradientTo, selectedTile.appearance.gradientStops, selectedTile.appearance.gradientType) }} />
                  <span>Edit tile gradient</span>
                </button>
              )}
              <ColorField label="Tile border" value={selectedTile.appearance.borderColor} onChange={(value) => updateSelectedAppearance({ borderColor: value })} />
              <label>
                Tile corners
                <input type="range" min="0" max="36" value={selectedTile.appearance.borderRadius} style={{ "--range-fill": rangeFill(selectedTile.appearance.borderRadius, 0, 36) } as React.CSSProperties} onChange={(event) => updateSelectedAppearance({ borderRadius: Number(event.target.value) })} />
              </label>
              <label>
                Tile transparency
                <input type="range" min="20" max="100" value={selectedTile.appearance.opacity} style={{ "--range-fill": rangeFill(selectedTile.appearance.opacity, 20, 100) } as React.CSSProperties} onChange={(event) => updateSelectedAppearance({ opacity: Number(event.target.value) })} />
              </label>
              <button type="button" className="design-popover-button" onClick={() => setDesignModal("tileEffects")}>
                <span className="effect-button-preview" style={{ boxShadow: effectShadow({ ...selectedTile.appearance, shadow: selectedTile.appearance.shadow || selectedTile.appearance.glow }) }} />
                <span>Effects</span>
                <small>{selectedTile.appearance.shadow || selectedTile.appearance.glow ? "On" : "None"}</small>
              </button>
              <button
                type="button"
                className="secondary"
                onClick={deleteSelectedItem}
              >
                Remove tile
              </button>
            </>
          ) : (
            <>
              <div className="panel-title subtle">
                <h2>Content</h2>
              </div>
              <label>
                Title
                <input value={selectedTile.title} onChange={(event) => updateSelectedTile({ title: event.target.value })} />
              </label>
              <div className="panel-title subtle">
                <h2>Analysis</h2>
              </div>
              <div className="inspector-summary-card">
                <span className="inspector-summary-kicker">
                  {tileSourceKindLabel(selectedTile.source)}{selectedTile.source ? `: ${selectedTile.source.label}` : ""}
                </span>
                <strong>{getQuestionLabel(selectedTile.result.metadataRefs.question)}</strong>
                <div className="explorer-chip-row">
                  <span className="explorer-chip">Banner: {bannerDimensions.find((item) => item.id === selectedTile.query.breakBy)?.label ?? selectedTile.query.breakBy}</span>
                  <span className="explorer-chip">Compare: {comparisonSummaryLabel(selectedTile.query)}</span>
                  <span className="explorer-chip">Metric: {selectedTile.result.metric.label}</span>
                  <span className="explorer-chip">Weight: {selectedTile.result.weighting.applied ? selectedTile.result.weighting.label : "Unweighted"}</span>
                  <span className="explorer-chip">
                    Filter: {selectedTile.query.filters.length > 0 ? selectedTile.query.filters.map((filter) => filter.values.join(", ")).join(" · ") : "None"}
                  </span>
                </div>
              </div>
              {selectedTileQuestion && (
                <div className="inspector-summary-card">
                  <span className="inspector-summary-kicker">Edit analysis</span>
                  <div className="compact-grid">
                    <label>
                      Banner
                      <select
                        value={selectedTile.query.breakBy}
                        disabled={selectedTile.query.comparisonMode === "wave"}
                        onChange={(event) =>
                          updateSelectedTile({
                            query: { ...selectedTile.query, breakBy: event.target.value as BreakById }
                          })
                        }
                      >
                        {bannerDimensions
                          .filter((item) => selectedTileQuestion.allowedBreakBys.includes(item.id as BreakById))
                          .map((item) => (
                            <option value={item.id} key={item.id}>
                              {item.label}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Cells
                      <select
                        value={selectedTile.query.metric}
                        onChange={(event) =>
                          updateSelectedTile({
                            query: { ...selectedTile.query, metric: event.target.value as Metric }
                          })
                        }
                      >
                        {selectedTileQuestion.allowedMetrics.map((item) => (
                          <option value={item} key={item}>
                            {defaultDataset.metrics.find((metricItem) => metricItem.id === item)?.label ?? item}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="compact-grid">
                    <label>
                      Comparison
                      <select
                        value={selectedTile.query.comparisonMode ?? "none"}
                        onChange={(event) => {
                          const nextMode = event.target.value as ComparisonMode;
                          const nextVisualization =
                            nextMode === "wave" && !waveComparisonChartTypes.includes(selectedTile.visualization)
                              ? waveComparisonChartTypes[0]
                              : selectedTile.visualization;
                          updateSelectedTile({
                            visualization: nextVisualization,
                            query: {
                              ...selectedTile.query,
                              chartType: nextVisualization,
                              comparisonMode: nextMode,
                              breakBy: nextMode === "wave" ? "SUMMARY" : selectedTile.query.breakBy,
                              comparisonDatasets: nextMode === "wave" ? selectedTile.query.comparisonDatasets ?? [] : []
                            }
                          });
                        }}
                      >
                        <option value="none">None</option>
                        <option value="wave">Wave comparison</option>
                      </select>
                    </label>
                    {(selectedTile.query.comparisonMode ?? "none") === "wave" ? (
                      <div className="explorer-meta-block">
                        <span>Wave comparison locks the banner to Summary.</span>
                      </div>
                    ) : (
                      <div className="explorer-meta-block">
                        <span>Use comparisons to trend the same question across waves.</span>
                      </div>
                    )}
                  </div>
                  {(selectedTile.query.comparisonMode ?? "none") === "wave" && (
                    <div className="explorer-section-card compact nested">
                      <div className="explorer-section-header">
                        <strong>Comparison waves</strong>
                        <small>Select one or more historical datasets</small>
                      </div>
                      <div className="explorer-chip-row comparison-chip-row">
                        {comparisonDatasetOptions.map((dataset) => {
                          const activeComparisons = selectedTile.query.comparisonDatasets ?? [];
                          const active = activeComparisons.includes(dataset.id);
                          return (
                            <button
                              type="button"
                              key={dataset.id}
                              className={active ? "explorer-chip-button active" : "explorer-chip-button secondary-chip"}
                              onClick={() =>
                                updateSelectedTile({
                                  query: {
                                    ...selectedTile.query,
                                    comparisonMode: "wave",
                                    breakBy: "SUMMARY",
                                    comparisonDatasets: active
                                      ? activeComparisons.filter((item) => item !== dataset.id)
                                      : [...activeComparisons, dataset.id]
                                  }
                                })
                              }
                            >
                              {dataset.wave}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div className="compact-grid">
                    <label>
                      Weight
                      <select
                        value={selectedTile.query.weight ?? "none"}
                        onChange={(event) =>
                          updateSelectedTile({
                            query: { ...selectedTile.query, weight: event.target.value === "none" ? null : (event.target.value as WeightId) }
                          })
                        }
                      >
                        <option value="none">Unweighted</option>
                        {defaultDataset.weights.map((item) => (
                          <option value={item.id} key={item.id}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Filter field
                      <select
                        value={selectedTile.query.filters[0]?.field ?? "none"}
                        onChange={(event) =>
                          updateSelectedTile({
                            query: {
                              ...selectedTile.query,
                              filters:
                                event.target.value === "none"
                                  ? []
                                  : [{ field: event.target.value as FilterFieldId, values: ["all"] }]
                            }
                          })
                        }
                      >
                        <option value="none">No filter</option>
                        {filterDimensions.map((item) => (
                          <option value={item.id} key={item.id}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {selectedTileFilterDimension && (
                    <label>
                      Filter value
                      <select
                        value={selectedTile.query.filters[0]?.values[0] ?? "all"}
                        onChange={(event) =>
                          updateSelectedTile({
                            query: {
                              ...selectedTile.query,
                              filters: [{ field: selectedTileFilterDimension.id, values: [event.target.value] }]
                            }
                          })
                        }
                      >
                        <option value="all">All {selectedTileFilterDimension.label.toLowerCase()}s</option>
                        {selectedTileFilterDimension.values.map((item) => (
                          <option value={item.id} key={item.id}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      rerunTileAnalysis(selectedTile, {
                        ...selectedTile.query,
                        breakBy: (selectedTile.query.comparisonMode ?? "none") === "wave" ? "SUMMARY" : selectedTile.query.breakBy,
                        chartType: selectedTile.visualization,
                        filters:
                          selectedTile.query.filters[0]?.field && selectedTile.query.filters[0]?.values[0] !== "all"
                            ? selectedTile.query.filters
                            : []
                      })
                    }
                    disabled={isLoading}
                  >
                    {isLoading ? "Refreshing..." : "Refresh analysis"}
                  </button>
                  <div className="analysis-library-actions">
                    <button type="button" className="secondary" onClick={saveSelectedTileVariableSet}>Save set</button>
                    <button type="button" className="secondary" onClick={saveSelectedTileBanner}>Save banner</button>
                    <button type="button" className="secondary" onClick={saveSelectedTileFilter}>Save filter</button>
                    <button type="button" className="secondary" onClick={saveSelectedTileWeight}>Save weight</button>
                  </div>
                </div>
              )}
              <label>
                Visualization
                <select
                  value={selectedTile.visualization}
                  onChange={(event) => {
                    const nextVisualization = event.target.value as ChartType;
                    updateSelectedTile(tileWithVisualization(selectedTile, nextVisualization));
                  }}
                >
                  {getCompatibleChartTypes(selectedTile.result).map((item) => (
                    <option value={item} key={item}>
                      {getChartTypeLabel(item)}
                    </option>
                  ))}
                </select>
              </label>
              {selectedTile.visualization === "table" && (
                <div className="table-convert-card">
                  <div className="explorer-section-header">
                    <strong>Convert table to chart</strong>
                    <small>Pick a view for this same query</small>
                  </div>
                  <div className="explorer-chip-row">
                    {getCompatibleChartTypes(selectedTile.result)
                      .filter((item) => item !== "table")
                      .map((item) => (
                        <button
                          type="button"
                          key={item}
                          className="explorer-chip-button"
                          onClick={() => updateSelectedTile(tileWithVisualization(selectedTile, item))}
                        >
                          {getChartTypeLabel(item)}
                        </button>
                      ))}
                  </div>
                  <div className="explorer-section-header table-convert-subhead">
                    <strong>Keep table and create chart</strong>
                    <small>Useful when the page needs both views</small>
                  </div>
                  <div className="explorer-chip-row">
                    {getCompatibleChartTypes(selectedTile.result)
                      .filter((item) => item !== "table")
                      .map((item) => (
                        <button
                          type="button"
                          key={`duplicate-${item}`}
                          className="explorer-chip-button secondary-chip"
                          onClick={() => duplicateTileAsVisualization(selectedTile, item)}
                        >
                          New {getChartTypeLabel(item)}
                        </button>
                      ))}
                  </div>
                </div>
              )}
              <div className="panel-title subtle">
                <h2>Display</h2>
              </div>
              <div className="toggle-list">
                <label><input type="checkbox" checked={selectedTile.appearance.showGrid} onChange={(event) => updateSelectedAppearance({ showGrid: event.target.checked })} /> {selectedTile.visualization === "table" ? "Table guides" : "Chart grid"}</label>
                <label><input type="checkbox" checked={selectedTile.appearance.showValueLabels} onChange={(event) => updateSelectedAppearance({ showValueLabels: event.target.checked })} /> {selectedTile.visualization === "table" ? "Cell values" : "Value labels"}</label>
                <label><input type="checkbox" checked={selectedTile.appearance.showAnnotations} onChange={(event) => updateSelectedAppearance({ showAnnotations: event.target.checked })} /> {selectedTile.visualization === "table" ? "Highlights" : "Arrows"}</label>
                <label><input type="checkbox" checked={selectedTile.appearance.showNotes} onChange={(event) => updateSelectedAppearance({ showNotes: event.target.checked })} /> Notes</label>
              </div>
              <div className="panel-title subtle">
                <h2>Design</h2>
              </div>
              <div className="settings-menu">
                <button type="button" className="menu-card" onClick={() => setDesignModal("chartColors")}>
                  <strong>Colors</strong>
                  <span>Bars, labels, axes, grid, and chart surface.</span>
                </button>
                <button type="button" className="menu-card" onClick={() => setDesignModal("labelSettings")}>
                  <strong>Labels</strong>
                  <span>Value label position, size, and spacing.</span>
                </button>
                <button type="button" className="menu-card" onClick={() => setDesignModal("barLayout")}>
                  <strong>Bars</strong>
                  <span>Roundness, width, and spacing.</span>
                </button>
                <button type="button" className="menu-card" onClick={() => setDesignModal("axisSettings")}>
                  <strong>Axis</strong>
                  <span>Text, alignment, wrapping, and offsets.</span>
                </button>
                <button type="button" className="menu-card" onClick={() => setSettingsView("container")}>
                  <strong>Container</strong>
                  <span>Tile background, border, and transparency.</span>
                </button>
                <button type="button" className="menu-card" onClick={() => setDesignModal("tileEffects")}>
                  <strong>Effects</strong>
                  <span>{selectedTile.appearance.shadow || selectedTile.appearance.glow ? "Shadow or glow active." : "Shadow and glow controls."}</span>
                </button>
              </div>
            </>
          )}
            </>
          )}
            </>
          )}
        </BuilderPanel>
      </section>
      {designModal && (
        <div className="design-modal-backdrop" role="presentation" onMouseDown={() => setDesignModal(null)}>
          <div ref={designModalRef} className="design-modal" role="dialog" aria-modal="true" aria-label="Design settings" onMouseDown={(event) => event.stopPropagation()}>
            <div className="design-modal-header">
              <div>
                <span>Design</span>
                <h2>
                  {designModal === "pageBackground"
                    ? "Page background"
                    : designModal === "chartColors"
                    ? "Chart colors"
                    : designModal === "labelSettings"
                      ? "Label settings"
                      : designModal === "barLayout"
                        ? "Bar settings"
                    : designModal === "axisSettings"
                      ? "Axis settings"
                      : designModal.includes("Gradient")
                        ? "Gradient settings"
                        : "Effects"}
                </h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setDesignModal(null)} aria-label="Close design settings">
                x
              </button>
            </div>

            {designModal === "chartColors" && selectedTile && (
              <div className="modal-control-stack">
                <div className="color-summary-card">
                  <div>
                    <span>Style target</span>
                    <strong title={selectedChartPart ? selectedChartPart.label : "All bars"}>
                      {selectedChartPart ? selectedChartPart.label : "All bars"}
                    </strong>
                  </div>
                  <div className="style-target-chips">
                    <button
                      type="button"
                      className={selectedChartPart ? "style-target-chip all" : "style-target-chip all active"}
                      onClick={() => setSelectedChartPartId("all")}
                      aria-label="Select all bars"
                    >
                      <span>All</span>
                    </button>
                    {selectedTile.result.table.slice(0, 5).map((row, index) => {
                      const id = row.optionId;
                      const fallback = selectedTile.appearance.palette[index % selectedTile.appearance.palette.length] ?? selectedTile.appearance.primaryColor;
                      const style = getBarStyle(selectedTile.appearance, id, fallback);
                      return (
                        <button
                          type="button"
                          key={id}
                          className={selectedChartPartId === id ? "style-target-chip active" : "style-target-chip"}
                          onClick={() => setSelectedChartPartId(id)}
                          aria-label={`Select ${row.label}`}
                        >
                          <span style={{ background: style.fillMode === "gradient" ? gradientCss(style.color, style.gradientTo, style.gradientStops, style.gradientType, `${style.gradientAngle}deg`) : style.color }} />
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="palette-chip-groups">
                  <span>Bar palette presets</span>
                  <div className="palette-chip-group-list">
                    {palettes.map((palette) => {
                      const isActive = !selectedChartPart && getPaletteId(selectedTile.appearance.palette) === palette.id;
                      return (
                        <button
                          type="button"
                          key={palette.id}
                          className={isActive ? "palette-chip-group active" : "palette-chip-group"}
                          onClick={() => applyPalettePresetToBars(palette.colors)}
                        >
                          <div className="palette-chip-group-header">
                            <strong>{palette.label}</strong>
                            <small>Use set</small>
                          </div>
                          <div className="palette-chip-row">
                            {palette.colors.map((color, index) => (
                              <span
                                key={`${palette.id}-${color}-${index}`}
                                className="palette-chip"
                                style={{ background: color }}
                                role="button"
                                tabIndex={0}
                                aria-label={`Use ${color} from ${palette.label}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  selectedChartPart
                                    ? applyPaletteColorToSelectedBar(color)
                                    : applyPalettePresetToBars([color, ...palette.colors.filter((entry) => entry !== color)]);
                                }}
                                onKeyDown={(event) => {
                                  if (event.key !== "Enter" && event.key !== " ") return;
                                  event.preventDefault();
                                  event.stopPropagation();
                                  selectedChartPart
                                    ? applyPaletteColorToSelectedBar(color)
                                    : applyPalettePresetToBars([color, ...palette.colors.filter((entry) => entry !== color)]);
                                }}
                              />
                            ))}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <BarColorField
                  style={selectedChartPart ? getBarStyle(selectedTile.appearance, selectedChartPart.id, selectedTile.appearance.primaryColor) : getBarStyle(selectedTile.appearance, "__default__", selectedTile.appearance.primaryColor)}
                  onColorChange={(value) =>
                    selectedChartPart
                      ? updateSelectedBarStyle({ color: value })
                      : applySolidColorToBars(value)
                  }
                  onFillModeChange={(mode) =>
                    selectedChartPart
                      ? updateSelectedBarStyle({ fillMode: mode })
                      : clearBarColorOverrides({ barFillMode: mode })
                  }
                  onPresetApply={(preset) =>
                    selectedChartPart
                      ? updateSelectedBarStyle({
                          gradientType: preset.type,
                          gradientAngle: preset.angle,
                          gradientStops: applyGradientStylePreset(
                            getBarStyle(selectedTile.appearance, selectedChartPart.id, selectedTile.appearance.primaryColor).color,
                            getBarStyle(selectedTile.appearance, selectedChartPart.id, selectedTile.appearance.primaryColor).gradientTo,
                            getBarStyle(selectedTile.appearance, selectedChartPart.id, selectedTile.appearance.primaryColor).gradientStops,
                            preset.positions
                          )
                        })
                      : clearBarColorOverrides({
                          barGradientType: preset.type,
                          barGradientAngle: preset.angle,
                          barGradientStops: applyGradientStylePreset(
                            selectedTile.appearance.primaryColor,
                            selectedTile.appearance.barGradientTo,
                            selectedTile.appearance.barGradientStops,
                            preset.positions
                          )
                        })
                  }
                  onGradientChange={(updates) =>
                    selectedChartPart
                      ? updateSelectedBarStyle({ color: updates.color, gradientTo: updates.gradientTo, gradientStops: updates.gradientStops })
                      : clearBarColorOverrides({
                          primaryColor: updates.color,
                          palette: [updates.color, ...selectedTile.appearance.palette.slice(1)],
                          barGradientTo: updates.gradientTo,
                          barGradientStops: updates.gradientStops
                        })
                  }
                />
                <ColorField label="Value label color" value={selectedTile.appearance.labelColor} onChange={(value) => updateSelectedAppearance({ labelColor: value })} />
                <ColorField label="X axis text color" value={selectedTile.appearance.xAxisTextColor} onChange={(value) => updateSelectedAppearance({ xAxisTextColor: value })} />
                <ColorField label="Y axis text color" value={selectedTile.appearance.yAxisTextColor} onChange={(value) => updateSelectedAppearance({ yAxisTextColor: value })} />
                <ColorField label="Chart background" value={selectedTile.appearance.chartBackground} onChange={(value) => updateSelectedAppearance({ chartBackground: value })} />
                <ColorField label="Grid color" value={selectedTile.appearance.gridColor} onChange={(value) => updateSelectedAppearance({ gridColor: value })} />
              </div>
            )}

            {designModal === "pageBackground" && (
              <div className="modal-control-stack">
                <div className="color-summary-card">
                  <div>
                    <span>Page surface</span>
                    <strong>
                      {activePage.backgroundMode === "image"
                        ? "Image"
                        : activePage.backgroundMode[0].toUpperCase() + activePage.backgroundMode.slice(1)}
                    </strong>
                  </div>
                  <div
                    className="page-background-preview"
                    style={{
                      background:
                        activePage.backgroundMode === "image" && activePage.backgroundImage
                          ? undefined
                          : activePage.backgroundMode === "gradient"
                            ? gradientCss(activePage.gradientFrom, activePage.gradientTo, activePage.gradientStops, activePage.gradientType, `${activePage.gradientAngle}deg`)
                            : activePage.background,
                      backgroundImage:
                        activePage.backgroundMode === "image" && activePage.backgroundImage
                          ? `url("${activePage.backgroundImage.replace(/"/g, '\\"')}")`
                          : undefined,
                      backgroundSize:
                        activePage.backgroundMode === "image"
                          ? activePage.backgroundImageFit === "fill"
                            ? "100% 100%"
                            : activePage.backgroundImageFit
                          : undefined
                    }}
                  />
                </div>
                <div className="color-summary-card">
                  <div>
                    <span>Background</span>
                    <strong>Edit page surface</strong>
                  </div>
                  <PageBackgroundField
                    page={activePage}
                    onModeChange={(mode) => updateActivePage({ backgroundMode: mode })}
                    onSolidChange={(value) => updateActivePage({ background: value })}
                    onGradientChange={(updates) =>
                      updateActivePage({
                        gradientFrom: updates.from,
                        gradientTo: updates.to,
                        gradientType: updates.type,
                        gradientAngle: updates.angle,
                        gradientStops: updates.stops
                      })
                    }
                    onImageChange={(updates) => updateActivePage(updates)}
                  />
                </div>
              </div>
            )}

            {designModal === "pageGradient" && (
              <GradientEditor
                label="Page gradient"
                from={activePage.gradientFrom}
                to={activePage.gradientTo}
                type={activePage.gradientType}
                stops={activePage.gradientStops}
                onChange={(updates) => updateActivePage({ gradientFrom: updates.from, gradientTo: updates.to, gradientType: updates.type, gradientAngle: 135, gradientStops: updates.stops })}
              />
            )}

            {designModal === "elementGradient" && selectedElement && (
              <GradientEditor
                label="Fill gradient"
                from={selectedElement.style.gradientFrom}
                to={selectedElement.style.gradientTo}
                type={selectedElement.style.gradientType}
                stops={selectedElement.style.gradientStops}
                onChange={(updates) => updateSelectedElement({ style: { ...selectedElement.style, gradientFrom: updates.from, gradientTo: updates.to, gradientType: updates.type, gradientStops: updates.stops } })}
              />
            )}

            {designModal === "tileGradient" && selectedTile && (
              <GradientEditor
                label="Tile gradient"
                from={selectedTile.appearance.gradientFrom}
                to={selectedTile.appearance.gradientTo}
                type={selectedTile.appearance.gradientType}
                stops={selectedTile.appearance.gradientStops}
                onChange={(updates) => updateSelectedAppearance({ gradientFrom: updates.from, gradientTo: updates.to, gradientType: updates.type, gradientStops: updates.stops })}
              />
            )}

            {designModal === "barGradient" && selectedTile && (
              <GradientEditor
                label={selectedChartPart ? "Selected bar gradient" : "Bar gradient"}
                from={selectedChartPart ? getBarStyle(selectedTile.appearance, selectedChartPart.id, selectedTile.appearance.primaryColor).color : selectedTile.appearance.primaryColor}
                to={selectedChartPart ? getBarStyle(selectedTile.appearance, selectedChartPart.id, selectedTile.appearance.primaryColor).gradientTo : selectedTile.appearance.barGradientTo}
                type={(selectedChartPart ? getBarStyle(selectedTile.appearance, selectedChartPart.id, selectedTile.appearance.primaryColor).gradientType : selectedTile.appearance.barGradientType) === "conic" ? "linear" : selectedChartPart ? getBarStyle(selectedTile.appearance, selectedChartPart.id, selectedTile.appearance.primaryColor).gradientType : selectedTile.appearance.barGradientType}
                stops={selectedChartPart ? getBarStyle(selectedTile.appearance, selectedChartPart.id, selectedTile.appearance.primaryColor).gradientStops : selectedTile.appearance.barGradientStops}
                allowedTypes={["linear", "radial"]}
                onChange={(updates) =>
                  selectedChartPart
                    ? updateSelectedBarStyle({ color: updates.from, gradientTo: updates.to, gradientType: updates.type, gradientStops: updates.stops })
                    : updateSelectedAppearance({ primaryColor: updates.from, palette: [updates.from, ...selectedTile.appearance.palette.slice(1)], barGradientTo: updates.to, barGradientType: updates.type, barGradientStops: updates.stops })
                }
              />
            )}

            {designModal === "axisSettings" && selectedTile && (
              <div className="modal-control-stack">
                <ColorField label="X axis text color" value={selectedTile.appearance.xAxisTextColor} onChange={(value) => updateSelectedAppearance({ xAxisTextColor: value })} />
                <ColorField label="Y axis text color" value={selectedTile.appearance.yAxisTextColor} onChange={(value) => updateSelectedAppearance({ yAxisTextColor: value })} />
                <label>
                  Axis text size
                  <input
                    type="number"
                    inputMode="numeric"
                    step="1"
                    min="6"
                    max="72"
                    value={selectedTile.appearance.axisFontSize}
                    onChange={(event) => updateSelectedAppearance({ axisFontSize: Math.min(72, Math.max(6, Number(event.target.value) || 12)) })}
                  />
                </label>
                {selectedChartPart && (
                  <label>
                    Axis label text
                    <textarea
                      value={getAxisLabel(selectedTile.appearance, selectedChartPart.id, selectedChartPart.label)}
                      onChange={(event) => updateSelectedAxisLabel(event.target.value)}
                    />
                    <span>Use line breaks here to force label wrapping for the selected bar.</span>
                  </label>
                )}
                <label>
                  Axis label position
                  <select value={selectedTile.appearance.axisLabelPlacement} onChange={(event) => updateSelectedAppearance({ axisLabelPlacement: event.target.value as TileAppearance["axisLabelPlacement"] })}>
                    <option value="outside">Outside</option>
                    <option value="insideStart">Inside start</option>
                    <option value="insideCenter">Inside center</option>
                  </select>
                </label>
                <label>
                  Axis label width
                  <input type="number" min="8" max="72" value={selectedTile.appearance.axisLabelWidth} onChange={(event) => updateSelectedAppearance({ axisLabelWidth: Math.min(72, Math.max(8, Number(event.target.value) || 16)) })} />
                </label>
                <label>
                  Axis max lines
                  <input type="number" min="1" max="12" value={selectedTile.appearance.axisLabelMaxLines} onChange={(event) => updateSelectedAppearance({ axisLabelMaxLines: Math.min(12, Math.max(1, Number(event.target.value) || 3)) })} />
                </label>
                <label>
                  Axis label height
                  <input type="number" min="24" max="320" value={selectedTile.appearance.axisHeight} onChange={(event) => updateSelectedAppearance({ axisHeight: Math.min(320, Math.max(24, Number(event.target.value) || 112)) })} />
                </label>
                <label>
                  Axis label X
                  <input type="number" min="-240" max="240" value={selectedTile.appearance.axisLabelDx} onChange={(event) => updateSelectedAppearance({ axisLabelDx: Math.min(240, Math.max(-240, Number(event.target.value) || 0)) })} />
                </label>
                <label>
                  Axis label Y
                  <input type="number" min="-240" max="240" value={selectedTile.appearance.axisLabelDy} onChange={(event) => updateSelectedAppearance({ axisLabelDy: Math.min(240, Math.max(-240, Number(event.target.value) || 0)) })} />
                </label>
                <label>
                  Axis rotation
                  <input
                    type="number"
                    list="axis-rotation-presets"
                    min="-180"
                    max="180"
                    value={selectedTile.appearance.axisLabelRotation}
                    onChange={(event) => updateSelectedAppearance({ axisLabelRotation: Math.min(180, Math.max(-180, Number(event.target.value) || 0)) })}
                  />
                  <datalist id="axis-rotation-presets">
                    {axisRotationPresets.map((rotation) => (
                      <option value={rotation} key={rotation} />
                    ))}
                  </datalist>
                </label>
                <label>
                  Axis alignment
                  <select value={selectedTile.appearance.axisLabelAlign} onChange={(event) => updateSelectedAppearance({ axisLabelAlign: event.target.value as TileAppearance["axisLabelAlign"] })}>
                    <option value="start">Left</option>
                    <option value="middle">Center</option>
                    <option value="end">Right</option>
                  </select>
                </label>
                <div className="toggle-list">
                  <label><input type="checkbox" checked={selectedTile.appearance.axisLabelWrap} onChange={(event) => updateSelectedAppearance({ axisLabelWrap: event.target.checked })} /> Wrap axis labels</label>
                </div>
                <ColorField label="Grid color" value={selectedTile.appearance.gridColor} onChange={(value) => updateSelectedAppearance({ gridColor: value })} />
              </div>
            )}

            {designModal === "labelSettings" && selectedTile && (
              <div className="modal-control-stack">
                <label>
                  Label position
                  <select value={selectedTile.appearance.labelPosition} onChange={(event) => updateSelectedAppearance({ labelPosition: event.target.value as TileAppearance["labelPosition"] })}>
                    <option value="top">Top</option>
                    <option value="insideTop">Inside top</option>
                    <option value="insideBottom">Inside bottom</option>
                    <option value="center">Center</option>
                  </select>
                </label>
                <label>
                  Label size
                  <input type="range" min="9" max="28" value={selectedTile.appearance.labelFontSize} style={{ "--range-fill": rangeFill(selectedTile.appearance.labelFontSize, 9, 28) } as React.CSSProperties} onChange={(event) => updateSelectedAppearance({ labelFontSize: Number(event.target.value) })} />
                </label>
                <label>
                  Label offset
                  <input type="range" min="0" max="32" value={selectedTile.appearance.labelOffset} style={{ "--range-fill": rangeFill(selectedTile.appearance.labelOffset, 0, 32) } as React.CSSProperties} onChange={(event) => updateSelectedAppearance({ labelOffset: Number(event.target.value) })} />
                </label>
              </div>
            )}

            {designModal === "barLayout" && selectedTile && (
              <div className="modal-control-stack">
                <div className="color-summary-card">
                  <div>
                    <span>Style target</span>
                    <strong title={selectedChartPart ? selectedChartPart.label : "All bars"}>
                      {selectedChartPart ? selectedChartPart.label : "All bars"}
                    </strong>
                  </div>
                  <div className="style-target-chips">
                    <button
                      type="button"
                      className={selectedChartPart ? "style-target-chip all" : "style-target-chip all active"}
                      onClick={() => setSelectedChartPartId("all")}
                      aria-label="Select all bars"
                    >
                      <span>All</span>
                    </button>
                    {selectedTile.result.table.slice(0, 5).map((row, index) => {
                      const id = row.optionId;
                      const fallback = selectedTile.appearance.palette[index % selectedTile.appearance.palette.length] ?? selectedTile.appearance.primaryColor;
                      const style = getBarStyle(selectedTile.appearance, id, fallback);
                      return (
                        <button
                          type="button"
                          key={id}
                          className={selectedChartPartId === id ? "style-target-chip active" : "style-target-chip"}
                          onClick={() => setSelectedChartPartId(id)}
                          aria-label={`Select ${row.label}`}
                        >
                          <span style={{ background: style.fillMode === "gradient" ? gradientCss(style.color, style.gradientTo, style.gradientStops, style.gradientType, `${style.gradientAngle}deg`) : style.color }} />
                        </button>
                      );
                    })}
                  </div>
                </div>
                <label>
                  Bar roundness
                  <input
                    type="range"
                    min="0"
                    max="36"
                    value={selectedChartPart ? getBarStyle(selectedTile.appearance, selectedChartPart.id, selectedTile.appearance.primaryColor).radius : selectedTile.appearance.barRadius}
                    style={{ "--range-fill": rangeFill(selectedChartPart ? getBarStyle(selectedTile.appearance, selectedChartPart.id, selectedTile.appearance.primaryColor).radius : selectedTile.appearance.barRadius, 0, 36) } as React.CSSProperties}
                    onChange={(event) =>
                      selectedChartPart ? updateSelectedBarStyle({ radius: Number(event.target.value) }) : updateSelectedAppearance({ barRadius: Number(event.target.value) })
                    }
                  />
                </label>
                <label>
                  Bar width
                  <input type="range" min="16" max="140" value={selectedTile.appearance.barSize} style={{ "--range-fill": rangeFill(selectedTile.appearance.barSize, 16, 140) } as React.CSSProperties} onChange={(event) => updateSelectedAppearance({ barSize: Number(event.target.value) })} />
                </label>
                <label>
                  Bar spacing
                  <input type="range" min="0" max="48" value={selectedTile.appearance.barGap} style={{ "--range-fill": rangeFill(selectedTile.appearance.barGap, 0, 48) } as React.CSSProperties} onChange={(event) => updateSelectedAppearance({ barGap: Number(event.target.value) })} />
                </label>
                <label>
                  Group spacing
                  <input type="range" min="0" max="64" value={selectedTile.appearance.barCategoryGap} style={{ "--range-fill": rangeFill(selectedTile.appearance.barCategoryGap, 0, 64) } as React.CSSProperties} onChange={(event) => updateSelectedAppearance({ barCategoryGap: Number(event.target.value) })} />
                </label>
              </div>
            )}

            {designModal === "elementEffects" && selectedElement && (
              <div className="modal-control-stack">
                <div className="effect-preview-card" style={{ boxShadow: effectShadow({ ...selectedElement.style, shadow: selectedElement.style.shadow || selectedElement.style.glow }) }}>
                  {selectedElement.name}
                </div>
                <div className="preset-grid">
                  {(Object.keys(effectPresets) as EffectPreset[]).map((preset) => (
                    <button
                      type="button"
                      key={preset}
                      className={selectedElement.style.shadowPreset === preset ? "active" : ""}
                      onClick={() => applySelectedElementEffectPreset(preset)}
                    >
                      {effectPresets[preset].label}
                    </button>
                  ))}
                </div>
                <div className="toggle-list">
                  <label><input type="checkbox" checked={selectedElement.style.shadow} onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, shadow: event.target.checked } })} /> Drop shadow</label>
                  <label><input type="checkbox" checked={selectedElement.style.glow} onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, glow: event.target.checked } })} /> Glow</label>
                </div>
                <label>Shadow color<input type="color" value={selectedElement.style.shadowColor} onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, shadowColor: event.target.value } })} /></label>
                <label>Shadow opacity<input type="range" min="0" max="70" value={selectedElement.style.shadowOpacity} style={{ "--range-fill": rangeFill(selectedElement.style.shadowOpacity, 0, 70) } as React.CSSProperties} onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, shadowOpacity: Number(event.target.value) } })} /></label>
                <label>Blur<input type="range" min="0" max="80" value={selectedElement.style.shadowBlur} style={{ "--range-fill": rangeFill(selectedElement.style.shadowBlur, 0, 80) } as React.CSSProperties} onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, shadowBlur: Number(event.target.value) } })} /></label>
                <label>Offset X<input type="range" min="-40" max="40" value={selectedElement.style.shadowOffsetX} style={{ "--range-fill": rangeFill(selectedElement.style.shadowOffsetX, -40, 40) } as React.CSSProperties} onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, shadowOffsetX: Number(event.target.value) } })} /></label>
                <label>Offset Y<input type="range" min="-40" max="60" value={selectedElement.style.shadowOffsetY} style={{ "--range-fill": rangeFill(selectedElement.style.shadowOffsetY, -40, 60) } as React.CSSProperties} onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, shadowOffsetY: Number(event.target.value) } })} /></label>
                <label>Glow color<input type="color" value={selectedElement.style.glowColor} onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, glowColor: event.target.value } })} /></label>
                <label>Glow size<input type="range" min="0" max="90" value={selectedElement.style.glowSize} style={{ "--range-fill": rangeFill(selectedElement.style.glowSize, 0, 90) } as React.CSSProperties} onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, glowSize: Number(event.target.value) } })} /></label>
              </div>
            )}

            {designModal === "tileEffects" && selectedTile && (
              <div className="modal-control-stack">
                <div className="effect-preview-card" style={{ boxShadow: effectShadow({ ...selectedTile.appearance, shadow: selectedTile.appearance.shadow || selectedTile.appearance.glow }) }}>
                  {selectedTile.name}
                </div>
                <div className="preset-grid">
                  {(Object.keys(effectPresets) as EffectPreset[]).map((preset) => (
                    <button
                      type="button"
                      key={preset}
                      className={selectedTile.appearance.shadowPreset === preset ? "active" : ""}
                      onClick={() => applySelectedTileEffectPreset(preset)}
                    >
                      {effectPresets[preset].label}
                    </button>
                  ))}
                </div>
                <div className="toggle-list">
                  <label><input type="checkbox" checked={selectedTile.appearance.shadow} onChange={(event) => updateSelectedAppearance({ shadow: event.target.checked })} /> Drop shadow</label>
                  <label><input type="checkbox" checked={selectedTile.appearance.glow} onChange={(event) => updateSelectedAppearance({ glow: event.target.checked })} /> Glow</label>
                </div>
                <label>Shadow color<input type="color" value={selectedTile.appearance.shadowColor} onChange={(event) => updateSelectedAppearance({ shadowColor: event.target.value })} /></label>
                <label>Shadow opacity<input type="range" min="0" max="70" value={selectedTile.appearance.shadowOpacity} style={{ "--range-fill": rangeFill(selectedTile.appearance.shadowOpacity, 0, 70) } as React.CSSProperties} onChange={(event) => updateSelectedAppearance({ shadowOpacity: Number(event.target.value) })} /></label>
                <label>Blur<input type="range" min="0" max="80" value={selectedTile.appearance.shadowBlur} style={{ "--range-fill": rangeFill(selectedTile.appearance.shadowBlur, 0, 80) } as React.CSSProperties} onChange={(event) => updateSelectedAppearance({ shadowBlur: Number(event.target.value) })} /></label>
                <label>Offset X<input type="range" min="-40" max="40" value={selectedTile.appearance.shadowOffsetX} style={{ "--range-fill": rangeFill(selectedTile.appearance.shadowOffsetX, -40, 40) } as React.CSSProperties} onChange={(event) => updateSelectedAppearance({ shadowOffsetX: Number(event.target.value) })} /></label>
                <label>Offset Y<input type="range" min="-40" max="60" value={selectedTile.appearance.shadowOffsetY} style={{ "--range-fill": rangeFill(selectedTile.appearance.shadowOffsetY, -40, 60) } as React.CSSProperties} onChange={(event) => updateSelectedAppearance({ shadowOffsetY: Number(event.target.value) })} /></label>
                <label>Glow color<input type="color" value={selectedTile.appearance.glowColor} onChange={(event) => updateSelectedAppearance({ glowColor: event.target.value })} /></label>
                <label>Glow size<input type="range" min="0" max="90" value={selectedTile.appearance.glowSize} style={{ "--range-fill": rangeFill(selectedTile.appearance.glowSize, 0, 90) } as React.CSSProperties} onChange={(event) => updateSelectedAppearance({ glowSize: Number(event.target.value) })} /></label>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
