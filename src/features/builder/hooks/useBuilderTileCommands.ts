import type React from "react";
import { runAnalyticsQuery } from "../../../lib/api";
import { applyVariableSetRows } from "../../../../shared/analytics/variableSets";
import { canvasHeight, canvasWidth, defaultAppearance, defaultDataset } from "../builderConstants";
import { defaultVariableSetRows } from "../../document/documentSeeds";
import { makeTileId, nextZIndex } from "../../document/documentModel";
import { getCompatibleChartTypes } from "../../analytics/analyticsDisplay";
import { queryForAnalyticalTemplate, queryForQuestion, queryForVariableSet } from "../../analytics/useAnalysisAuthoring";
import { getChartTypeLabel } from "../../analytics/analyticsDisplay";
import { buildDerivedOutputMetadata, buildDerivedOutputResponse, buildDerivedOutputTitle, type DerivedOutputKind } from "../components/derivedOutputModel";
import { buildTileQueryStatus } from "../components/inspectorTileQueryModel";
import type { AnalyticsQueryRequest, ChartType, FilterFieldId } from "../../../../shared/types/analytics";
import type { CanvasLayout, DashboardCanvasElement, DashboardDraft, DashboardPage, DashboardTile, SavedAnalyticalTemplate, SavedDerivedDefinition, SavedSegmentProfile, SavedVariableSet } from "../../../../shared/types/dashboard";
import type { DerivedDefinitionRecreationCue, DerivedOutputCreationCue, DerivedOutputRecreationCue } from "../builderTypes";

type SetDashboard = (updater: DashboardDraft | ((current: DashboardDraft) => DashboardDraft), trackHistory?: boolean) => void;

type UseBuilderTileCommandsArgs = {
  activePage: DashboardPage;
  canvasScale: number;
  query: AnalyticsQueryRequest;
  selectedQuestion: typeof defaultDataset.questions[number];
  selectedVariableSet: SavedVariableSet | null;
  savedVariableSets: SavedVariableSet[];
  selectedTile: DashboardTile | null;
  selectedElement: DashboardCanvasElement | null;
  setDashboard: SetDashboard;
  selectTile: (tileId: string) => void;
  setActivePageId: (pageId: string) => void;
  updateTile: (tileId: string, updates: Partial<DashboardTile>) => void;
  applyQuestionSelection: (question: typeof defaultDataset.questions[number]) => void;
  applyVariableSetSelection: (variableSet: SavedVariableSet) => void;
  recordDerivedOutputCreationCue: (cue: Omit<NonNullable<DerivedOutputCreationCue>, "createdAt">) => void;
  recordDerivedOutputRecreationCue: (cue: Omit<NonNullable<DerivedOutputRecreationCue>, "createdAt">) => void;
  recordDerivedDefinitionRecreationCue: (cue: Omit<NonNullable<DerivedDefinitionRecreationCue>, "createdAt">) => void;
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

const tileWidth = 760;
const tileHeight = 460;

function tileInsertionLayout(activePage: DashboardPage, position?: { x: number; y: number }, selectedLayout?: CanvasLayout): CanvasLayout {
  if (position) {
    return {
      x: position.x,
      y: position.y,
      width: tileWidth,
      height: tileHeight,
      zIndex: nextZIndex(activePage)
    };
  }

  if (selectedLayout) {
    return {
      x: Math.max(24, Math.min(canvasWidth - tileWidth - 24, selectedLayout.x)),
      y: Math.max(24, Math.min(canvasHeight - tileHeight - 24, selectedLayout.y + selectedLayout.height + 24)),
      width: tileWidth,
      height: tileHeight,
      zIndex: nextZIndex(activePage)
    };
  }

  return {
    x: 48,
    y: 72 + activePage.tiles.length * 28,
    width: tileWidth,
    height: tileHeight,
    zIndex: nextZIndex(activePage)
  };
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
  selectedTile,
  selectedElement,
  setDashboard,
  selectTile,
  setActivePageId,
  updateTile,
  applyQuestionSelection,
  applyVariableSetSelection,
  recordDerivedOutputCreationCue,
  recordDerivedOutputRecreationCue,
  recordDerivedDefinitionRecreationCue,
  setIsLoading,
  setError
}: UseBuilderTileCommandsArgs) {
  async function createTileFromSource(
    tileQuery: AnalyticsQueryRequest,
    sourceLabel: string,
    position?: { x: number; y: number },
    source?: DashboardTile["source"],
    options?: { segmentProfile?: DashboardTile["segmentProfile"] }
  ) {
    setIsLoading(true);
    setError(null);

    try {
      const response = await runAnalyticsQuery(tileQuery);
      const resolvedResponse = resolveVariableSetResult(response, tileQuery, source, savedVariableSets);
      const tileId = makeTileId();
      const selectedLayout = selectedTile?.layout ?? selectedElement?.layout;
      const tile: DashboardTile = {
        id: tileId,
        name: sourceLabel,
        title: sourceLabel,
        source,
        segmentProfile: options?.segmentProfile,
        analysisLifecycle: {
          role: "canonical",
          canonicalTileId: tileId,
          canonicalLabel: sourceLabel
        },
        locked: false,
        hidden: false,
        layout: tileInsertionLayout(activePage, position, selectedLayout),
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

  async function addTileFromAnalyticalTemplate(template: SavedAnalyticalTemplate) {
    const templateQuery = queryForAnalyticalTemplate(template);
    return createTileFromSource(templateQuery, template.label, undefined, template.source);
  }

  async function addTileFromSegmentProfile(segment: SavedSegmentProfile) {
    const segmentQuery: AnalyticsQueryRequest = {
      ...query,
      filters:
        segment.filterField && segment.filterValue !== "all"
          ? [{ field: segment.filterField, values: [segment.filterValue] }]
          : []
    };
    return createTileFromSource(
      segmentQuery,
      `${selectedVariableSet?.label ?? selectedQuestion.shortLabel} - ${segment.label}`,
      undefined,
      selectedVariableSet
        ? { kind: "variableSet", id: selectedVariableSet.id, label: selectedVariableSet.label }
        : { kind: "question", id: selectedQuestion.id, label: selectedQuestion.shortLabel },
      {
        segmentProfile: {
          id: segment.id,
          label: segment.label,
          filterField: segment.filterField,
          filterValue: segment.filterValue,
          dimensionLabel: segment.summary.dimensionLabel,
          valueLabel: segment.summary.valueLabel
        }
      }
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

  function duplicateDerivedOutputTile(tile: DashboardTile) {
    if (!tile.derivedOutput) {
      setError("Select a derived output to duplicate.");
      return null;
    }

    const duplicateId = makeTileId();
    const duplicate: DashboardTile = {
      ...tile,
      id: duplicateId,
      name: `${tile.name} copy`,
      title: `${tile.title || tile.name} copy`,
      derivedOutput: { ...tile.derivedOutput },
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
    setError(null);
    return duplicate.id;
  }

  function duplicateDerivedOutputFromLibrary(pageId: string, tileId: string) {
    let duplicateId: string | null = null;
    let canDuplicate = false;

    setDashboard((current) => {
      const targetPage = current.pages.find((page) => page.id === pageId);
      const sourceTile = targetPage?.tiles.find((tile) => tile.id === tileId);
      if (!targetPage || !sourceTile?.derivedOutput) return current;

      duplicateId = makeTileId();
      canDuplicate = true;
      const duplicate: DashboardTile = {
        ...sourceTile,
        id: duplicateId,
        name: `${sourceTile.name} copy`,
        title: `${sourceTile.title || sourceTile.name} copy`,
        derivedOutput: { ...sourceTile.derivedOutput },
        layout: {
          ...sourceTile.layout,
          x: sourceTile.layout.x + 28,
          y: sourceTile.layout.y + 28,
          zIndex: nextZIndex(targetPage)
        },
        appearance: {
          ...sourceTile.appearance,
          palette: [...sourceTile.appearance.palette],
          barStyles: { ...sourceTile.appearance.barStyles }
        }
      };

      return {
        ...current,
        status: "draft",
        pages: current.pages.map((page) => (page.id === pageId ? { ...page, tiles: [...page.tiles, duplicate] } : page))
      };
    });

    if (!canDuplicate || !duplicateId) {
      setError("Could not find that derived output to duplicate.");
      return null;
    }

    setActivePageId(pageId);
    selectTile(duplicateId);
    setError(null);
    return duplicateId;
  }

  function createDerivedOutputTile(
    tile: DashboardTile,
    kind: DerivedOutputKind,
    options?: { savedDefinition?: NonNullable<DashboardTile["derivedOutput"]>["savedDefinition"] }
  ) {
    const outputResult = buildDerivedOutputResponse(tile, kind);
    const derivedOutput = buildDerivedOutputMetadata(tile, kind);
    if (!outputResult || !derivedOutput) {
      setError(kind === "top_n_extract" || kind === "bottom_n_extract"
        ? "This tile does not have result rows that can be extracted."
        : "This tile does not have a result row that can be summarized.");
      return null;
    }

    const outputId = makeTileId();
    const outputTitle = buildDerivedOutputTitle(derivedOutput);
    const outputTile: DashboardTile = {
      ...tile,
      id: outputId,
      name: outputTitle,
      title: outputTitle,
      visualization: "table",
      query: { ...tile.query, chartType: "table" },
      result: {
        ...outputResult,
        query: { ...outputResult.query, chartType: "table" }
      },
      derivedOutput: {
        ...derivedOutput,
        savedDefinition: options?.savedDefinition
      },
      analysisLifecycle: {
        role: "derived",
        canonicalTileId: tile.analysisLifecycle?.canonicalTileId ?? tile.id,
        canonicalLabel: tile.analysisLifecycle?.canonicalLabel ?? tile.title,
        derivedFrom: {
          tileId: tile.id,
          title: tile.title || tile.name,
          visualization: tile.visualization
        }
      },
      layout: {
        ...tileInsertionLayout(activePage, undefined, tile.layout),
        width: 560,
        height: 260
      },
      appearance: {
        ...tile.appearance,
        palette: [...tile.appearance.palette],
        barStyles: { ...tile.appearance.barStyles },
        showTable: true,
        showValueLabels: true,
        showBases: true,
        showNotes: true
      }
    };

    setDashboard((current) => ({
      ...current,
      status: "draft",
      pages: current.pages.map((page) => (page.id === activePage.id ? { ...page, tiles: [...page.tiles, outputTile] } : page))
    }));
    selectTile(outputTile.id);
    recordDerivedOutputCreationCue({
      tileId: outputTile.id,
      sourceTileId: tile.id,
      sourceTitle: tile.title || tile.name,
      outputKind: derivedOutput.kind
    });
    setError(null);
    return outputTile.id;
  }

  function createDerivedOutputFromDefinition(definition: SavedDerivedDefinition) {
    const sourceTile = activePage.tiles.find((tile) => tile.id === definition.sourceTileId);
    if (!sourceTile) {
      setError("Open the page with this definition's source tile before creating from it.");
      return null;
    }

    const createdTileId = createDerivedOutputTile(sourceTile, definition.outputKind, {
      savedDefinition: {
        id: definition.id,
        label: definition.label,
        outputKind: definition.outputKind,
        sourceTileId: definition.sourceTileId,
        sourceTileTitle: definition.sourceTileTitle
      }
    });
    if (createdTileId) {
      recordDerivedDefinitionRecreationCue({
        tileId: createdTileId,
        definitionId: definition.id,
        definitionLabel: definition.label,
        outputKind: definition.outputKind
      });
    }
    return createdTileId;
  }

  function recreateDerivedOutputTile(tile: DashboardTile) {
    const sourceTileId = tile.derivedOutput?.sourceTileId;
    if (!tile.derivedOutput || !sourceTileId) {
      setError("This derived output does not have a source tile relationship to recreate from.");
      return false;
    }

    const sourceTile = activePage.tiles.find((item) => item.id === sourceTileId);
    if (!sourceTile) {
      setError("The source tile for this derived output is not on the current page.");
      return false;
    }

    const outputResult = buildDerivedOutputResponse(sourceTile, tile.derivedOutput.kind);
    const derivedOutput = buildDerivedOutputMetadata(sourceTile, tile.derivedOutput.kind);
    if (!outputResult || !derivedOutput) {
      setError("The source tile no longer has result data that can recreate this derived output.");
      return false;
    }

    const recreatedOutput = { ...derivedOutput, lastRecreatedAt: Date.now() };
    const outputTitle = buildDerivedOutputTitle(recreatedOutput);
    updateTile(tile.id, {
      name: outputTitle,
      title: outputTitle,
      visualization: "table",
      query: { ...sourceTile.query, chartType: "table" },
      result: {
        ...outputResult,
        query: { ...outputResult.query, chartType: "table" }
      },
      derivedOutput: recreatedOutput,
      analysisLifecycle: {
        role: "derived",
        canonicalTileId: sourceTile.analysisLifecycle?.canonicalTileId ?? sourceTile.id,
        canonicalLabel: sourceTile.analysisLifecycle?.canonicalLabel ?? sourceTile.title,
        derivedFrom: {
          tileId: sourceTile.id,
          title: sourceTile.title || sourceTile.name,
          visualization: sourceTile.visualization
        }
      }
    });
    selectTile(tile.id);
    recordDerivedOutputRecreationCue({
      tileId: tile.id,
      sourceTitle: sourceTile.title || sourceTile.name,
      outputKind: recreatedOutput.kind,
      readinessLabel: buildTileQueryStatus(sourceTile).hasPendingChanges ? "Source result may be stale" : "Reflects current stored source result"
    });
    setError(null);
    return true;
  }

  return {
    createTileFromSource,
    startDataSourceDrag,
    handleCanvasDrop,
    addTileFromQuery,
    addTileFromSourceWithVisualization,
    addTileFromVariableSet,
    addTileFromAnalyticalTemplate,
    addTileFromSegmentProfile,
    rerunTileAnalysis,
    tileWithVisualization,
    duplicateTileAsVisualization,
    duplicateDerivedOutputTile,
    duplicateDerivedOutputFromLibrary,
    createDerivedOutputTile,
    createDerivedOutputFromDefinition,
    recreateDerivedOutputTile
  };
}
