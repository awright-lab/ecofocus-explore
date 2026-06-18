import {
  defaultAppearance,
  defaultBreakBy,
  defaultDataset,
  defaultFilterDimension,
  defaultQuestion,
  fontFamilies
} from "../builder/builderConstants";
import {
  defaultElementStyle,
  defaultPageDesign,
  defaultVariableSetRows,
  normalizeVariableSetRows,
  seedDesignLibrary,
  seedSavedBanners,
  seedSavedFilters,
  seedSavedWeights,
  seedVariableSets
} from "./documentSeeds";
import { defaultVisualizationForQuestion, getCompatibleChartTypes, getQuestionLabel } from "../analytics/analyticsDisplay";
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
      weights:
        dashboard.analysisLibrary?.weights?.map((weightProfile, index) => ({
          ...weightProfile,
          id: weightProfile.id ?? `weight_${index + 1}`,
          datasetId: weightProfile.datasetId ?? defaultDataset.id,
          label: weightProfile.label ?? `Weight ${index + 1}`,
          description: weightProfile.description ?? "",
          weight: weightProfile.weight ?? null
        })) ?? seedSavedWeights()
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
          description: pageMaster.description ?? ""
        })) ?? seededDesignLibrary.pageMasters,
      pageThemes:
        dashboard.designLibrary?.pageThemes?.map((pageTheme, index) => ({
          ...pageTheme,
          id: pageTheme.id ?? `page_theme_${index + 1}`,
          label: pageTheme.label ?? `Page theme ${index + 1}`,
          description: pageTheme.description ?? "",
          backgroundMode: pageTheme.backgroundMode ?? "solid",
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
          query: { ...tile.query, chartType: visualization, confidenceLevel: tile.query.confidenceLevel ?? tile.result.query.confidenceLevel ?? 0.95 },
          result: {
            ...tile.result,
            query: { ...tile.result.query, confidenceLevel: tile.result.query.confidenceLevel ?? tile.query.confidenceLevel ?? 0.95 },
            annotations: tile.result.annotations.map((annotation) => ({ ...annotation, confidence: annotation.confidence ?? tile.result.query.confidenceLevel ?? tile.query.confidenceLevel ?? 0.95 })),
            statistics: tile.result.statistics ?? {
              confidenceLevel: tile.result.query.confidenceLevel ?? tile.query.confidenceLevel ?? 0.95,
              significanceMethod: tile.result.annotations.length > 0 ? "mock_placeholder" : "none"
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
