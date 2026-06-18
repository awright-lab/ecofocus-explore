import { canvasHeight, canvasWidth } from "./builderConstants";
import {
  comparisonSummaryLabel,
  confidenceLevelLabel,
  pageSummary,
  resultConfidenceLevel,
  sampleSizeLabel,
  slugifyFileName,
  tilePresentationNotes,
  trendSpanLabel
} from "./components/CanvasRenderers";
import { getQuestionLabel } from "../analytics/analyticsDisplay";
import type { DashboardDraft, DashboardPage } from "../../../shared/types/dashboard";

export function buildDashboardExportSpec(dashboard: DashboardDraft, sortedPages: DashboardPage[]) {
  return {
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
}

export function downloadDashboardExportSpec(dashboard: DashboardDraft, sortedPages: DashboardPage[]) {
  const exportSpec = buildDashboardExportSpec(dashboard, sortedPages);
  const blob = new Blob([JSON.stringify(exportSpec, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slugifyFileName(dashboard.title)}-presentation-package.json`;
  link.click();
  URL.revokeObjectURL(url);
}
