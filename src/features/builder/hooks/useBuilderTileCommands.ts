import type React from "react";
import { runAnalyticsQuery } from "../../../lib/api";
import { applyVariableSetRows } from "../../../../shared/analytics/variableSets";
import { canvasHeight, canvasWidth, defaultAppearance, defaultDataset } from "../builderConstants";
import { defaultVariableSetRows } from "../../document/documentSeeds";
import { makeTileId, nextZIndex } from "../../document/documentModel";
import { getCompatibleChartTypes } from "../../analytics/analyticsDisplay";
import { queryForQuestion, queryForVariableSet } from "../../analytics/useAnalysisAuthoring";
import { getChartTypeLabel } from "../../analytics/analyticsDisplay";
import type { AnalyticsQueryRequest, ChartType, FilterFieldId } from "../../../../shared/types/analytics";
import type { DashboardDraft, DashboardPage, DashboardTile, SavedVariableSet } from "../../../../shared/types/dashboard";

type SetDashboard = (updater: DashboardDraft | ((current: DashboardDraft) => DashboardDraft), trackHistory?: boolean) => void;

type UseBuilderTileCommandsArgs = {
  activePage: DashboardPage;
  canvasScale: number;
  query: AnalyticsQueryRequest;
  selectedQuestion: typeof defaultDataset.questions[number];
  selectedVariableSet: SavedVariableSet | null;
  savedVariableSets: SavedVariableSet[];
  setDashboard: SetDashboard;
  selectTile: (tileId: string) => void;
  updateTile: (tileId: string, updates: Partial<DashboardTile>) => void;
  applyQuestionSelection: (question: typeof defaultDataset.questions[number]) => void;
  applyVariableSetSelection: (variableSet: SavedVariableSet) => void;
  setIsLoading: (value: boolean) => void;
  setError: (value: string | null) => void;
};

function fallbackVariableSet(source: NonNullable<DashboardTile["source"]>, query: AnalyticsQueryRequest): SavedVariableSet {
  return {
    id: source.id,
    datasetId: defaultDataset.id,
    label: source.label,
    description: "",
    topic: source.label,
    questionIds: [query.question],
    primaryQuestionId: query.question,
    rowMode: "authored",
    rows: defaultVariableSetRows(query.question),
    breakBy: query.breakBy,
    metric: query.metric,
    chartType: query.chartType,
    weight: query.weight,
    filterField: (query.filters[0]?.field as FilterFieldId | undefined) ?? null,
    filterValue: query.filters[0]?.values[0] ?? "all"
  };
}

function resolveVariableSetResult(
  response: Awaited<ReturnType<typeof runAnalyticsQuery>>,
  query: AnalyticsQueryRequest,
  source: DashboardTile["source"] | undefined,
  savedVariableSets: SavedVariableSet[]
) {
  return source?.kind === "variableSet"
    ? applyVariableSetRows(response, savedVariableSets.find((item) => item.id === source.id) ?? fallbackVariableSet(source, query))
    : response;
}

export function tileWithVisualization(tile: DashboardTile, nextVisualization: ChartType): Partial<DashboardTile> {
  return {
    visualization: nextVisualization,
    query: { ...tile.query, chartType: nextVisualization },
    result: { ...tile.result, query: { ...tile.result.query, chartType: nextVisualization } }
  };
}

export function useBuilderTileCommands({
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
}: UseBuilderTileCommandsArgs) {
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
      const resolvedResponse = resolveVariableSetResult(response, tileQuery, source, savedVariableSets);
      const tileId = makeTileId();
      const tile: DashboardTile = {
        id: tileId,
        name: sourceLabel,
        title: sourceLabel,
        source,
        analysisLifecycle: {
          role: "canonical",
          canonicalTileId: tileId,
          canonicalLabel: sourceLabel
        },
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
      return tile.id;
    } catch (queryError) {
      setError(queryError instanceof Error ? queryError.message : "Something went wrong.");
      return null;
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

  async function addTileFromQuery() {
    return createTileFromSource(
      query,
      selectedVariableSet?.label ?? selectedQuestion.shortLabel,
      undefined,
      selectedVariableSet
        ? { kind: "variableSet", id: selectedVariableSet.id, label: selectedVariableSet.label }
        : { kind: "question", id: selectedQuestion.id, label: selectedQuestion.shortLabel }
    );
  }

  async function addTileFromSourceWithVisualization(nextVisualization: ChartType) {
    return createTileFromSource(
      { ...query, chartType: nextVisualization },
      selectedVariableSet?.label ?? selectedQuestion.shortLabel,
      undefined,
      selectedVariableSet
        ? { kind: "variableSet", id: selectedVariableSet.id, label: selectedVariableSet.label }
        : { kind: "question", id: selectedQuestion.id, label: selectedQuestion.shortLabel }
    );
  }

  async function addTileFromVariableSet(variableSet: SavedVariableSet, nextVisualization: ChartType) {
    const variableSetQuery = queryForVariableSet(variableSet);
    return createTileFromSource(
      { ...variableSetQuery, chartType: nextVisualization },
      variableSet.label,
      undefined,
      { kind: "variableSet", id: variableSet.id, label: variableSet.label }
    );
  }

  async function rerunTileAnalysis(tile: DashboardTile, nextQuery: AnalyticsQueryRequest) {
    setIsLoading(true);
    setError(null);

    try {
      const response = await runAnalyticsQuery(nextQuery);
      const resolvedResponse = resolveVariableSetResult(response, nextQuery, tile.source, savedVariableSets);
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
      return true;
    } catch (queryError) {
      setError(queryError instanceof Error ? queryError.message : "Something went wrong refreshing this analysis.");
      return false;
    } finally {
      setIsLoading(false);
    }
  }

  function duplicateTileAsVisualization(tile: DashboardTile, nextVisualization: ChartType) {
    const duplicateId = makeTileId();
    const duplicate: DashboardTile = {
      ...tile,
      ...tileWithVisualization(tile, nextVisualization),
      id: duplicateId,
      name: `${tile.name} ${getChartTypeLabel(nextVisualization).toLowerCase()}`,
      title: tile.title,
      analysisLifecycle: {
        role: "derived",
        canonicalTileId: tile.analysisLifecycle?.canonicalTileId ?? tile.id,
        canonicalLabel: tile.analysisLifecycle?.canonicalLabel ?? tile.title,
        derivedFrom: {
          tileId: tile.id,
          title: tile.title,
          visualization: tile.visualization
        }
      },
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

  return {
    createTileFromSource,
    startDataSourceDrag,
    handleCanvasDrop,
    addTileFromQuery,
    addTileFromSourceWithVisualization,
    addTileFromVariableSet,
    rerunTileAnalysis,
    tileWithVisualization,
    duplicateTileAsVisualization
  };
}
