import { useEffect, useMemo, useState } from "react";
import {
  bannerDimensions,
  defaultBreakBy,
  defaultDataset,
  defaultFilterDimension,
  defaultQuestion,
  filterDimensions,
  waveComparisonChartTypes
} from "../builder/builderConstants";
import { defaultVisualizationForQuestion } from "./analyticsDisplay";
import { defaultVariableSetRows, normalizeVariableSetRows } from "../document/documentSeeds";
import type {
  AnalyticsQueryRequest,
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
  SavedAnalyticalTemplate,
  SavedBanner,
  SavedDerivedDefinition,
  SavedFilterSet,
  SavedSegmentProfile,
  SavedVariableSet,
  SavedWeightProfile
} from "../../../shared/types/dashboard";

type SetDashboard = (updater: DashboardDraft | ((current: DashboardDraft) => DashboardDraft), trackHistory?: boolean) => void;

export function queryForQuestion(nextQuestion: typeof defaultDataset.questions[number]): AnalyticsQueryRequest {
  return {
    dataset: defaultDataset.id,
    question: nextQuestion.id,
    breakBy: nextQuestion.allowedBreakBys[0],
    filters: [],
    weight: defaultDataset.defaultWeight,
    metric: nextQuestion.defaultMetric,
    chartType: defaultVisualizationForQuestion(nextQuestion),
    confidenceLevel: 0.95,
    comparisonMode: "none",
    comparisonDatasets: []
  };
}

export function queryForVariableSet(variableSet: SavedVariableSet): AnalyticsQueryRequest {
  const nextQuestion = defaultDataset.questions.find((item) => item.id === variableSet.primaryQuestionId) ?? defaultQuestion;
  const nextComparisonMode = variableSet.comparisonMode ?? "none";
  return {
    dataset: defaultDataset.id,
    question: nextQuestion.id,
    breakBy:
      nextComparisonMode === "wave"
        ? "SUMMARY"
        : nextQuestion.allowedBreakBys.includes(variableSet.breakBy)
          ? variableSet.breakBy
          : nextQuestion.allowedBreakBys[0],
    filters: variableSet.filterField && variableSet.filterValue !== "all" ? [{ field: variableSet.filterField, values: [variableSet.filterValue] }] : [],
    weight: variableSet.weight,
    metric: nextQuestion.allowedMetrics.includes(variableSet.metric) ? variableSet.metric : nextQuestion.defaultMetric,
    chartType:
      nextComparisonMode === "wave"
        ? (waveComparisonChartTypes.find((item) => item === variableSet.chartType) ?? waveComparisonChartTypes[0])
        : nextQuestion.allowedChartTypes.includes(variableSet.chartType)
          ? variableSet.chartType
          : defaultVisualizationForQuestion(nextQuestion),
    confidenceLevel: 0.95,
    comparisonMode: nextComparisonMode,
    comparisonDatasets: variableSet.comparisonDatasets ?? [],
    authoredVariableSet:
      variableSet.rowMode === "authored"
        ? {
            id: variableSet.id,
            label: variableSet.label,
            rowMode: "authored",
            rows: variableSet.rows
          }
        : undefined
  };
}

export function queryForAnalyticalTemplate(template: SavedAnalyticalTemplate): AnalyticsQueryRequest {
  return {
    ...template.query,
    chartType: template.visualization,
    confidenceLevel: template.query.confidenceLevel ?? 0.95
  };
}

export function useAnalysisAuthoring({
  dashboard,
  setDashboard,
  sourceSearch,
  selectedDataSource,
  setSelectedDataSource,
  setError
}: {
  dashboard: DashboardDraft;
  setDashboard: SetDashboard;
  sourceSearch: string;
  selectedDataSource: { kind: "question" | "variableSet"; id: string };
  setSelectedDataSource: (source: { kind: "question" | "variableSet"; id: string }) => void;
  setError: (value: string | null) => void;
}) {
  const savedVariableSets = dashboard.analysisLibrary.variableSets;
  const savedBanners = dashboard.analysisLibrary.banners;
  const savedFilters = dashboard.analysisLibrary.filters;
  const savedSegmentProfiles = dashboard.analysisLibrary.segments;
  const savedWeights = dashboard.analysisLibrary.weights;
  const savedAnalyticalTemplates = dashboard.analysisLibrary.templates;
  const savedDerivedDefinitions = dashboard.analysisLibrary.derivedDefinitions;
  const [question, setQuestion] = useState<QuestionId>(defaultQuestion.id);
  const [breakBy, setBreakBy] = useState<BreakById>(defaultBreakBy.id as BreakById);
  const [metric, setMetric] = useState<Metric>(defaultQuestion.defaultMetric);
  const [chartType, setChartType] = useState<ChartType>(defaultVisualizationForQuestion(defaultQuestion));
  const [weight, setWeight] = useState<WeightId | null>(defaultDataset.defaultWeight);
  const [filterField, setFilterField] = useState<FilterFieldId | null>(defaultFilterDimension?.id ?? null);
  const [filterValue, setFilterValue] = useState("all");
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>("none");
  const [comparisonDatasets, setComparisonDatasets] = useState<DatasetId[]>([]);
  const [weightDraftName, setWeightDraftName] = useState(defaultDataset.weights.find((item) => item.id === defaultDataset.defaultWeight)?.label ?? "Unweighted sample");
  const [variableSetDraftName, setVariableSetDraftName] = useState(defaultQuestion.shortLabel);
  const [variableSetDescription, setVariableSetDescription] = useState("");
  const [variableSetQuestionIds, setVariableSetQuestionIds] = useState<QuestionId[]>([defaultQuestion.id]);
  const [variableSetRows, setVariableSetRows] = useState<SavedVariableSet["rows"]>(defaultVariableSetRows(defaultQuestion.id));
  const [variableSetOptionSelection, setVariableSetOptionSelection] = useState<string[]>([]);
  const [bannerDraftName, setBannerDraftName] = useState("Summary");
  const [filterDraftName, setFilterDraftName] = useState("All shopper segments");

  const selectedQuestion = useMemo(() => {
    return defaultDataset.questions.find((item) => item.id === question) ?? defaultQuestion;
  }, [question]);
  const selectedVariableSet = selectedDataSource.kind === "variableSet" ? savedVariableSets.find((item) => item.id === selectedDataSource.id) ?? null : null;
  const normalizedSourceSearch = sourceSearch.trim().toLowerCase();
  const filteredVariableSets = savedVariableSets.filter((item) =>
    !normalizedSourceSearch ||
    item.label.toLowerCase().includes(normalizedSourceSearch) ||
    item.topic.toLowerCase().includes(normalizedSourceSearch) ||
    item.description.toLowerCase().includes(normalizedSourceSearch)
  );
  const filteredQuestions = defaultDataset.questions.filter((item) =>
    !normalizedSourceSearch ||
    item.shortLabel.toLowerCase().includes(normalizedSourceSearch) ||
    item.topic.toLowerCase().includes(normalizedSourceSearch) ||
    item.label.toLowerCase().includes(normalizedSourceSearch)
  );
  const selectedFilterDimension = filterField ? filterDimensions.find((item) => item.id === filterField) : undefined;
  const selectedChartTypes =
    comparisonMode === "wave"
      ? waveComparisonChartTypes.filter((type) => {
          if (type === "table") return true;
          const chartMetadata = defaultDataset.chartTypes.find((item) => item.id === type);
          return Boolean(chartMetadata && chartMetadata.supportedMetrics.includes(metric));
        })
      : selectedQuestion.allowedChartTypes;
  const query: AnalyticsQueryRequest = {
    dataset: defaultDataset.id,
    question,
    breakBy: comparisonMode === "wave" ? "SUMMARY" : breakBy,
    filters: filterField && filterValue !== "all" ? [{ field: filterField, values: [filterValue] }] : [],
    weight,
    metric,
    chartType,
    confidenceLevel: 0.95,
    comparisonMode,
    comparisonDatasets
  };

  useEffect(() => {
    if (comparisonMode === "wave" && breakBy !== "SUMMARY") {
      setBreakBy("SUMMARY");
    }
  }, [comparisonMode, breakBy]);

  useEffect(() => {
    if (!selectedChartTypes.includes(chartType)) {
      setChartType(selectedChartTypes[0] ?? "table");
    }
  }, [chartType, selectedChartTypes]);

  function toggleComparisonDataset(datasetId: DatasetId) {
    setComparisonDatasets((current) =>
      current.includes(datasetId) ? current.filter((item) => item !== datasetId) : [...current, datasetId]
    );
  }

  function applyQuestionSelection(nextQuestion: typeof defaultDataset.questions[number], sourceId = nextQuestion.id) {
    setSelectedDataSource({ kind: "question", id: sourceId });
    setQuestion(nextQuestion.id);
    setBreakBy(nextQuestion.allowedBreakBys[0]);
    setMetric(nextQuestion.defaultMetric);
    setChartType(defaultVisualizationForQuestion(nextQuestion));
    setWeight(defaultDataset.defaultWeight);
    setFilterField(defaultFilterDimension?.id ?? null);
    setFilterValue("all");
    setComparisonMode("none");
    setComparisonDatasets([]);
    setVariableSetDraftName(nextQuestion.shortLabel);
    setVariableSetDescription(`Saved view for ${nextQuestion.shortLabel}`);
    setVariableSetQuestionIds([nextQuestion.id]);
    setVariableSetRows(defaultVariableSetRows(nextQuestion.id));
    setVariableSetOptionSelection([]);
  }

  function applyVariableSetSelection(variableSet: SavedVariableSet) {
    const nextQuestion = defaultDataset.questions.find((item) => item.id === variableSet.primaryQuestionId) ?? defaultQuestion;
    const nextComparisonMode = variableSet.comparisonMode ?? "none";
    const nextChartType =
      nextComparisonMode === "wave"
        ? (waveComparisonChartTypes.find((item) => item === variableSet.chartType) ?? waveComparisonChartTypes[0])
        : nextQuestion.allowedChartTypes.includes(variableSet.chartType)
          ? variableSet.chartType
          : defaultVisualizationForQuestion(nextQuestion);
    setSelectedDataSource({ kind: "variableSet", id: variableSet.id });
    setQuestion(nextQuestion.id);
    setBreakBy(
      nextComparisonMode === "wave"
        ? "SUMMARY"
        : nextQuestion.allowedBreakBys.includes(variableSet.breakBy)
          ? variableSet.breakBy
          : nextQuestion.allowedBreakBys[0]
    );
    setMetric(nextQuestion.allowedMetrics.includes(variableSet.metric) ? variableSet.metric : nextQuestion.defaultMetric);
    setChartType(nextChartType);
    setWeight(variableSet.weight);
    setFilterField(variableSet.filterField);
    setFilterValue(variableSet.filterValue);
    setComparisonMode(nextComparisonMode);
    setComparisonDatasets(variableSet.comparisonDatasets ?? []);
    setVariableSetDraftName(variableSet.label);
    setVariableSetDescription(variableSet.description);
    setVariableSetQuestionIds(variableSet.questionIds);
    setVariableSetRows(normalizeVariableSetRows(variableSet.rows, nextQuestion.id));
    setVariableSetOptionSelection([]);
  }

  function saveCurrentVariableSet(createNew = !selectedVariableSet) {
    const trimmedLabel = variableSetDraftName.trim();
    if (!trimmedLabel) {
      setError("Give the variable set a name before saving it.");
      return;
    }
    if (variableSetQuestionIds.length === 0) {
      setError("Choose at least one question for the variable set.");
      return;
    }

    const nextVariableSet: SavedVariableSet = {
      id: createNew ? `variable_set_${Date.now()}` : (selectedVariableSet?.id ?? `variable_set_${Date.now()}`),
      datasetId: defaultDataset.id,
      label: trimmedLabel,
      description: variableSetDescription.trim() || `Saved view for ${selectedQuestion.shortLabel}`,
      topic: selectedQuestion.topic,
      questionIds: variableSetQuestionIds,
      primaryQuestionId: selectedQuestion.id,
      rowMode: "authored",
      rows: normalizeVariableSetRows(variableSetRows, selectedQuestion.id),
      breakBy,
      metric,
      chartType,
      comparisonMode,
      comparisonDatasets,
      weight,
      filterField,
      filterValue
    };

    setDashboard((current) => ({
      ...current,
      status: "draft",
      analysisLibrary: {
        ...current.analysisLibrary,
        variableSets: createNew
          ? [nextVariableSet, ...current.analysisLibrary.variableSets]
          : current.analysisLibrary.variableSets.map((item) => (item.id === nextVariableSet.id ? nextVariableSet : item))
      }
    }));
    setSelectedDataSource({ kind: "variableSet", id: nextVariableSet.id });
    setError(null);
  }

  function deleteVariableSet(variableSetId: string) {
    setDashboard((current) => ({
      ...current,
      status: "draft",
      analysisLibrary: {
        ...current.analysisLibrary,
        variableSets: current.analysisLibrary.variableSets.filter((item) => item.id !== variableSetId)
      }
    }));
    setSelectedDataSource({ kind: "question", id: selectedQuestion.id });
  }

  function toggleVariableSetQuestion(questionId: QuestionId) {
    setVariableSetQuestionIds((current) => {
      if (current.includes(questionId)) {
        const next = current.filter((item) => item !== questionId);
        if (question === questionId && next.length > 0) {
          const nextQuestion = defaultDataset.questions.find((item) => item.id === next[0]) ?? defaultQuestion;
          setQuestion(nextQuestion.id);
          setBreakBy(nextQuestion.allowedBreakBys[0]);
          setMetric(nextQuestion.defaultMetric);
          setChartType(defaultVisualizationForQuestion(nextQuestion));
          setVariableSetRows(defaultVariableSetRows(nextQuestion.id));
          setVariableSetOptionSelection([]);
        }
        return next;
      }

      return [...current, questionId];
    });
  }

  function reorderVariableSetRow(rowId: string, direction: "up" | "down") {
    setVariableSetRows((current) => {
      const rows = current.slice().sort((a, b) => a.rowOrder - b.rowOrder);
      const index = rows.findIndex((row) => row.id === rowId);
      const swapIndex = direction === "up" ? index - 1 : index + 1;
      if (index < 0 || swapIndex < 0 || swapIndex >= rows.length) return current;
      [rows[index], rows[swapIndex]] = [rows[swapIndex], rows[index]];
      return rows.map((row, rowIndex) => ({ ...row, rowOrder: rowIndex + 1 }));
    });
  }

  function updateVariableSetRow(rowId: string, updates: Partial<SavedVariableSet["rows"][number]>) {
    setVariableSetRows((current) =>
      normalizeVariableSetRows(
        current.map((row) => (row.id === rowId ? { ...row, ...updates } : row)),
        question
      )
    );
  }

  function removeVariableSetRow(rowId: string) {
    setVariableSetRows((current) => normalizeVariableSetRows(current.filter((row) => row.id !== rowId), question));
  }

  function toggleVariableSetOptionRow(optionId: string, label: string) {
    setVariableSetRows((current) => {
      const existing = current.find((row) => row.kind === "option" && row.sourceOptionIds[0] === optionId);
      if (existing) {
        return current.filter((row) => row.id !== existing.id).map((row, index) => ({ ...row, rowOrder: index + 1 }));
      }
      return [
        ...current,
        {
          id: optionId,
          label,
          kind: "option",
          sourceOptionIds: [optionId],
          rowOrder: current.length + 1,
          visible: true,
          emphasis: "detail"
        }
      ];
    });
  }

  function toggleVariableSetOptionSelection(optionId: string) {
    setVariableSetOptionSelection((current) => (current.includes(optionId) ? current.filter((item) => item !== optionId) : [...current, optionId]));
  }

  function addVariableSetNet(kind: "net" | "top" | "bottom") {
    const primaryQuestion = defaultDataset.questions.find((item) => item.id === question) ?? defaultQuestion;
    let sourceOptionIds = variableSetOptionSelection;
    let label = "Custom net";

    if (kind === "top") {
      sourceOptionIds = primaryQuestion.options.slice(0, 2).map((option) => option.id);
      label = "Top 2 box";
    } else if (kind === "bottom") {
      sourceOptionIds = primaryQuestion.options.slice(-2).map((option) => option.id);
      label = "Bottom 2 box";
    }

    if (sourceOptionIds.length === 0) {
      setError("Select at least one option before creating a net.");
      return;
    }

    setVariableSetRows((current) => [
      ...current,
        {
          id: `net_${Date.now()}_${current.length + 1}`,
          label,
          kind: kind === "top" ? "topbox" : kind === "bottom" ? "bottombox" : "net",
          sourceOptionIds,
          rowOrder: current.length + 1,
          visible: true,
          emphasis: "summary"
        }
      ]);
    setVariableSetOptionSelection([]);
    setError(null);
  }

  function addRowsForUncoveredOptions() {
    const primaryQuestion = defaultDataset.questions.find((item) => item.id === question) ?? defaultQuestion;
    setVariableSetRows((current) => {
      const visibleSourceOptionIds = new Set(current.filter((row) => row.visible).flatMap((row) => row.sourceOptionIds));
      const uncoveredOptions = primaryQuestion.options.filter((option) => !visibleSourceOptionIds.has(option.id));
      if (uncoveredOptions.length === 0) return current;

      let nextRows = current.slice();
      uncoveredOptions.forEach((option) => {
        const existingRow = nextRows.find((row) => row.kind === "option" && row.sourceOptionIds.includes(option.id));
        if (existingRow) {
          nextRows = nextRows.map((row) => (row.id === existingRow.id ? { ...row, visible: true } : row));
          return;
        }
        nextRows.push({
          id: `option_${option.id}_${Date.now()}_${nextRows.length + 1}`,
          label: option.label,
          kind: "option",
          sourceOptionIds: [option.id],
          rowOrder: nextRows.length + 1,
          visible: true,
          emphasis: "detail"
        });
      });

      return normalizeVariableSetRows(nextRows, question);
    });
    setError(null);
  }

  function resetVariableSetRows() {
    setVariableSetRows(defaultVariableSetRows(question));
    setVariableSetOptionSelection([]);
  }

  function markVariableSetRowsAsDetails() {
    setVariableSetRows((current) => normalizeVariableSetRows(current.map((row) => ({ ...row, emphasis: "detail" })), question));
  }

  function revealAllVariableSetRows() {
    setVariableSetRows((current) => normalizeVariableSetRows(current.map((row) => ({ ...row, visible: true })), question));
  }

  function applySavedBanner(banner: SavedBanner) {
    setBreakBy(banner.breakBy);
    setBannerDraftName(banner.label);
  }

  function saveCurrentBanner() {
    const trimmedLabel = bannerDraftName.trim();
    if (!trimmedLabel) {
      setError("Give the banner a name before saving it.");
      return;
    }

    const nextBanner: SavedBanner = {
      id: `banner_${Date.now()}`,
      datasetId: defaultDataset.id,
      label: trimmedLabel,
      description: `Saved banner for ${bannerDimensions.find((item) => item.id === breakBy)?.label ?? breakBy}`,
      breakBy
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

  function applySavedFilter(filter: SavedFilterSet) {
    setFilterField(filter.filterField);
    setFilterValue(filter.filterValue);
    setFilterDraftName(filter.label);
  }

  function saveCurrentFilter() {
    const trimmedLabel = filterDraftName.trim();
    if (!trimmedLabel) {
      setError("Give the filter a name before saving it.");
      return;
    }

    const nextFilter: SavedFilterSet = {
      id: `filter_${Date.now()}`,
      datasetId: defaultDataset.id,
      label: trimmedLabel,
      description:
        filterField && filterValue !== "all"
          ? `Saved filter for ${filterDimensions.find((item) => item.id === filterField)?.label ?? filterField}`
          : "No segment filter applied.",
      filterField,
      filterValue
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

  function segmentProfileSummary(nextFilterField: FilterFieldId | null, nextFilterValue: string) {
    const field = nextFilterField ? filterDimensions.find((item) => item.id === nextFilterField) : undefined;
    const value = field?.values.find((item) => item.id === nextFilterValue);
    const sourceContext = selectedVariableSet
      ? { kind: "variableSet" as const, id: selectedVariableSet.id, label: selectedVariableSet.label }
      : { kind: "question" as const, id: selectedQuestion.id, label: selectedQuestion.shortLabel };

    return {
      field,
      value,
      sourceContext,
      dimensionLabel: field?.label ?? "All respondents",
      valueLabel: nextFilterField && nextFilterValue !== "all" ? value?.label ?? nextFilterValue : "All respondents"
    };
  }

  function saveCurrentSegmentProfile() {
    const summary = segmentProfileSummary(filterField, filterValue);
    const label = summary.valueLabel === "All respondents" ? "All respondents segment" : summary.valueLabel;
    const nextSegment: SavedSegmentProfile = {
      id: `segment_${Date.now()}`,
      datasetId: defaultDataset.id,
      label,
      description:
        filterField && filterValue !== "all"
          ? `Saved segment for ${summary.dimensionLabel}: ${summary.valueLabel}`
          : "No segment filter applied.",
      filterField,
      filterValue,
      sourceContext: summary.sourceContext,
      summary: {
        dimensionLabel: summary.dimensionLabel,
        valueLabel: summary.valueLabel,
        contextLabel: summary.sourceContext.label
      }
    };

    setDashboard((current) => ({
      ...current,
      status: "draft",
      analysisLibrary: {
        ...current.analysisLibrary,
        segments: [nextSegment, ...current.analysisLibrary.segments]
      }
    }));
    setError(null);
  }

  function applySegmentProfile(segment: SavedSegmentProfile) {
    setFilterField(segment.filterField);
    setFilterValue(segment.filterValue);
    setFilterDraftName(segment.label);
  }

  function deleteSegmentProfile(segmentId: string) {
    setDashboard((current) => ({
      ...current,
      status: "draft",
      analysisLibrary: {
        ...current.analysisLibrary,
        segments: current.analysisLibrary.segments.filter((item) => item.id !== segmentId)
      }
    }));
    setError(null);
  }

  function applySavedWeight(weightProfile: SavedWeightProfile) {
    setWeight(weightProfile.weight);
    setWeightDraftName(weightProfile.label);
  }

  function saveCurrentWeight() {
    const trimmedLabel = weightDraftName.trim();
    if (!trimmedLabel) {
      setError("Give the weight profile a name before saving it.");
      return;
    }

    const nextWeight: SavedWeightProfile = {
      id: `weight_${Date.now()}`,
      datasetId: defaultDataset.id,
      label: trimmedLabel,
      description: weight ? `Uses ${defaultDataset.weights.find((item) => item.id === weight)?.label ?? weight}` : "No weight applied.",
      weight
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

  function saveAnalyticalTemplate(template: SavedAnalyticalTemplate) {
    setDashboard((current) => {
      const existing = current.analysisLibrary.templates.some((item) => item.id === template.id);
      return {
        ...current,
        status: "draft",
        analysisLibrary: {
          ...current.analysisLibrary,
          templates: existing
            ? current.analysisLibrary.templates.map((item) => (item.id === template.id ? template : item))
            : [template, ...current.analysisLibrary.templates]
        }
      };
    });
    setError(null);
  }

  function deleteAnalyticalTemplate(templateId: string) {
    setDashboard((current) => ({
      ...current,
      status: "draft",
      analysisLibrary: {
        ...current.analysisLibrary,
        templates: current.analysisLibrary.templates.filter((item) => item.id !== templateId)
      }
    }));
    setError(null);
  }

  function saveDerivedDefinition(definition: SavedDerivedDefinition) {
    setDashboard((current) => {
      const existing = current.analysisLibrary.derivedDefinitions.some((item) => item.id === definition.id);
      return {
        ...current,
        status: "draft",
        analysisLibrary: {
          ...current.analysisLibrary,
          derivedDefinitions: existing
            ? current.analysisLibrary.derivedDefinitions.map((item) => (item.id === definition.id ? definition : item))
            : [definition, ...current.analysisLibrary.derivedDefinitions]
        }
      };
    });
    setError(null);
  }

  function deleteDerivedDefinition(definitionId: string) {
    setDashboard((current) => ({
      ...current,
      status: "draft",
      analysisLibrary: {
        ...current.analysisLibrary,
        derivedDefinitions: current.analysisLibrary.derivedDefinitions.filter((item) => item.id !== definitionId)
      }
    }));
    setError(null);
  }

  return {
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
    savedSegmentProfiles,
    savedWeights,
    savedAnalyticalTemplates,
    savedDerivedDefinitions,
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
    saveCurrentSegmentProfile,
    applySegmentProfile,
    deleteSegmentProfile,
    applySavedWeight,
    saveCurrentWeight,
    saveAnalyticalTemplate,
    deleteAnalyticalTemplate,
    saveDerivedDefinition,
    deleteDerivedDefinition
  };
}
