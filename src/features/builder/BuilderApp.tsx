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
import { AnalysisAuthoringPanel } from "./components/AnalysisAuthoringPanel";
import { BuilderInspector } from "./components/BuilderInspector";
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
