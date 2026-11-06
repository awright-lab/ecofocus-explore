import type React from "react";
import { findAnalysisPlacement, type AnalysisDestination } from "../analysisPlacement";
import { buildPageFromTemplate } from "../builderDocumentCommands";
import { useAnalysisOperationOwnership } from "./useAnalysisOperationOwnership";
import { runAnalyticsQuery } from "../../../lib/api";
import { applyVariableSetRows } from "../../../../shared/analytics/variableSets";
import { canvasHeight, canvasWidth, defaultAppearance, defaultDataset } from "../builderConstants";
import { defaultVariableSetRows } from "../../document/documentSeeds";
import { makeTileId, nextZIndex } from "../../document/documentModel";
import { getCompatibleChartTypes } from "../../analytics/analyticsDisplay";
import { queryForAnalyticalTemplate, queryForQuestion, queryForVariableSet } from "../../analytics/useAnalysisAuthoring";
import { getChartTypeLabel } from "../../analytics/analyticsDisplay";
import { buildDerivedOutputMetadata, buildDerivedOutputResponse, buildDerivedOutputTitle, type DerivedOutputConfig, type DerivedOutputKind } from "../components/derivedOutputModel";
import { buildTileQueryStatus } from "../components/inspectorTileQueryModel";
import { runImportedDatasetQueryForRuntime } from "../../data/importedDatasetRuntimeQuery";
import { assertSavedImportedTileSource, runSavedImportedQuery } from "../../data/savedImportedQuery";
import { importedFieldDisplayLabel } from "../../data/datasetModelingModel";
import {
  buildSmartCompositionBlockFromTile,
  createObjectsFromCompositionBlock,
  isComparisonQuery,
  type CompositionStarterContext,
  type SmartCompositionStarterId
} from "../components/compositionBlockModel";
import type { AnalyticsQueryRequest, ChartType, FilterFieldId, Metric } from "../../../../shared/types/analytics";
import type { CanvasLayout, DashboardCanvasElement, DashboardDraft, DashboardPage, DashboardTile, ImportedDatasetField, ImportedDatasetRecord, SavedAnalyticalTemplate, SavedDerivedDefinition, SavedSegmentProfile, SavedVariableSet } from "../../../../shared/types/dashboard";
import type { DerivedDefinitionRecreationCue, DerivedOutputCreationCue, DerivedOutputRecreationCue } from "../builderTypes";

type SetDashboard = (updater: DashboardDraft | ((current: DashboardDraft) => DashboardDraft), trackHistory?: boolean) => boolean;

type UseBuilderTileCommandsArgs = {
  documentId: string;
  getContextVersion: () => string | number;
  documentVersion?: string;
  readOnly?: boolean;
  activePage: DashboardPage;
  canvasScale: number;
  query: AnalyticsQueryRequest;
  selectedQuestion: typeof defaultDataset.questions[number];
  selectedVariableSet: SavedVariableSet | null;
  savedVariableSets: SavedVariableSet[];
  importedDatasets?: ImportedDatasetRecord[];
  selectedTile: DashboardTile | null;
  selectedElement: DashboardCanvasElement | null;
  setDashboard: SetDashboard;
  selectTile: (tileId: string) => void;
  setActivePageId: (pageId: string, originPageId?: string) => void;
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
  if (response.metadataRefs.authoredVariableSet?.applied) {
    return response;
  }

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

function tableFirstQuery(nextQuery: AnalyticsQueryRequest): AnalyticsQueryRequest {
  const questionMetadata = defaultDataset.questions.find((item) => item.id === nextQuery.question);
  return questionMetadata?.allowedChartTypes.includes("table")
    ? { ...nextQuery, chartType: "table" }
    : nextQuery;
}

export function useBuilderTileCommands({
  documentId,
  getContextVersion,
  documentVersion,
  readOnly = false,
  activePage,
  canvasScale,
  query,
  selectedQuestion,
  selectedVariableSet,
  savedVariableSets,
  importedDatasets = [],
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
  const beginOperation = useAnalysisOperationOwnership(JSON.stringify([documentId, activePage.id, documentVersion]), readOnly, setIsLoading, getContextVersion);
  function insertCreatedAnalysis(tile: DashboardTile, ownsContext: () => boolean, destination?: AnalysisDestination) {
    const newPage = destination === "new_page" ? buildPageFromTemplate({ pageCount: 0, pageThemes: [], pageMasters: [] }) : null;
    const inserted = setDashboard((current) => {
      if (!ownsContext() || current.id !== documentId) return current;
      const sourcePage = current.pages.find(page => page.id === activePage.id);
      if (!sourcePage) return current;
      if (newPage) {
        if (current.pages.some(page => page.id === newPage.id)) return current;
        const order = current.pages.reduce((maximum, page) => Math.max(maximum, page.order), 0) + 1;
        const layout = findAnalysisPlacement(newPage)!;
        return { ...current, status: "draft", pages: [...current.pages, { ...newPage, title: `Analysis ${order}`, order, tiles: [{ ...tile, layout }] }] };
      }
      const layout = destination === "current_page" ? findAnalysisPlacement(sourcePage, tile.layout) : tile.layout;
      if (!layout) return current;
      return { ...current, status: "draft", pages: current.pages.map(page => page.id === sourcePage.id ? { ...page, tiles: [...page.tiles, { ...tile, layout }] } : page) };
    });
    if (!inserted) {
      if (destination && ownsContext()) setError("This page has no room for the analysis. Choose a new page in analysis setup, or make space and retry. Your existing objects are unchanged.");
      return null;
    }
    if (newPage) setActivePageId(newPage.id, activePage.id);
    selectTile(tile.id);
    return tile.id;
  }
  async function executeQuery(nextQuery: AnalyticsQueryRequest, source: DashboardTile["source"]) {
    if (nextQuery.sourceIdentity?.kind !== "imported" &&
        (source?.kind === "importedField" || nextQuery.sourceRef && ["imported_file","workspace_database"].includes(nextQuery.sourceRef.kind))) {
      throw new Error("This saved analysis is missing its imported study context. Recreate it from the original result.");
    }
    assertSavedImportedTileSource(nextQuery, source);
    return nextQuery.sourceIdentity?.kind === "imported" ? runSavedImportedQuery(nextQuery, importedDatasets) : runAnalyticsQuery(nextQuery);
  }
  async function createTileFromSource(
    tileQuery: AnalyticsQueryRequest,
    sourceLabel: string,
    position?: { x: number; y: number },
    source?: DashboardTile["source"],
    options?: { segmentProfile?: DashboardTile["segmentProfile"]; isCurrent?: () => boolean; destination?: AnalysisDestination; contextNotes?: string[] }
  ) {
    const operation = beginOperation(options?.isCurrent);
    if (!operation) return null;
    setError(null);

    try {
      const response = await executeQuery(tileQuery, source);
      if (!operation.isCurrent()) return null;
      const resolvedResponse = tileQuery.sourceIdentity?.kind === "imported" ? response : resolveVariableSetResult(response, tileQuery, source, savedVariableSets);
      const tileId = makeTileId();
      const importedIdentity = response.query.sourceIdentity?.kind === "imported" ? response.query.sourceIdentity : null;
      const resolvedSource = importedIdentity ? {
        kind: "importedField" as const, id: `${importedIdentity.datasetId}:${importedIdentity.primaryFieldId}`,
        label: source?.kind === "importedField" ? source.label : importedIdentity.primaryFieldLabel,
        datasetId: importedIdentity.datasetId, fieldId: importedIdentity.primaryFieldId, sourceRef: importedIdentity.sourceRef,
      } : source;
      const selectedLayout = selectedTile?.layout ?? selectedElement?.layout;
      const tile: DashboardTile = {
        id: tileId,
        name: sourceLabel,
        title: sourceLabel,
        source: resolvedSource,
        segmentProfile: options?.segmentProfile,
        analysisLifecycle: {
          role: "canonical",
          canonicalTileId: tileId,
          canonicalLabel: sourceLabel
        },
        locked: false,
        hidden: false,
        layout: tileInsertionLayout(activePage, position, selectedLayout),
        query: response.query,
        visualization: tileQuery.chartType,
        appearance: { ...defaultAppearance, palette: [...defaultAppearance.palette] },
        result: options?.contextNotes?.length ? { ...resolvedResponse, notes: [...resolvedResponse.notes, ...options.contextNotes] } : resolvedResponse
      };

      return insertCreatedAnalysis(tile, operation.ownsContext, options?.destination);
    } catch (queryError) {
      if (operation.isCurrent()) setError(queryError instanceof Error ? queryError.message : "Something went wrong.");
      return null;
    } finally {
      operation.finish();
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
          tableFirstQuery(queryForVariableSet(variableSet)),
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
        tableFirstQuery(queryForQuestion(nextQuestion)),
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
      tableFirstQuery(query),
      selectedVariableSet?.label ?? selectedQuestion.shortLabel,
      undefined,
      selectedVariableSet
        ? { kind: "variableSet", id: selectedVariableSet.id, label: selectedVariableSet.label }
        : { kind: "question", id: selectedQuestion.id, label: selectedQuestion.shortLabel }
    );
  }

  async function addTileFromSourceWithVisualization(nextVisualization: ChartType, isCurrent?: () => boolean, destination?: AnalysisDestination) {
    return createTileFromSource(
      { ...query, chartType: nextVisualization },
      selectedVariableSet?.label ?? selectedQuestion.shortLabel,
      undefined,
      selectedVariableSet
        ? { kind: "variableSet", id: selectedVariableSet.id, label: selectedVariableSet.label }
        : { kind: "question", id: selectedQuestion.id, label: selectedQuestion.shortLabel },
      { isCurrent, destination }
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

  async function addTileFromImportedDatasetField(
    dataset: ImportedDatasetRecord,
    field: ImportedDatasetField,
    nextVisualization: ChartType,
    nextMetric: Metric,
    options?: {
      destination?: AnalysisDestination;
      groupingScope?: "all_respondents";
      isCurrent?: () => boolean;
      measureField?: ImportedDatasetField | null;
      bannerField?: ImportedDatasetField | null;
      filter?: {
        field: ImportedDatasetField;
        value: string;
      } | null;
    }
  ) {
    const operation = beginOperation(options?.isCurrent);
    if (!operation) return null;
    setError(null);

    try {
      const response = await runImportedDatasetQueryForRuntime({
        dataset,
        field,
        groupingScope: options?.groupingScope,
        measureField: options?.measureField,
        bannerField: options?.bannerField,
        filter: options?.filter,
        chartType: nextVisualization,
        metric: nextMetric
      });
      if (!operation.isCurrent()) return null;
      const tileId = makeTileId();
      const selectedLayout = selectedTile?.layout ?? selectedElement?.layout;
      const measureField = options?.measureField ?? null;
      const isMeasureTile = (nextMetric === "average" || nextMetric === "sum") && measureField;
      const fieldLabel = importedFieldDisplayLabel(field);
      const measureLabel = importedFieldDisplayLabel(measureField);
      const tileLabel = isMeasureTile
        ? `${nextMetric === "sum" ? "Sum of" : "Average"} ${measureLabel} by ${fieldLabel}`
        : fieldLabel;
      const sourceLabel = `${dataset.title}: ${tileLabel}`;
      const sourceRef = response.metadataRefs.source?.sourceRef;
      const tile: DashboardTile = {
        id: tileId,
        name: tileLabel,
        title: tileLabel,
        source: {
          kind: "importedField",
          id: `${dataset.id}:${field.id}`,
          label: tileLabel,
          sourceRef,
          datasetId: dataset.id,
          fieldId: field.id
        },
        analysisLifecycle: {
          role: "canonical",
          canonicalTileId: tileId,
          canonicalLabel: sourceLabel
        },
        locked: false,
        hidden: false,
        layout: tileInsertionLayout(activePage, undefined, selectedLayout),
        query: response.query,
        visualization: nextVisualization,
        appearance: { ...defaultAppearance, palette: [...defaultAppearance.palette] },
        result: response
      };

      return insertCreatedAnalysis(tile, operation.ownsContext, options?.destination);
    } catch (queryError) {
      if (operation.isCurrent()) setError(queryError instanceof Error ? queryError.message : "Something went wrong creating this imported-data view.");
      return null;
    } finally {
      operation.finish();
    }
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
      tableFirstQuery(segmentQuery),
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

  async function createSourceDrivenSmartStarter(starterId: SmartCompositionStarterId) {
    const operation = beginOperation();
    if (!operation) return null;
    setError(null);

    try {
      if (starterId === "source_comparison_section" && !isComparisonQuery(query)) {
        setError("Choose a banner or wave comparison before creating a comparison starter from the active source.");
        return null;
      }
      if (query.sourceIdentity?.kind === "imported" || query.sourceRef && ["imported_file","workspace_database"].includes(query.sourceRef.kind)) {
        throw new Error("Create an imported analysis first, then build a report section from that result on the canvas.");
      }
      const starterQuery: AnalyticsQueryRequest = {
        ...query,
        chartType: starterId === "source_table_insight" ? "table" : query.chartType
      };
      const sourceLabel = selectedVariableSet?.label ?? selectedQuestion.shortLabel;
      const source = selectedVariableSet
        ? { kind: "variableSet" as const, id: selectedVariableSet.id, label: selectedVariableSet.label }
        : { kind: "question" as const, id: selectedQuestion.id, label: selectedQuestion.shortLabel };
      const response = await runAnalyticsQuery(starterQuery);
      if (!operation.isCurrent()) return null;
      const resolvedResponse = resolveVariableSetResult(response, starterQuery, source, savedVariableSets);
      const seedTileId = makeTileId();
      const seedTile: DashboardTile = {
        id: seedTileId,
        name: sourceLabel,
        title: sourceLabel,
        source,
        analysisLifecycle: {
          role: "canonical",
          canonicalTileId: seedTileId,
          canonicalLabel: sourceLabel
        },
        locked: false,
        hidden: false,
        layout: {
          x: 0,
          y: 0,
          width: starterId === "methodology_chart_section" ? 756 : 520,
          height: starterId === "methodology_chart_section" ? 300 : 350,
          zIndex: 1
        },
        query: starterQuery,
        visualization: starterQuery.chartType,
        appearance: { ...defaultAppearance, palette: [...defaultAppearance.palette] },
        result: resolvedResponse
      };
      const starterBlock = buildSmartCompositionBlockFromTile(
        starterId,
        seedTile
      );
      if (!starterBlock) {
        setError("The active source does not have enough context for that starter.");
        return null;
      }

      const selectedLayout = selectedTile?.layout ?? selectedElement?.layout;
      const starterContext: CompositionStarterContext = {
        kind: starterId === "source_comparison_section" ? "activeComparisonQuery" : "activeSource",
        label: sourceLabel,
        nextEditHint:
          starterId === "source_table_insight"
            ? "Check the table rows and bases, then write the key interpretation."
            : "Review the generated analysis, then edit the commentary and context note."
      };
      const { tiles, elements, placement } = createObjectsFromCompositionBlock(starterBlock, activePage, {
        sourceKind: "starter",
        anchorLayout: selectedLayout,
        starterContext
      });
      if (tiles.length === 0 && elements.length === 0) return null;

      const inserted = setDashboard((current) => !operation.ownsContext() || current.id !== documentId ? current : ({
        ...current,
        status: "draft",
        pages: current.pages.map((page) =>
          page.id === activePage.id
            ? {
                ...page,
                tiles: [...page.tiles, ...tiles],
                elements: [...page.elements, ...elements]
              }
            : page
        )
      }));
      if (!inserted) return null;
      if (tiles[0]) {
        selectTile(tiles[0].id);
      }
      return {
        tileId: tiles[0]?.id ?? null,
        label: starterBlock.label,
        contextLabel: starterId === "source_comparison_section" ? "active comparison query" : "active source",
        placement
      };
    } catch (queryError) {
      if (operation.isCurrent()) setError(queryError instanceof Error ? queryError.message : "Something went wrong creating this analytical starter.");
      return null;
    } finally {
      operation.finish();
    }
  }

  async function rerunTileAnalysis(tile: DashboardTile, nextQuery: AnalyticsQueryRequest) {
    const operation = beginOperation(undefined, tile.id);
    if (!operation) return false;
    setError(null);

    try {
      const response = await executeQuery(nextQuery, tile.source);
      if (!operation.isCurrent()) return false;
      const resolvedResponse = nextQuery.sourceIdentity?.kind === "imported" ? response : resolveVariableSetResult(response, nextQuery, tile.source, savedVariableSets);
      const compatibleVisualizations = getCompatibleChartTypes(resolvedResponse);
      const nextVisualization = compatibleVisualizations.includes(tile.visualization)
        ? tile.visualization
        : compatibleVisualizations[0] ?? "table";

      const updates: Partial<DashboardTile> = {
        query: { ...response.query, chartType: nextVisualization, confidenceLevel: response.query.confidenceLevel ?? 0.95 },
        visualization: nextVisualization,
        result: {
          ...resolvedResponse,
          query: { ...resolvedResponse.query, chartType: nextVisualization, confidenceLevel: resolvedResponse.query.confidenceLevel ?? nextQuery.confidenceLevel ?? 0.95 }
        }
      };
      return setDashboard(current => !operation.ownsContext() || current.id !== documentId ? current : ({ ...current, status: "draft",
        pages: current.pages.map(page => page.id !== activePage.id ? page : { ...page, tiles: page.tiles.map(item => item.id === tile.id ? { ...item, ...updates } : item) }),
      }));
    } catch (queryError) {
      if (operation.isCurrent()) setError(queryError instanceof Error ? queryError.message : "Something went wrong refreshing this analysis.");
      return false;
    } finally {
      operation.finish();
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
    options?: { savedDefinition?: NonNullable<DashboardTile["derivedOutput"]>["savedDefinition"]; config?: DerivedOutputConfig }
  ) {
    const outputResult = buildDerivedOutputResponse(tile, kind, options?.config);
    const derivedOutput = buildDerivedOutputMetadata(tile, kind, options?.config);
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
      config: {
        rowId: definition.spec.rowId,
        comparedRowId: definition.spec.comparedRowId,
        columnId: definition.spec.columnId
      },
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

    const config: DerivedOutputConfig = {
      rowId: tile.derivedOutput.rowId,
      comparedRowId: tile.derivedOutput.comparedRowId,
      columnId: tile.derivedOutput.columnId
    };
    const outputResult = buildDerivedOutputResponse(sourceTile, tile.derivedOutput.kind, config);
    const derivedOutput = buildDerivedOutputMetadata(sourceTile, tile.derivedOutput.kind, config);
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
    addTileFromImportedDatasetField,
    addTileFromAnalyticalTemplate,
    addTileFromSegmentProfile,
    createSourceDrivenSmartStarter,
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
