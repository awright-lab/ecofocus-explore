import {
  bannerDimensions,
  defaultAppearance,
  defaultBreakBy,
  defaultDataset,
  defaultFilterDimension,
  defaultQuestion,
  filterDimensions,
  fontFamilies
} from "../builder/builderConstants";
import {
  defaultElementStyle,
  defaultPageDesign,
  defaultVariableSetRows,
  normalizeVariableSetRows,
  seedAnalyticalTemplates,
  seedDesignLibrary,
  seedSavedBanners,
  seedSavedFilters,
  seedSavedWeights,
  seedVariableSets
} from "./documentSeeds";
import { defaultVisualizationForQuestion, getCompatibleChartTypes, getQuestionLabel } from "../analytics/analyticsDisplay";
import { buildSignificanceExecutionPlan, buildSignificanceReadiness } from "../../../shared/analytics/queryPlan";
import type { BreakById } from "../../../shared/types/analytics";
import type { DashboardDraft, DashboardPage, PageThemePreset, TileAppearance } from "../../../shared/types/dashboard";

export function makeTileId() {
  return `tile_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function makeElementId() {
  return `element_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function makePageId() {
  return `page_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function nextZIndex(page: DashboardPage) {
  const tileZ = page.tiles.map((tile) => tile.layout.zIndex);
  const elementZ = page.elements.map((element) => element.layout.zIndex);
  return Math.max(0, ...tileZ, ...elementZ) + 1;
}

export function clampZIndex(value: number) {
  return Math.max(1, value);
}

function matchingPageTheme(page: DashboardPage, pageThemes: PageThemePreset[]) {
  return pageThemes.find((theme) =>
    theme.backgroundMode === (page.backgroundMode ?? "solid")
    && theme.backgroundPattern === (page.backgroundPattern ?? "none")
    && theme.background === page.background
    && theme.backgroundImage === (page.backgroundImage ?? "")
    && theme.backgroundImageFit === (page.backgroundImageFit ?? "cover")
    && theme.gradientFrom === page.gradientFrom
    && theme.gradientTo === page.gradientTo
    && theme.gradientType === (page.gradientType ?? "linear")
  );
}

function normalizePageProvenance(page: DashboardPage, pageThemes: PageThemePreset[]) {
  const matchedTheme = page.provenance?.themeId
    ? pageThemes.find((theme) => theme.id === page.provenance?.themeId)
    : matchingPageTheme(page, pageThemes);
  const masterStatus = page.provenance?.masterStatus ?? (page.provenance?.masterId ? "master-based" : "none");

  return {
    templateId: page.provenance?.templateId,
    templateLabel: page.provenance?.templateLabel,
    themeId: page.provenance?.themeId ?? matchedTheme?.id,
    themeLabel: page.provenance?.themeLabel ?? matchedTheme?.label,
    masterId: page.provenance?.masterId,
    masterLabel: page.provenance?.masterLabel,
    masterStatus,
    status: page.provenance?.status ?? "custom"
  };
}

function normalizeTemplateQuery(query: Partial<DashboardDraft["analysisLibrary"]["templates"][number]["query"]> | undefined) {
  const question = defaultDataset.questions.find((item) => item.id === query?.question) ?? defaultQuestion;
  const comparisonMode = query?.comparisonMode ?? "none";
  const chartType = query?.chartType && question.allowedChartTypes.includes(query.chartType)
    ? query.chartType
    : defaultVisualizationForQuestion(question);

  return {
    dataset: query?.dataset ?? defaultDataset.id,
    question: question.id,
    breakBy:
      comparisonMode === "wave"
        ? "SUMMARY"
        : query?.breakBy && question.allowedBreakBys.includes(query.breakBy)
          ? query.breakBy
          : question.allowedBreakBys[0],
    filters: query?.filters ?? [],
    weight: query?.weight ?? defaultDataset.defaultWeight,
    metric: query?.metric && question.allowedMetrics.includes(query.metric) ? query.metric : question.defaultMetric,
    chartType,
    confidenceLevel: query?.confidenceLevel ?? 0.95,
    comparisonMode,
    comparisonDatasets: query?.comparisonDatasets ?? []
  };
}

function normalizeTemplateSummary(
  template: DashboardDraft["analysisLibrary"]["templates"][number],
  query: ReturnType<typeof normalizeTemplateQuery>
) {
  const filter = query.filters[0];
  const filterField = filter ? filterDimensions.find((item) => item.id === filter.field) : undefined;
  const filterValue = filterField && filter ? filterField.values.find((item) => item.id === filter.values[0]) : undefined;
  return {
    sourceLabel: template.summary?.sourceLabel ?? template.source?.label ?? getQuestionLabel(query.question),
    bannerLabel: template.summary?.bannerLabel ?? bannerDimensions.find((item) => item.id === query.breakBy)?.label ?? query.breakBy,
    filterLabel:
      template.summary?.filterLabel ??
      (filter && filter.values[0] !== "all"
        ? `${filterField?.label ?? filter.field}: ${filterValue?.label ?? filter.values[0]}`
        : "No filter"),
    weightLabel:
      template.summary?.weightLabel ??
      (query.weight ? defaultDataset.weights.find((item) => item.id === query.weight)?.label ?? query.weight : "Unweighted"),
    confidenceLabel: template.summary?.confidenceLabel ?? `${Math.round((query.confidenceLevel ?? 0.95) * 100)}% confidence`,
    comparisonLabel:
      template.summary?.comparisonLabel ??
      (query.comparisonMode === "wave" && query.comparisonDatasets.length
        ? `Wave comparison: ${query.comparisonDatasets.length} wave${query.comparisonDatasets.length === 1 ? "" : "s"}`
        : "No wave comparison")
  };
}

function derivedOutputLabel(kind: DashboardDraft["analysisLibrary"]["derivedDefinitions"][number]["outputKind"]) {
  if (kind === "top_n_extract") return "Top-N extract";
  if (kind === "bottom_n_extract") return "Bottom-N extract";
  return "Lead-row summary";
}

function normalizeDerivedDefinitionSummary(
  definition: DashboardDraft["analysisLibrary"]["derivedDefinitions"][number],
  query: ReturnType<typeof normalizeTemplateQuery>
) {
  const outputLabel = derivedOutputLabel(definition.outputKind ?? "lead_row_summary");
  const sourceLabel = definition.summary?.sourceLabel ?? definition.source?.label ?? getQuestionLabel(query.question);
  const structureLabel =
    definition.summary?.structureLabel ??
    (definition.outputKind === "top_n_extract" || definition.outputKind === "bottom_n_extract"
      ? `${definition.spec?.rowCount ?? 0} rows from ${definition.spec?.columnLabel ?? "selected column"}`
      : `${definition.spec?.rowLabel ?? "Lead row"} from ${definition.spec?.columnLabel ?? "selected column"}`);

  return {
    outputLabel: definition.summary?.outputLabel ?? outputLabel,
    sourceLabel,
    structureLabel,
    queryLabel: definition.summary?.queryLabel ?? `${sourceLabel} · ${outputLabel}`
  };
}

export function normalizeDashboard(dashboard: DashboardDraft): DashboardDraft {
  const seededDesignLibrary = seedDesignLibrary();
  return {
    ...dashboard,
    publishMetadata: {
      publishedAt: dashboard.publishMetadata?.publishedAt,
      publishCount: dashboard.publishMetadata?.publishCount ?? (dashboard.status === "published" ? 1 : 0),
      versionLabel: dashboard.publishMetadata?.versionLabel ?? (dashboard.status === "published" ? "v1" : "Draft")
    },
    analysisLibrary: {
      variableSets:
        dashboard.analysisLibrary?.variableSets?.map((variableSet, index) => ({
          ...variableSet,
          id: variableSet.id ?? `variable_set_${index + 1}`,
          datasetId: variableSet.datasetId ?? defaultDataset.id,
          description: variableSet.description ?? "",
          topic: variableSet.topic ?? getQuestionLabel(variableSet.primaryQuestionId ?? variableSet.questionIds?.[0] ?? defaultQuestion.id),
          questionIds: variableSet.questionIds?.length ? variableSet.questionIds : [variableSet.primaryQuestionId ?? defaultQuestion.id],
          primaryQuestionId: variableSet.primaryQuestionId ?? variableSet.questionIds?.[0] ?? defaultQuestion.id,
          rowMode: variableSet.rowMode ?? "authored",
          rows: normalizeVariableSetRows(
            (variableSet.rows ?? []).map((row, rowIndex) => ({
              id: row.id ?? `row_${index + 1}_${rowIndex + 1}`,
              label: row.label ?? row.id ?? `Row ${rowIndex + 1}`,
              kind: row.kind ?? "option",
              sourceOptionIds: row.sourceOptionIds?.length ? row.sourceOptionIds : [row.id],
              rowOrder: row.rowOrder ?? rowIndex + 1,
              visible: row.visible ?? true,
              emphasis: row.emphasis ?? (row.kind === "option" ? "detail" : "summary")
            })),
            variableSet.primaryQuestionId ?? variableSet.questionIds?.[0] ?? defaultQuestion.id
          ),
          breakBy: variableSet.breakBy ?? (defaultBreakBy.id as BreakById),
          metric: variableSet.metric ?? defaultQuestion.defaultMetric,
          chartType: variableSet.chartType ?? defaultVisualizationForQuestion(defaultQuestion),
          comparisonMode: variableSet.comparisonMode ?? "none",
          comparisonDatasets: variableSet.comparisonDatasets ?? [],
          weight: variableSet.weight ?? defaultDataset.defaultWeight,
          filterField: variableSet.filterField ?? (defaultFilterDimension?.id ?? null),
          filterValue: variableSet.filterValue ?? "all"
        })) ?? seedVariableSets(),
      banners:
        dashboard.analysisLibrary?.banners?.map((banner, index) => ({
          ...banner,
          id: banner.id ?? `banner_${index + 1}`,
          datasetId: banner.datasetId ?? defaultDataset.id,
          label: banner.label ?? `Banner ${index + 1}`,
          description: banner.description ?? "",
          breakBy: banner.breakBy ?? (defaultBreakBy.id as BreakById)
        })) ?? seedSavedBanners(),
      filters:
        dashboard.analysisLibrary?.filters?.map((filter, index) => ({
          ...filter,
          id: filter.id ?? `filter_${index + 1}`,
          datasetId: filter.datasetId ?? defaultDataset.id,
          label: filter.label ?? `Filter ${index + 1}`,
          description: filter.description ?? "",
          filterField: filter.filterField ?? (defaultFilterDimension?.id ?? null),
          filterValue: filter.filterValue ?? "all"
        })) ?? seedSavedFilters(),
      segments:
        dashboard.analysisLibrary?.segments?.map((segment, index) => {
          const field = segment.filterField ? filterDimensions.find((item) => item.id === segment.filterField) : undefined;
          const value = field?.values.find((item) => item.id === segment.filterValue);
          return {
            ...segment,
            id: segment.id ?? `segment_${index + 1}`,
            datasetId: segment.datasetId ?? defaultDataset.id,
            label: segment.label ?? value?.label ?? field?.label ?? `Segment ${index + 1}`,
            description: segment.description ?? "",
            filterField: segment.filterField ?? null,
            filterValue: segment.filterValue ?? "all",
            summary: {
              dimensionLabel: segment.summary?.dimensionLabel ?? field?.label ?? "All respondents",
              valueLabel: segment.summary?.valueLabel ?? value?.label ?? (segment.filterValue === "all" ? "All" : segment.filterValue ?? "All"),
              contextLabel: segment.summary?.contextLabel ?? segment.sourceContext?.label ?? "Any source"
            }
          };
        }) ?? [],
      weights:
        dashboard.analysisLibrary?.weights?.map((weightProfile, index) => ({
          ...weightProfile,
          id: weightProfile.id ?? `weight_${index + 1}`,
          datasetId: weightProfile.datasetId ?? defaultDataset.id,
          label: weightProfile.label ?? `Weight ${index + 1}`,
          description: weightProfile.description ?? "",
          weight: weightProfile.weight ?? null
        })) ?? seedSavedWeights(),
      templates:
        dashboard.analysisLibrary?.templates?.map((template, index) => {
          const query = normalizeTemplateQuery(template.query);
          const source = template.source ?? {
            kind: "question" as const,
            id: query.question,
            label: getQuestionLabel(query.question)
          };
          return {
            ...template,
            id: template.id ?? `analysis_template_${index + 1}`,
            datasetId: template.datasetId ?? query.dataset,
            label: template.label ?? `Analytical template ${index + 1}`,
            description: template.description ?? "",
            source,
            query,
            visualization: template.visualization ?? query.chartType,
            summary: normalizeTemplateSummary(template, query)
          };
        }) ?? seedAnalyticalTemplates(),
      derivedDefinitions:
        dashboard.analysisLibrary?.derivedDefinitions?.map((definition, index) => {
          const query = normalizeTemplateQuery(definition.query);
          const source = definition.source ?? {
            kind: "question" as const,
            id: query.question,
            label: getQuestionLabel(query.question)
          };
          const outputKind = definition.outputKind ?? "lead_row_summary";
          return {
            ...definition,
            id: definition.id ?? `derived_definition_${index + 1}`,
            datasetId: definition.datasetId ?? query.dataset,
            label: definition.label ?? `Derived definition ${index + 1}`,
            description: definition.description ?? "",
            source,
            sourceTileId: definition.sourceTileId ?? "",
            sourceTileTitle: definition.sourceTileTitle ?? source.label,
            query,
            outputKind,
            spec: {
              columnId: definition.spec?.columnId ?? query.breakBy,
              columnLabel: definition.spec?.columnLabel ?? definition.summary?.structureLabel ?? "Selected column",
              rowId: definition.spec?.rowId,
              rowLabel: definition.spec?.rowLabel,
              rowCount: definition.spec?.rowCount
            },
            summary: normalizeDerivedDefinitionSummary({ ...definition, outputKind }, query)
          };
        }) ?? []
    },
    designLibrary: {
      palettes:
        dashboard.designLibrary?.palettes?.map((palette, index) => ({
          ...palette,
          id: palette.id ?? `palette_${index + 1}`,
          label: palette.label ?? `Palette ${index + 1}`,
          description: palette.description ?? "",
          colors: palette.colors?.length ? palette.colors : seededDesignLibrary.palettes[index % seededDesignLibrary.palettes.length].colors
        })) ?? seededDesignLibrary.palettes,
      textStyles:
        dashboard.designLibrary?.textStyles?.map((textStyle, index) => ({
          ...textStyle,
          id: textStyle.id ?? `text_style_${index + 1}`,
          label: textStyle.label ?? `Text style ${index + 1}`,
          description: textStyle.description ?? "",
          fontFamily: textStyle.fontFamily ?? fontFamilies[0].value,
          fontSize: textStyle.fontSize ?? 16,
          fontWeight: textStyle.fontWeight ?? "500",
          lineHeight: textStyle.lineHeight ?? 1.4,
          textAlign: textStyle.textAlign ?? "left",
          textColor: textStyle.textColor ?? "#33473d"
        })) ?? seededDesignLibrary.textStyles,
      textBlocks:
        dashboard.designLibrary?.textBlocks?.map((textBlock, index) => ({
          ...textBlock,
          id: textBlock.id ?? `text_block_${index + 1}`,
          label: textBlock.label ?? `Text block ${index + 1}`,
          description: textBlock.description ?? "",
          content: textBlock.content ?? "Text block",
          width: textBlock.width ?? 320,
          height: textBlock.height ?? 120,
          style: {
            ...defaultElementStyle("text"),
            ...textBlock.style,
            gradientType: textBlock.style?.gradientType ?? "linear",
            gradientStops: textBlock.style?.gradientStops ?? []
          }
        })) ?? seededDesignLibrary.textBlocks,
      compositionStarters:
        dashboard.designLibrary?.compositionStarters?.map((block, index) => ({
          ...block,
          id: block.id ?? `composition_starter_${index + 1}`,
          label: block.label ?? `Composition starter ${index + 1}`,
          description: block.description ?? "",
          category: block.category ?? "custom",
          createdAt: block.createdAt ?? 0,
          updatedAt: block.updatedAt,
          lastUsedAt: block.lastUsedAt,
          summary: {
            objectCount: block.summary?.objectCount ?? block.items?.length ?? 0,
            tileCount: block.summary?.tileCount ?? block.items?.filter((item) => item.kind === "tile").length ?? 0,
            elementCount: block.summary?.elementCount ?? block.items?.filter((item) => item.kind === "element").length ?? 0,
            width: block.summary?.width ?? 0,
            height: block.summary?.height ?? 0
          },
          items: block.items ?? []
        })) ?? seededDesignLibrary.compositionStarters,
      compositionBlocks:
        dashboard.designLibrary?.compositionBlocks?.map((block, index) => ({
          ...block,
          id: block.id ?? `composition_block_${index + 1}`,
          label: block.label ?? `Composition block ${index + 1}`,
          description: block.description ?? "",
          category: block.category ?? "custom",
          createdAt: block.createdAt ?? Date.now(),
          updatedAt: block.updatedAt,
          lastUsedAt: block.lastUsedAt,
          summary: {
            objectCount: block.summary?.objectCount ?? block.items?.length ?? 0,
            tileCount: block.summary?.tileCount ?? block.items?.filter((item) => item.kind === "tile").length ?? 0,
            elementCount: block.summary?.elementCount ?? block.items?.filter((item) => item.kind === "element").length ?? 0,
            width: block.summary?.width ?? 0,
            height: block.summary?.height ?? 0
          },
          items: block.items ?? []
        })) ?? seededDesignLibrary.compositionBlocks,
      assets:
        dashboard.designLibrary?.assets?.map((asset, index) => ({
          ...asset,
          id: asset.id ?? `design_asset_${index + 1}`,
          label: asset.label ?? `Asset ${index + 1}`,
          description: asset.description ?? "",
          kind: asset.kind ?? "image",
          category: asset.category ?? "Image",
          url: asset.url ?? ""
        })) ?? seededDesignLibrary.assets,
      pageTemplates:
        dashboard.designLibrary?.pageTemplates?.map((pageTemplate, index) => ({
          ...pageTemplate,
          id: pageTemplate.id ?? `page_template_${index + 1}`,
          label: pageTemplate.label ?? `Page template ${index + 1}`,
          description: pageTemplate.description ?? "",
          pageThemeId: pageTemplate.pageThemeId ?? seededDesignLibrary.pageThemes[0].id,
          pageMasterId: pageTemplate.pageMasterId,
          elements: (pageTemplate.elements ?? []).map((element) => ({
            ...element,
            name: element.name ?? "Text block",
            content: element.content ?? "Text block",
            layout: {
              x: element.layout?.x ?? 84,
              y: element.layout?.y ?? 84,
              width: element.layout?.width ?? 360,
              height: element.layout?.height ?? 120
            },
            style: {
              ...defaultElementStyle("text"),
              ...element.style,
              gradientType: element.style?.gradientType ?? "linear",
              gradientStops: element.style?.gradientStops ?? []
            }
          }))
        })) ?? seededDesignLibrary.pageTemplates,
      pageMasters:
        dashboard.designLibrary?.pageMasters?.map((pageMaster, index) => ({
          ...pageMaster,
          id: pageMaster.id ?? `page_master_${index + 1}`,
          label: pageMaster.label ?? `Page master ${index + 1}`,
          description: pageMaster.description ?? "",
          elements: (pageMaster.elements ?? []).map((element) => ({
            ...element,
            name: element.name ?? "Master element",
            content: element.content ?? "",
            layout: {
              x: element.layout?.x ?? 72,
              y: element.layout?.y ?? 72,
              width: element.layout?.width ?? 360,
              height: element.layout?.height ?? 80
            },
            style: {
              ...defaultElementStyle("text"),
              ...element.style,
              gradientType: element.style?.gradientType ?? "linear",
              gradientStops: element.style?.gradientStops ?? []
            }
          }))
        })) ?? seededDesignLibrary.pageMasters,
      pageThemes:
        dashboard.designLibrary?.pageThemes?.map((pageTheme, index) => ({
          ...pageTheme,
          id: pageTheme.id ?? `page_theme_${index + 1}`,
          label: pageTheme.label ?? `Page theme ${index + 1}`,
          description: pageTheme.description ?? "",
          backgroundMode: pageTheme.backgroundMode ?? "solid",
          backgroundPattern: pageTheme.backgroundPattern ?? "none",
          background: pageTheme.background ?? "#ffffff",
          backgroundImage: pageTheme.backgroundImage ?? "",
          backgroundImageFit: pageTheme.backgroundImageFit ?? "cover",
          gradientFrom: pageTheme.gradientFrom ?? "#ffffff",
          gradientTo: pageTheme.gradientTo ?? "#eef7ef",
          gradientType: pageTheme.gradientType ?? "linear",
          gradientAngle: pageTheme.gradientAngle ?? 135,
          gradientStops: pageTheme.gradientStops ?? [],
          showCanvasGrid: pageTheme.showCanvasGrid ?? true
        })) ?? seededDesignLibrary.pageThemes
    },
    pages: dashboard.pages.map((page) => ({
          ...page,
          ...defaultPageDesign(),
          ...page,
          provenance: normalizePageProvenance(page, seededDesignLibrary.pageThemes),
          backgroundMode: page.backgroundMode ?? "solid",
          backgroundPattern: page.backgroundPattern ?? "none",
          backgroundImage: page.backgroundImage ?? "",
          backgroundImageFit: page.backgroundImageFit ?? "cover",
          gradientType: page.gradientType ?? "linear",
          gradientAngle: page.gradientAngle ?? 135,
          gradientStops: page.gradientStops ?? [],
          elements: page.elements.map((element) => ({
        ...element,
        name: element.name ?? (element.type === "text" ? "Text" : element.type === "image" ? "Image" : element.type === "circle" ? "Circle" : "Rectangle"),
        locked: element.locked ?? false,
        hidden: element.hidden ?? false,
          style: {
            ...defaultElementStyle(element.type),
          ...element.style,
          gradientType: element.style?.gradientType ?? "linear",
          gradientStops: element.style?.gradientStops ?? []
          }
      })),
      tiles: page.tiles.map((tile) => {
        const compatibleChartTypes = getCompatibleChartTypes(tile.result);
        const visualization = tile.visualization === "table" ? compatibleChartTypes[0] ?? "vertical_bar" : tile.visualization;
        const legacyAxisColor = (tile.appearance as (Partial<TileAppearance> & { axisColor?: string }) | undefined)?.axisColor;
        const normalizedQuery = { ...tile.query, chartType: visualization, confidenceLevel: tile.query.confidenceLevel ?? tile.result.query.confidenceLevel ?? 0.95 };
        const normalizedResultQuery = { ...tile.result.query, confidenceLevel: tile.result.query.confidenceLevel ?? tile.query.confidenceLevel ?? 0.95 };
        const significanceReadiness = tile.result.statistics?.significance?.readiness ?? buildSignificanceReadiness(normalizedResultQuery);
        const significanceExecutionPlan = tile.result.statistics?.significanceExecutionPlan ?? buildSignificanceExecutionPlan(significanceReadiness);
        return {
          ...tile,
          name: tile.name ?? tile.title,
          locked: tile.locked ?? false,
          hidden: tile.hidden ?? false,
          analysisLifecycle: tile.analysisLifecycle ?? {
            role: "canonical",
            canonicalTileId: tile.id,
            canonicalLabel: tile.title ?? tile.name ?? "Analysis object"
          },
          query: normalizedQuery,
          result: {
            ...tile.result,
            query: normalizedResultQuery,
            annotations: tile.result.annotations.map((annotation) => ({ ...annotation, confidence: annotation.confidence ?? tile.result.query.confidenceLevel ?? tile.query.confidenceLevel ?? 0.95 })),
            statistics: {
              ...tile.result.statistics,
              confidenceLevel: tile.result.statistics?.confidenceLevel ?? tile.result.query.confidenceLevel ?? tile.query.confidenceLevel ?? 0.95,
              significanceMethod: tile.result.statistics?.significanceMethod ?? (tile.result.annotations.length > 0 ? "mock_placeholder" : "none"),
              significanceExecutionPlan,
              significanceExecutionInput: tile.result.statistics?.significanceExecutionInput ?? null,
              significanceExecutionReport: tile.result.statistics?.significanceExecutionReport ?? null,
              significance: tile.result.statistics?.significance ?? {
                status: tile.result.annotations.length > 0 ? "placeholder" : "none",
                method: tile.result.annotations.length > 0 ? "mock_placeholder" : "none",
                readiness: significanceReadiness,
                reasonCodes: tile.result.annotations.length > 0 ? ["mock_provider_placeholder"] : ["mock_provider_not_available"],
                comparisonBasis: (tile.result.query.comparisonMode ?? tile.query.comparisonMode) === "wave" ? "wave" : tile.result.columns.length > 1 ? "breakout" : "summary",
                hasPlaceholders: tile.result.annotations.length > 0,
                details: tile.result.annotations.map((annotation) => ({
                  rowId: annotation.rowId,
                  columnId: annotation.columnId,
                  direction: annotation.direction,
                  confidence: annotation.confidence ?? tile.result.query.confidenceLevel ?? tile.query.confidenceLevel ?? 0.95,
                  status: "placeholder",
                  reasonCodes: ["mock_provider_placeholder"]
                }))
              }
            }
          },
          visualization,
          appearance: {
            ...defaultAppearance,
            ...tile.appearance,
            showTable: false,
            xAxisTextColor: tile.appearance?.xAxisTextColor ?? legacyAxisColor ?? defaultAppearance.xAxisTextColor,
            yAxisTextColor: tile.appearance?.yAxisTextColor ?? legacyAxisColor ?? defaultAppearance.yAxisTextColor,
            palette: tile.appearance?.palette ?? [...defaultAppearance.palette],
            gradientType: tile.appearance?.gradientType ?? "linear",
            gradientStops: tile.appearance?.gradientStops ?? [],
            barGradientType: tile.appearance?.barGradientType ?? "linear",
            barGradientAngle: tile.appearance?.barGradientAngle ?? 90,
            barGradientStops: tile.appearance?.barGradientStops ?? [],
            barStyles: tile.appearance?.barStyles ?? {},
            axisLabelOverrides: tile.appearance?.axisLabelOverrides ?? {},
            chartBackground: tile.appearance?.chartBackground ?? defaultAppearance.chartBackground
          }
        };
      })
    }))
  };
}
