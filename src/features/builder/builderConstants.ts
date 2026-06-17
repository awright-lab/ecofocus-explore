import { datasets, getBannerDimensions, getComparisonDatasetOptions, getFilterDimensions } from "../../lib/metadata";
import type { ChartType } from "../../../shared/types/analytics";
import type { TileAppearance } from "../../../shared/types/dashboard";

export const defaultDataset = datasets[0];
export { datasets };
export const defaultQuestion = defaultDataset.questions.find((question) => question.id === defaultDataset.defaultQuestion) ?? defaultDataset.questions[0];
export const bannerDimensions = getBannerDimensions(defaultDataset.id);
export const filterDimensions = getFilterDimensions(defaultDataset.id);
export const comparisonDatasetOptions = getComparisonDatasetOptions(defaultDataset.id);
export const defaultBreakBy = bannerDimensions.find((dimension) => dimension.id === defaultDataset.defaultBreakBy) ?? bannerDimensions[0];
export const defaultFilterDimension = filterDimensions[0];

export const axisFontSizePresets = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24];
export const axisRotationPresets = [0, -45, 45, -90, 90];
export const waveComparisonChartTypes: ChartType[] = ["line_chart", "grouped_bar", "stacked_bar", "table"];

export const palettes = [
  { id: "forest", label: "Forest", colors: ["#39784d", "#6c9b4d", "#2d6f73", "#9a7a38", "#6f6697"] },
  { id: "ocean", label: "Ocean", colors: ["#1f6f8b", "#3b8ea5", "#5b7f95", "#74a7a0", "#4b6580"] },
  { id: "slate", label: "Slate", colors: ["#3d4a57", "#657483", "#8a775d", "#5d7a67", "#7a657c"] }
];

export const effectPresets = {
  soft: { label: "Soft", shadowBlur: 24, shadowOffsetX: 0, shadowOffsetY: 12, shadowOpacity: 20 },
  lifted: { label: "Lifted", shadowBlur: 36, shadowOffsetX: 0, shadowOffsetY: 18, shadowOpacity: 24 },
  dramatic: { label: "Dramatic", shadowBlur: 52, shadowOffsetX: 0, shadowOffsetY: 28, shadowOpacity: 34 },
  glow: { label: "Glow", shadowBlur: 28, shadowOffsetX: 0, shadowOffsetY: 0, shadowOpacity: 28 }
} as const;

export type EffectPreset = keyof typeof effectPresets;

export function effectPresetValues(preset: EffectPreset) {
  const { shadowBlur, shadowOffsetX, shadowOffsetY, shadowOpacity } = effectPresets[preset];
  return { shadowBlur, shadowOffsetX, shadowOffsetY, shadowOpacity };
}

export const defaultAppearance: TileAppearance = {
  primaryColor: palettes[0].colors[0],
  palette: palettes[0].colors,
  background: "#ffffff",
  backgroundMode: "solid",
  gradientFrom: "#ffffff",
  gradientTo: "#eef7ef",
  gradientType: "linear",
  gradientStops: [],
  borderColor: "#dfe6dc",
  borderRadius: 8,
  opacity: 100,
  shadow: false,
  shadowPreset: "soft",
  shadowColor: "#142019",
  shadowOpacity: 20,
  shadowBlur: 24,
  shadowOffsetX: 0,
  shadowOffsetY: 12,
  glow: false,
  glowColor: "#16c9c3",
  glowSize: 24,
  showGrid: true,
  chartBackground: "#fbfcfad1",
  gridColor: "#e6ebe4",
  xAxisTextColor: "#69776e",
  yAxisTextColor: "#69776e",
  axisFontSize: 12,
  axisLabelPlacement: "outside",
  axisLabelAlign: "middle",
  axisLabelDx: 0,
  axisLabelDy: 12,
  axisLabelRotation: 0,
  axisLabelWrap: true,
  axisLabelWidth: 16,
  axisLabelMaxLines: 3,
  axisHeight: 112,
  axisLabelOverrides: {},
  labelColor: "#3f4f45",
  labelFontSize: 12,
  labelPosition: "top",
  labelOffset: 8,
  barRadius: 2,
  barGap: 8,
  barCategoryGap: 24,
  barSize: 88,
  barFillMode: "solid",
  barGradientTo: "#9fc9a7",
  barGradientType: "linear",
  barGradientAngle: 90,
  barGradientStops: [],
  barStyles: {},
  showValueLabels: true,
  showTable: false,
  showBases: true,
  showNotes: true,
  showAnnotations: true
};

export const storageKey = "ecofocus_explore_dashboard_v1";
export const historyLimit = 40;
export const defaultGridSize = 40;
export const canvasWidth = 1280;
export const canvasHeight = 760;

export const fontFamilies = [
  { label: "Inter", value: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif" },
  { label: "System", value: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times", value: "\"Times New Roman\", Times, serif" },
  { label: "Courier", value: "\"Courier New\", Courier, monospace" }
];
