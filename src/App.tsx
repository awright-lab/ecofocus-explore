import { useEffect, useMemo, useRef, useState } from "react";
import { Rnd } from "react-rnd";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { runAnalyticsQuery } from "./lib/api";
import { datasets, getBannerDimensions, getFilterDimensions } from "./lib/metadata";
import type {
  AnalyticsAnnotation,
  AnalyticsQueryRequest,
  AnalyticsQueryResponse,
  BreakById,
  ChartType,
  FilterFieldId,
  Metric,
  QuestionId,
  WeightId
} from "../shared/types/analytics";
import type { CanvasLayout, DashboardCanvasElement, DashboardCanvasElementType, DashboardDraft, DashboardPage, DashboardTile, GradientStop, GradientType, SavedVariableSet, TileAppearance } from "../shared/types/dashboard";

const defaultDataset = datasets[0];
const defaultQuestion = defaultDataset.questions.find((question) => question.id === defaultDataset.defaultQuestion) ?? defaultDataset.questions[0];
const bannerDimensions = getBannerDimensions(defaultDataset.id);
const filterDimensions = getFilterDimensions(defaultDataset.id);
const defaultBreakBy = bannerDimensions.find((dimension) => dimension.id === defaultDataset.defaultBreakBy) ?? bannerDimensions[0];
const defaultFilterDimension = filterDimensions[0];
const axisFontSizePresets = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24];
const axisRotationPresets = [0, -45, 45, -90, 90];

const palettes = [
  { id: "forest", label: "Forest", colors: ["#39784d", "#6c9b4d", "#2d6f73", "#9a7a38", "#6f6697"] },
  { id: "ocean", label: "Ocean", colors: ["#1f6f8b", "#3b8ea5", "#5b7f95", "#74a7a0", "#4b6580"] },
  { id: "slate", label: "Slate", colors: ["#3d4a57", "#657483", "#8a775d", "#5d7a67", "#7a657c"] }
];

const effectPresets = {
  soft: { label: "Soft", shadowBlur: 24, shadowOffsetX: 0, shadowOffsetY: 12, shadowOpacity: 20 },
  lifted: { label: "Lifted", shadowBlur: 36, shadowOffsetX: 0, shadowOffsetY: 18, shadowOpacity: 24 },
  dramatic: { label: "Dramatic", shadowBlur: 52, shadowOffsetX: 0, shadowOffsetY: 28, shadowOpacity: 34 },
  glow: { label: "Glow", shadowBlur: 28, shadowOffsetX: 0, shadowOffsetY: 0, shadowOpacity: 28 }
} as const;

type EffectPreset = keyof typeof effectPresets;
type DesignModal = "pageBackground" | "pageGradient" | "elementGradient" | "tileGradient" | "barGradient" | "barColor" | "chartColors" | "labelSettings" | "barLayout" | "axisSettings" | "elementEffects" | "tileEffects" | null;

function effectPresetValues(preset: EffectPreset) {
  const { shadowBlur, shadowOffsetX, shadowOffsetY, shadowOpacity } = effectPresets[preset];
  return { shadowBlur, shadowOffsetX, shadowOffsetY, shadowOpacity };
}

const defaultAppearance: TileAppearance = {
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

const storageKey = "ecofocus_explore_dashboard_v1";
const historyLimit = 40;
const defaultGridSize = 40;
const canvasWidth = 1280;
const canvasHeight = 760;
const fontFamilies = [
  { label: "Inter", value: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif" },
  { label: "System", value: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times", value: "\"Times New Roman\", Times, serif" },
  { label: "Courier", value: "\"Courier New\", Courier, monospace" }
];

let lastSolidPickerHue = 150;

function defaultPageDesign() {
  return {
    showCanvasGrid: true,
    snapToGrid: false,
    gridSize: defaultGridSize,
    background: "#ffffff",
    backgroundMode: "solid" as const,
    backgroundImage: "",
    backgroundImageFit: "cover" as const,
    gradientFrom: "#ffffff",
    gradientTo: "#eef7ef",
    gradientType: "linear" as const,
    gradientAngle: 135,
    gradientStops: []
  };
}

function seedVariableSets(): SavedVariableSet[] {
  return [
    {
      id: "vs_brand_priorities_top2",
      datasetId: defaultDataset.id,
      label: "Brand priorities Top 2",
      description: "Saved variable set for the Top 2 brand and retailer priorities question.",
      topic: "Brand Sustainability Perceptions",
      questionIds: ["Q15_TOP2_BRAND_PRIORITIES"],
      primaryQuestionId: "Q15_TOP2_BRAND_PRIORITIES",
      breakBy: "SUMMARY",
      metric: "percent_selected",
      chartType: "horizontal_bar",
      weight: defaultDataset.defaultWeight,
      filterField: defaultFilterDimension?.id ?? null,
      filterValue: "all"
    }
  ];
}

const initialDashboard: DashboardDraft = {
  id: "internal_mvp",
  title: "2025 EcoFocus Builder Draft",
  status: "draft",
  analysisLibrary: {
    variableSets: seedVariableSets()
  },
  pages: [
    {
      id: "page_overview",
      title: "Overview",
      order: 1,
      ...defaultPageDesign(),
      elements: [],
      tiles: []
    }
  ]
};

function defaultElementStyle(type: DashboardCanvasElementType): DashboardCanvasElement["style"] {
  return {
    fill: type === "circle" || type === "rectangle" ? "#dfeee2" : "transparent",
    fillMode: "solid",
    gradientFrom: "#dfeee2",
    gradientTo: "#9fc9a7",
    gradientType: "linear",
    gradientStops: [],
    textColor: "#17211b",
    borderColor: "#438757",
    borderWidth: type === "rectangle" || type === "circle" ? 2 : 1,
    borderStyle: "solid",
    borderRadius: type === "rectangle" ? 8 : 0,
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
    objectFit: "cover",
    fontFamily: fontFamilies[0].value,
    fontSize: 24,
    fontWeight: "700",
    fontStyle: "normal",
    textDecoration: "none",
    textAlign: "left",
    lineHeight: 1.2,
    padding: 10
  };
}

function makeGradientStop(color: string, position: number): GradientStop {
  return {
    id: `stop_${position}_${color.replace("#", "")}`,
    color,
    position,
    opacity: 100
  };
}

function normalizeHexColor(value: string | null | undefined, fallback = "#000000") {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed;
  if (/^#[0-9a-f]{8}$/i.test(trimmed)) return trimmed;
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    return `#${trimmed.slice(1).split("").map((item) => item + item).join("")}`;
  }
  if (/^#[0-9a-f]{4}$/i.test(trimmed)) {
    return `#${trimmed.slice(1).split("").map((item) => item + item).join("")}`;
  }
  return fallback;
}

function hexToRgbObject(value: string) {
  const hex = normalizeHexColor(value);
  const normalized = hex.slice(1);
  const rgb = normalized.slice(0, 6);
  const alpha = normalized.length === 8 ? normalized.slice(6, 8) : "ff";
  const parsed = Number.parseInt(rgb, 16);
  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
    a: Math.round((Number.parseInt(alpha, 16) / 255) * 100)
  };
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0"))
    .join("")}`;
}

function setHexAlpha(value: string, alpha: number) {
  const base = normalizeHexColor(value).slice(1, 7);
  const normalizedAlpha = Math.max(0, Math.min(100, Math.round(alpha)));
  if (normalizedAlpha >= 100) return `#${base}`;
  const alphaHex = Math.round((normalizedAlpha / 100) * 255).toString(16).padStart(2, "0");
  return `#${base}${alphaHex}`;
}

function colorAlpha(value: string) {
  return hexToRgbObject(value).a;
}

function stripHexAlpha(value: string) {
  return `#${normalizeHexColor(value).slice(1, 7)}`;
}

function rgbToHsl(r: number, g: number, b: number) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) {
    return { h: 0, s: 0, l: Math.round(lightness * 100) };
  }

  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue = 0;

  if (max === red) hue = ((green - blue) / delta) % 6;
  else if (max === green) hue = (blue - red) / delta + 2;
  else hue = (red - green) / delta + 4;

  return {
    h: Math.round((hue * 60 + 360) % 360),
    s: Math.round(saturation * 100),
    l: Math.round(lightness * 100)
  };
}

function hslToRgb(h: number, s: number, l: number) {
  const hue = ((h % 360) + 360) % 360;
  const saturation = Math.max(0, Math.min(100, s)) / 100;
  const lightness = Math.max(0, Math.min(100, l)) / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const sector = hue / 60;
  const x = chroma * (1 - Math.abs((sector % 2) - 1));
  let red = 0;
  let green = 0;
  let blue = 0;

  if (sector >= 0 && sector < 1) [red, green, blue] = [chroma, x, 0];
  else if (sector < 2) [red, green, blue] = [x, chroma, 0];
  else if (sector < 3) [red, green, blue] = [0, chroma, x];
  else if (sector < 4) [red, green, blue] = [0, x, chroma];
  else if (sector < 5) [red, green, blue] = [x, 0, chroma];
  else [red, green, blue] = [chroma, 0, x];

  const match = lightness - chroma / 2;
  return {
    r: Math.round((red + match) * 255),
    g: Math.round((green + match) * 255),
    b: Math.round((blue + match) * 255)
  };
}

function rgbToHsv(r: number, g: number, b: number) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;

  if (delta !== 0) {
    if (max === red) hue = ((green - blue) / delta) % 6;
    else if (max === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
  }

  return {
    h: Math.round((hue * 60 + 360) % 360),
    s: max === 0 ? 0 : Math.round((delta / max) * 100),
    v: Math.round(max * 100)
  };
}

function hsvToRgb(h: number, s: number, v: number) {
  const hue = ((h % 360) + 360) % 360;
  const saturation = Math.max(0, Math.min(100, s)) / 100;
  const value = Math.max(0, Math.min(100, v)) / 100;
  const chroma = value * saturation;
  const sector = hue / 60;
  const x = chroma * (1 - Math.abs((sector % 2) - 1));
  let red = 0;
  let green = 0;
  let blue = 0;

  if (sector >= 0 && sector < 1) [red, green, blue] = [chroma, x, 0];
  else if (sector < 2) [red, green, blue] = [x, chroma, 0];
  else if (sector < 3) [red, green, blue] = [0, chroma, x];
  else if (sector < 4) [red, green, blue] = [0, x, chroma];
  else if (sector < 5) [red, green, blue] = [x, 0, chroma];
  else [red, green, blue] = [chroma, 0, x];

  const match = value - chroma;
  return {
    r: Math.round((red + match) * 255),
    g: Math.round((green + match) * 255),
    b: Math.round((blue + match) * 255)
  };
}

function normalizeGradientStops(from: string, to: string, stops?: GradientStop[]) {
  const normalizedStops = (stops ?? [])
    .map((stop) => ({
      ...stop,
      position: Math.min(100, Math.max(0, Number(stop.position) || 0)),
      opacity: Math.min(100, Math.max(0, Number(stop.opacity ?? 100)))
    }))
    .sort((first, second) => first.position - second.position);

  const hasStart = normalizedStops.some((stop) => stop.position === 0);
  const hasEnd = normalizedStops.some((stop) => stop.position === 100);

  return [
    ...(hasStart ? [] : [makeGradientStop(from, 0)]),
    ...normalizedStops,
    ...(hasEnd ? [] : [makeGradientStop(to, 100)])
  ].sort((first, second) => first.position - second.position);
}

function protectedGradientEndpointIds(stops: GradientStop[]) {
  const startId = stops.find((stop) => stop.position === 0)?.id;
  const endId = [...stops].reverse().find((stop) => stop.position === 100)?.id;
  return { startId, endId };
}

function sampleGradientPositions(template: number[], count: number) {
  if (count <= 1) return [50];
  if (template.length === count) return template;

  return Array.from({ length: count }, (_, index) => {
    const t = count === 1 ? 0 : index / (count - 1);
    const scaled = t * (template.length - 1);
    const leftIndex = Math.floor(scaled);
    const rightIndex = Math.ceil(scaled);
    const left = template[leftIndex] ?? template[0] ?? 0;
    const right = template[rightIndex] ?? template[template.length - 1] ?? 100;
    const blend = scaled - leftIndex;
    return Math.round(left + (right - left) * blend);
  });
}

function applyGradientStylePreset(from: string, to: string, stops: GradientStop[] | undefined, positions: number[]) {
  const normalized = normalizeGradientStops(from, to, stops);
  const mappedPositions = sampleGradientPositions(positions, normalized.length);

  return normalized.map((stop, index) => ({
    ...stop,
    position: mappedPositions[index] ?? stop.position
  }));
}

function stopColorCss(stop: GradientStop) {
  const { r, g, b, a } = hexToRgbObject(stop.color);
  return `rgba(${r}, ${g}, ${b}, ${(a / 100) * (stop.opacity / 100)})`;
}

function gradientCss(from: string, to: string, stops?: GradientStop[], type: GradientType = "linear", angle = "90deg") {
  const stopList = normalizeGradientStops(from, to, stops).map((stop) => `${stopColorCss(stop)} ${stop.position}%`).join(", ");
  if (type === "radial") return `radial-gradient(circle at center, ${stopList})`;
  if (type === "conic") return `conic-gradient(from 90deg, ${stopList})`;
  return `linear-gradient(${angle}, ${stopList})`;
}

function svgLinearGradientVector(angle: number) {
  const radians = ((angle - 90) * Math.PI) / 180;
  const x = Math.cos(radians);
  const y = Math.sin(radians);
  return {
    x1: `${50 - x * 50}%`,
    y1: `${50 - y * 50}%`,
    x2: `${50 + x * 50}%`,
    y2: `${50 + y * 50}%`
  };
}

function backgroundStyle(mode: "solid" | "gradient", solid: string, gradientFrom: string, gradientTo: string, gradientStops?: GradientStop[], gradientType: GradientType = "linear") {
  return mode === "gradient" ? gradientCss(gradientFrom, gradientTo, gradientStops, gradientType, "135deg") : solid;
}

function hexToRgb(color: string) {
  const normalized = color.replace("#", "");
  const expanded = normalized.length === 3 ? normalized.split("").map((item) => item + item).join("") : normalized;
  const value = Number.parseInt(expanded, 16);
  if (Number.isNaN(value)) return "20, 32, 25";
  return `${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}`;
}

function effectShadow(style: {
  shadow: boolean;
  shadowColor: string;
  shadowOpacity: number;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  glow: boolean;
  glowColor: string;
  glowSize: number;
}) {
  const effects: string[] = [];

  if (style.shadow) {
    effects.push(`${style.shadowOffsetX}px ${style.shadowOffsetY}px ${style.shadowBlur}px rgba(${hexToRgb(style.shadowColor)}, ${style.shadowOpacity / 100})`);
  }

  if (style.glow) {
    effects.push(`0 0 ${style.glowSize}px rgba(${hexToRgb(style.glowColor)}, 0.42)`);
  }

  return effects.length ? effects.join(", ") : undefined;
}

function pageBackgroundLayer(page: DashboardPage) {
  if (page.backgroundMode === "gradient") {
    return gradientCss(page.gradientFrom, page.gradientTo, page.gradientStops, page.gradientType, `${page.gradientAngle}deg`);
  }

  if (page.backgroundMode === "image" && page.backgroundImage) {
    return `url("${page.backgroundImage.replace(/"/g, '\\"')}")`;
  }

  return page.background;
}

function canvasBackground(page: DashboardPage) {
  const pageBackground = pageBackgroundLayer(page);

  if (!page.showCanvasGrid) return pageBackground;

  return `linear-gradient(#eef3eb 1px, transparent 1px), linear-gradient(90deg, #eef3eb 1px, transparent 1px), ${pageBackground}`;
}

function canvasBackgroundSize(page: DashboardPage) {
  const finalSize =
    page.backgroundMode === "image"
      ? page.backgroundImageFit === "fill"
        ? "100% 100%"
        : page.backgroundImageFit
      : "100% 100%";

  if (!page.showCanvasGrid) return finalSize;

  return `${page.gridSize}px ${page.gridSize}px, ${page.gridSize}px ${page.gridSize}px, ${finalSize}`;
}

function canvasBackgroundRepeat(page: DashboardPage) {
  const finalRepeat = page.backgroundMode === "image" ? "no-repeat" : "no-repeat";

  if (!page.showCanvasGrid) return finalRepeat;

  return `repeat, repeat, ${finalRepeat}`;
}

function canvasBackgroundPosition(page: DashboardPage) {
  const finalPosition = page.backgroundMode === "image" ? "center center" : "0 0";

  if (!page.showCanvasGrid) return finalPosition;

  return `0 0, 0 0, ${finalPosition}`;
}

function GradientEditor({
  label,
  from,
  to,
  type,
  stops,
  allowedTypes = ["linear", "radial", "conic"],
  onChange
}: {
  label: string;
  from: string;
  to: string;
  type: GradientType;
  stops?: GradientStop[];
  allowedTypes?: GradientType[];
  onChange: (updates: { from: string; to: string; type: GradientType; stops: GradientStop[] }) => void;
}) {
  const [activeStopId, setActiveStopId] = useState<string | null>(null);
  const [draggedStopId, setDraggedStopId] = useState<string | null>(null);
  const allStops = normalizeGradientStops(from, to, stops);
  const { startId, endId } = protectedGradientEndpointIds(allStops);
  const stylePresets = gradientStylePresets.filter(
    (preset, index, presets) =>
      allowedTypes.includes(preset.type) && presets.findIndex((entry) => entry.type === preset.type) === index
  );

  function updateStop(id: string, updates: Partial<GradientStop>) {
    const nextStops = allStops.map((stop) => (stop.id === id ? { ...stop, ...updates } : stop));
    const nextStartId = protectedGradientEndpointIds(nextStops).startId;
    const nextEndId = protectedGradientEndpointIds(nextStops).endId;
    const start = nextStops.find((stop) => stop.id === nextStartId)?.color ?? from;
    const end = nextStops.find((stop) => stop.id === nextEndId)?.color ?? to;
    onChange({ from: start, to: end, type, stops: nextStops });
  }

  function addStop() {
    const innerStops = allStops.filter((stop) => stop.position > 0 && stop.position < 100);
    const nextPosition = innerStops.length
      ? Math.min(90, Math.max(10, Math.round(innerStops.reduce((sum, stop) => sum + stop.position, 0) / innerStops.length) + 15))
      : 50;
    const stop = { id: `stop_${Date.now()}`, color: "#ffffff", position: nextPosition, opacity: 100 };
    onChange({ from, to, type, stops: [...allStops, stop].sort((first, second) => first.position - second.position) });
  }

  function removeStop(id: string) {
    onChange({ from, to, type, stops: allStops.filter((stop) => stop.id !== id) });
  }

  function reorderStops(targetId: string) {
    if (!draggedStopId || draggedStopId === targetId) return;
    const fromIndex = allStops.findIndex((stop) => stop.id === draggedStopId);
    const toIndex = allStops.findIndex((stop) => stop.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    const next = [...allStops];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    const ordered = next.map((stop, index) => ({
      ...stop,
      position: next.length === 1 ? 50 : Math.round((index / (next.length - 1)) * 100)
    }));
    const nextStartId = protectedGradientEndpointIds(ordered).startId;
    const nextEndId = protectedGradientEndpointIds(ordered).endId;
    const start = ordered.find((stop) => stop.id === nextStartId)?.color ?? from;
    const end = ordered.find((stop) => stop.id === nextEndId)?.color ?? to;
    onChange({ from: start, to: end, type, stops: ordered.slice(1, -1) });
  }

  return (
    <div className="gradient-editor">
      <div className="gradient-editor-header">
        <span>{label}</span>
        <button type="button" className="mini-button" onClick={addStop}>Add color</button>
      </div>
      {stylePresets.length > 0 && (
        <div className="color-field">
          <span>Style</span>
          <div className="gradient-style-grid">
            {stylePresets.map((preset) => (
              <button
                type="button"
                key={preset.id}
                className={type === preset.type ? "active" : ""}
                onClick={() =>
                  onChange({
                    from,
                    to,
                    type: preset.type,
                    stops: applyGradientStylePreset(from, to, stops, preset.positions)
                  })
                }
                aria-label={preset.label}
              >
                <span
                  style={{
                    background: gradientCss(
                      from,
                      to,
                      applyGradientStylePreset(from, to, stops, preset.positions),
                      preset.type,
                      `${preset.angle}deg`
                    )
                  }}
                />
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="gradient-preview" style={{ background: gradientCss(from, to, stops, type) }}>
        {allStops.map((stop) => (
          <span
            key={stop.id}
            className={stop.id === activeStopId ? "gradient-stop-marker active" : "gradient-stop-marker"}
            style={{ left: `${stop.position}%` }}
          />
        ))}
      </div>
      <div className="gradient-chip-region">
        <div className="gradient-chip-row">
          {allStops.map((stop) => (
            <button
              type="button"
              key={stop.id}
              draggable
              className={stop.id === activeStopId ? "color-swatch active" : "color-swatch"}
              style={{ background: stop.color }}
              onClick={() => setActiveStopId((current) => (current === stop.id ? null : stop.id))}
              onDragStart={() => setDraggedStopId(stop.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => reorderStops(stop.id)}
              onDragEnd={() => setDraggedStopId(null)}
              aria-label={`Edit gradient color ${stop.color}`}
            />
          ))}
          <button type="button" className="color-swatch add" onClick={addStop} aria-label="Add gradient color">
            +
          </button>
        </div>
        {activeStopId && (
          <div className="gradient-chip-popover" role="dialog" aria-label="Gradient color">
            <div className="gradient-chip-popover__header">
              <strong>Gradient color</strong>
              <button type="button" className="mini-button" onClick={() => setActiveStopId(null)} aria-label="Close gradient color editor">
                x
              </button>
            </div>
            <SolidColorEditor
              value={allStops.find((stop) => stop.id === activeStopId)?.color ?? from}
              onChange={(value) => updateStop(activeStopId, { color: value })}
            />
            <div className="gradient-stop-inline-grid">
              <label>
                Position
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={allStops.find((stop) => stop.id === activeStopId)?.position ?? 0}
                  disabled={activeStopId === startId || activeStopId === endId}
                  onChange={(event) => updateStop(activeStopId, { position: Number(event.target.value) })}
                />
              </label>
              <label>
                Opacity
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={allStops.find((stop) => stop.id === activeStopId)?.opacity ?? 100}
                  onChange={(event) => updateStop(activeStopId, { opacity: Number(event.target.value) })}
                />
              </label>
            </div>
            <div className="gradient-stop-inline-actions">
              <button
                type="button"
                className="secondary compact"
                onClick={() => removeStop(activeStopId)}
                disabled={activeStopId === startId || activeStopId === endId}
              >
                Remove color
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const safeValue = normalizeHexColor(value);

  return (
    <div className="color-field">
      <span>{label}</span>
      <div className="color-field-stack">
        <button
          type="button"
          className="color-chip-button"
          onClick={() => setOpen((current) => !current)}
          aria-label={`Choose ${label}`}
        >
          <span className="color-chip" style={{ background: safeValue }} />
        </button>
        {open && (
          <div className="bar-color-popover simple-color-popover" role="dialog" aria-label={`${label} colors`}>
            <div className="simple-color-popover__header">
              <strong>{label}</strong>
              <button type="button" className="mini-button" onClick={() => setOpen(false)} aria-label={`Close ${label} picker`}>
                x
              </button>
            </div>
            <SolidColorEditor value={safeValue} onChange={onChange} />
          </div>
        )}
      </div>
    </div>
  );
}

function SolidColorEditor({
  value,
  onChange
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [inputMode, setInputMode] = useState<"hex" | "rgb" | "hsl">("hex");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const safeColor = normalizeHexColor(value);
  const rgb = hexToRgbObject(safeColor);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const rawHsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
  const hue = rawHsv.s === 0 ? lastSolidPickerHue : rawHsv.h;
  const hsv = { ...rawHsv, h: hue };
  const alpha = colorAlpha(safeColor);

  function updateFromHsv(nextHue: number, nextSaturation: number, nextValue: number) {
    lastSolidPickerHue = nextHue;
    const next = hsvToRgb(nextHue, nextSaturation, nextValue);
    onChange(setHexAlpha(rgbToHex(next.r, next.g, next.b), alpha));
  }

  function updateFromSurface(clientX: number, clientY: number) {
    const bounds = surfaceRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const saturation = ((clientX - bounds.left) / bounds.width) * 100;
    const valueLevel = 100 - ((clientY - bounds.top) / bounds.height) * 100;
    updateFromHsv(hsv.h, Math.max(0, Math.min(100, saturation)), Math.max(0, Math.min(100, valueLevel)));
  }

  async function pickScreenColor() {
    const EyeDropperApi = (globalThis as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
    if (!EyeDropperApi) {
      inputRef.current?.click();
      return;
    }

    try {
      const eyeDropper = new EyeDropperApi();
      const result = await eyeDropper.open();
      onChange(setHexAlpha(normalizeHexColor(result.sRGBHex, safeColor), alpha));
    } catch {
      // Ignore cancel and unsupported cases.
    }
  }

  return (
    <div className="solid-color-editor">
      <div
        ref={surfaceRef}
        className="color-surface"
        style={{ backgroundColor: `hsl(${hsv.h} 100% 50%)` }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          updateFromSurface(event.clientX, event.clientY);
        }}
        onPointerMove={(event) => {
          if (event.buttons !== 1) return;
          updateFromSurface(event.clientX, event.clientY);
        }}
      >
        <span
          className="color-surface__cursor"
          style={{
            left: `${hsv.s}%`,
            top: `${100 - hsv.v}%`
          }}
        />
      </div>
      <input
        className="hue-slider"
        type="range"
        min="0"
        max="360"
        value={hsv.h}
        style={{ "--range-fill": `${(hsv.h / 360) * 100}%` } as React.CSSProperties}
      onChange={(event) => updateFromHsv(Number(event.target.value), hsv.s, hsv.v)}
      />
      <div className="opacity-control">
        <span>Opacity</span>
        <div className="opacity-control__row">
          <input
            type="range"
            min="0"
            max="100"
            value={alpha}
            style={{ "--range-fill": rangeFill(alpha, 0, 100) } as React.CSSProperties}
            onChange={(event) => onChange(setHexAlpha(safeColor, Number(event.target.value) || 0))}
          />
          <input
            type="number"
            min="0"
            max="100"
            value={alpha}
            onChange={(event) => onChange(setHexAlpha(safeColor, Number(event.target.value) || 0))}
          />
        </div>
      </div>
      <div className="fill-mode-tabs picker input-mode-tabs">
        <button type="button" className={inputMode === "hex" ? "active" : ""} onClick={() => setInputMode("hex")}>HEX</button>
        <button type="button" className={inputMode === "rgb" ? "active" : ""} onClick={() => setInputMode("rgb")}>RGB</button>
        <button type="button" className={inputMode === "hsl" ? "active" : ""} onClick={() => setInputMode("hsl")}>HSL</button>
      </div>
      {inputMode === "hex" && (
        <div className="color-value-row">
          <button type="button" className="color-chip-button static" aria-hidden="true">
            <span className="color-chip" style={{ background: safeColor }} />
          </button>
          <input value={safeColor.toUpperCase()} onChange={(event) => onChange(normalizeHexColor(event.target.value, safeColor))} />
          <button type="button" className="mini-button eyedropper-button" onClick={() => void pickScreenColor()} aria-label="Pick color from screen">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M14 4l6 6m-9.5 9.5L4 20l.5-6.5L14 4l6 6-9.5 9.5ZM12 6l6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      )}
      {inputMode === "rgb" && (
        <div className="numeric-triplet">
          <input type="number" min="0" max="255" value={rgb.r} onChange={(event) => onChange(setHexAlpha(rgbToHex(Number(event.target.value) || 0, rgb.g, rgb.b), alpha))} />
          <input type="number" min="0" max="255" value={rgb.g} onChange={(event) => onChange(setHexAlpha(rgbToHex(rgb.r, Number(event.target.value) || 0, rgb.b), alpha))} />
          <input type="number" min="0" max="255" value={rgb.b} onChange={(event) => onChange(setHexAlpha(rgbToHex(rgb.r, rgb.g, Number(event.target.value) || 0), alpha))} />
        </div>
      )}
      {inputMode === "hsl" && (
        <div className="numeric-triplet">
          <input type="number" min="0" max="360" value={hsl.h} onChange={(event) => {
            const nextHue = Number(event.target.value) || 0;
            lastSolidPickerHue = nextHue;
            const next = hslToRgb(nextHue, hsl.s, hsl.l);
            onChange(setHexAlpha(rgbToHex(next.r, next.g, next.b), alpha));
          }} />
          <input type="number" min="0" max="100" value={hsl.s} onChange={(event) => {
            const next = hslToRgb(hsl.h, Number(event.target.value) || 0, hsl.l);
            onChange(setHexAlpha(rgbToHex(next.r, next.g, next.b), alpha));
          }} />
          <input type="number" min="0" max="100" value={hsl.l} onChange={(event) => {
            const next = hslToRgb(hsl.h, hsl.s, Number(event.target.value) || 0);
            onChange(setHexAlpha(rgbToHex(next.r, next.g, next.b), alpha));
          }} />
        </div>
      )}
      <input ref={inputRef} className="sr-only-color-input" type="color" value={stripHexAlpha(safeColor)} onChange={(event) => onChange(setHexAlpha(event.target.value, alpha))} tabIndex={-1} />
    </div>
  );
}

function BarColorField({
  style,
  onColorChange,
  onFillModeChange,
  onPresetApply,
  onGradientChange
}: {
  style: ReturnType<typeof getBarStyle>;
  onColorChange: (value: string) => void;
  onFillModeChange: (mode: "solid" | "gradient") => void;
  onPresetApply: (preset: (typeof gradientStylePresets)[number]) => void;
  onGradientChange: (updates: { color: string; gradientTo: string; gradientStops: GradientStop[] }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeGradientStopId, setActiveGradientStopId] = useState<string | null>(null);
  const [draggedGradientStopId, setDraggedGradientStopId] = useState<string | null>(null);
  const safeColor = normalizeHexColor(style.color);
  const gradientChips = normalizeGradientStops(style.color, style.gradientTo, style.gradientStops);

  function commitGradientChips(nextChips: GradientStop[]) {
    if (nextChips.length < 2) return;
    const ordered = nextChips.map((chip, index) => ({
      ...chip,
      position: nextChips.length === 1 ? 50 : Math.round((index / (nextChips.length - 1)) * 100)
    }));
    onGradientChange({
      color: ordered[0]?.color ?? style.color,
      gradientTo: ordered[ordered.length - 1]?.color ?? style.gradientTo,
      gradientStops: ordered.slice(1, -1)
    });
  }

  function updateGradientChipColor(id: string, color: string) {
    commitGradientChips(gradientChips.map((chip) => (chip.id === id ? { ...chip, color } : chip)));
  }

  function addGradientChip() {
    const newChip: GradientStop = {
      id: `chip_${Date.now()}`,
      color: style.gradientTo,
      position: 50,
      opacity: 100
    };
    const insertAt = Math.max(1, gradientChips.length - 1);
    const nextChips = [...gradientChips.slice(0, insertAt), newChip, ...gradientChips.slice(insertAt)];
    commitGradientChips(nextChips);
    setActiveGradientStopId(newChip.id);
  }

  function reorderGradientChips(targetId: string) {
    if (!draggedGradientStopId || draggedGradientStopId === targetId) return;
    const fromIndex = gradientChips.findIndex((chip) => chip.id === draggedGradientStopId);
    const toIndex = gradientChips.findIndex((chip) => chip.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    const next = [...gradientChips];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    commitGradientChips(next);
  }

  return (
    <div className="color-field">
      <span>Bar color</span>
      <div className="color-field-stack">
        <button type="button" className="color-chip-button" onClick={() => setOpen((current) => !current)} aria-label="Choose bar color">
          <span
            className="color-chip"
            style={{
              background:
                style.fillMode === "gradient"
                  ? gradientCss(style.color, style.gradientTo, style.gradientStops, style.gradientType, `${style.gradientAngle}deg`)
                  : safeColor
            }}
          />
        </button>
        {open && (
          <div className="bar-color-popover" role="dialog" aria-label="Bar color">
            <div className="fill-mode-tabs picker">
              <button type="button" className={style.fillMode === "solid" ? "active" : ""} onClick={() => onFillModeChange("solid")}>Solid color</button>
              <button type="button" className={style.fillMode === "gradient" ? "active" : ""} onClick={() => onFillModeChange("gradient")}>Gradient</button>
            </div>
            {style.fillMode === "gradient" ? (
              <>
                <div className="color-field">
                  <span>Gradient colors</span>
                  <div className="gradient-chip-region">
                    <div className="gradient-chip-row">
                      {gradientChips.map((chip) => (
                        <button
                          type="button"
                          key={chip.id}
                          draggable
                          className={chip.id === activeGradientStopId ? "color-swatch active" : "color-swatch"}
                          style={{ background: chip.color }}
                          onClick={() => setActiveGradientStopId((current) => (current === chip.id ? null : chip.id))}
                          onDragStart={() => setDraggedGradientStopId(chip.id)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => reorderGradientChips(chip.id)}
                          onDragEnd={() => setDraggedGradientStopId(null)}
                          aria-label={`Edit gradient color ${chip.color}`}
                        />
                      ))}
                      <button type="button" className="color-swatch add" onClick={addGradientChip} aria-label="Add gradient color">
                        +
                      </button>
                    </div>
                    {activeGradientStopId && (
                      <div className="gradient-chip-popover" role="dialog" aria-label="Gradient color">
                        <div className="gradient-chip-popover__header">
                          <strong>Gradient color</strong>
                          <button type="button" className="mini-button" onClick={() => setActiveGradientStopId(null)} aria-label="Close gradient color editor">
                            x
                          </button>
                        </div>
                        <SolidColorEditor
                          value={gradientChips.find((chip) => chip.id === activeGradientStopId)?.color ?? safeColor}
                          onChange={(value) => updateGradientChipColor(activeGradientStopId, value)}
                        />
                      </div>
                    )}
                  </div>
                </div>
                <div className="color-field">
                  <span>Style</span>
                  <div className="gradient-style-grid">
                    {gradientStylePresets.map((preset) => (
                      <button
                        type="button"
                        key={preset.id}
                        className={style.gradientType === preset.type && style.gradientAngle === preset.angle ? "active" : ""}
                        onClick={() => onPresetApply(preset)}
                        aria-label={preset.label}
                      >
                        <span
                          style={{
                            background: gradientCss(
                              style.color,
                              style.gradientTo,
                              applyGradientStylePreset(style.color, style.gradientTo, style.gradientStops, preset.positions),
                              preset.type,
                              `${preset.angle}deg`
                            )
                          }}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <SolidColorEditor value={safeColor} onChange={onColorChange} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PageBackgroundField({
  page,
  onModeChange,
  onSolidChange,
  onGradientChange,
  onImageChange
}: {
  page: DashboardPage;
  onModeChange: (mode: DashboardPage["backgroundMode"]) => void;
  onSolidChange: (value: string) => void;
  onGradientChange: (updates: { from: string; to: string; type: GradientType; angle: number; stops: GradientStop[] }) => void;
  onImageChange: (updates: Partial<Pick<DashboardPage, "backgroundImage" | "backgroundImageFit">>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeGradientStopId, setActiveGradientStopId] = useState<string | null>(null);
  const [draggedGradientStopId, setDraggedGradientStopId] = useState<string | null>(null);
  const gradientChips = normalizeGradientStops(page.gradientFrom, page.gradientTo, page.gradientStops);
  const backgroundPreview =
    page.backgroundMode === "image" && page.backgroundImage
      ? undefined
      : page.backgroundMode === "gradient"
        ? gradientCss(page.gradientFrom, page.gradientTo, page.gradientStops, page.gradientType, `${page.gradientAngle}deg`)
        : normalizeHexColor(page.background);

  function commitGradientChips(nextChips: GradientStop[]) {
    if (nextChips.length < 2) return;
    const ordered = nextChips.map((chip, index) => ({
      ...chip,
      position: nextChips.length === 1 ? 50 : Math.round((index / (nextChips.length - 1)) * 100)
    }));
    onGradientChange({
      from: ordered[0]?.color ?? page.gradientFrom,
      to: ordered[ordered.length - 1]?.color ?? page.gradientTo,
      type: page.gradientType,
      angle: page.gradientAngle,
      stops: ordered.slice(1, -1)
    });
  }

  function updateGradientChipColor(id: string, color: string) {
    commitGradientChips(gradientChips.map((chip) => (chip.id === id ? { ...chip, color } : chip)));
  }

  function addGradientChip() {
    const newChip: GradientStop = {
      id: `page_chip_${Date.now()}`,
      color: page.gradientTo,
      position: 50,
      opacity: 100
    };
    const insertAt = Math.max(1, gradientChips.length - 1);
    const nextChips = [...gradientChips.slice(0, insertAt), newChip, ...gradientChips.slice(insertAt)];
    commitGradientChips(nextChips);
    setActiveGradientStopId(newChip.id);
  }

  function reorderGradientChips(targetId: string) {
    if (!draggedGradientStopId || draggedGradientStopId === targetId) return;
    const fromIndex = gradientChips.findIndex((chip) => chip.id === draggedGradientStopId);
    const toIndex = gradientChips.findIndex((chip) => chip.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    const next = [...gradientChips];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    commitGradientChips(next);
  }

  return (
    <div className="color-field">
      <span>Background</span>
      <div className="color-field-stack">
        <button type="button" className="color-chip-button" onClick={() => setOpen((current) => !current)} aria-label="Choose page background">
          <span
            className="color-chip"
            style={{
              background: backgroundPreview,
              backgroundImage:
                page.backgroundMode === "image" && page.backgroundImage
                  ? `url("${page.backgroundImage.replace(/"/g, '\\"')}")`
                  : undefined,
              backgroundSize:
                page.backgroundMode === "image"
                  ? page.backgroundImageFit === "fill"
                    ? "100% 100%"
                    : page.backgroundImageFit
                  : undefined,
              backgroundPosition: "center"
            }}
          />
        </button>
        {open && (
          <div className="bar-color-popover" role="dialog" aria-label="Page background">
            <div className="fill-mode-tabs picker input-mode-tabs">
              <button type="button" className={page.backgroundMode === "solid" ? "active" : ""} onClick={() => onModeChange("solid")}>Solid</button>
              <button type="button" className={page.backgroundMode === "gradient" ? "active" : ""} onClick={() => onModeChange("gradient")}>Gradient</button>
              <button type="button" className={page.backgroundMode === "image" ? "active" : ""} onClick={() => onModeChange("image")}>Image</button>
            </div>
            {page.backgroundMode === "gradient" ? (
              <>
                <div className="color-field">
                  <span>Gradient colors</span>
                  <div className="gradient-chip-region">
                    <div className="gradient-chip-row">
                      {gradientChips.map((chip) => (
                        <button
                          type="button"
                          key={chip.id}
                          draggable
                          className={chip.id === activeGradientStopId ? "color-swatch active" : "color-swatch"}
                          style={{ background: chip.color }}
                          onClick={() => setActiveGradientStopId((current) => (current === chip.id ? null : chip.id))}
                          onDragStart={() => setDraggedGradientStopId(chip.id)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => reorderGradientChips(chip.id)}
                          onDragEnd={() => setDraggedGradientStopId(null)}
                          aria-label={`Edit gradient color ${chip.color}`}
                        />
                      ))}
                      <button type="button" className="color-swatch add" onClick={addGradientChip} aria-label="Add gradient color">
                        +
                      </button>
                    </div>
                    {activeGradientStopId && (
                      <div className="gradient-chip-popover" role="dialog" aria-label="Gradient color">
                        <div className="gradient-chip-popover__header">
                          <strong>Gradient color</strong>
                          <button type="button" className="mini-button" onClick={() => setActiveGradientStopId(null)} aria-label="Close gradient color editor">
                            x
                          </button>
                        </div>
                        <SolidColorEditor
                          value={gradientChips.find((chip) => chip.id === activeGradientStopId)?.color ?? page.gradientFrom}
                          onChange={(value) => updateGradientChipColor(activeGradientStopId, value)}
                        />
                      </div>
                    )}
                  </div>
                </div>
                <div className="color-field">
                  <span>Style</span>
                  <div className="gradient-style-grid">
                    {gradientStylePresets.map((preset) => (
                      <button
                        type="button"
                        key={preset.id}
                        className={page.gradientType === preset.type && page.gradientAngle === preset.angle ? "active" : ""}
                        onClick={() =>
                          onGradientChange({
                            from: page.gradientFrom,
                            to: page.gradientTo,
                            type: preset.type,
                            angle: preset.angle,
                            stops: applyGradientStylePreset(page.gradientFrom, page.gradientTo, page.gradientStops, preset.positions)
                          })
                        }
                        aria-label={preset.label}
                      >
                        <span
                          style={{
                            background: gradientCss(
                              page.gradientFrom,
                              page.gradientTo,
                              applyGradientStylePreset(page.gradientFrom, page.gradientTo, page.gradientStops, preset.positions),
                              preset.type,
                              `${preset.angle}deg`
                            )
                          }}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : page.backgroundMode === "image" ? (
              <div className="color-field">
                <span>Background image</span>
                <div className="modal-control-stack compact">
                  <label>
                    Image URL
                    <input
                      type="url"
                      placeholder="https://..."
                      value={page.backgroundImage}
                      onChange={(event) => onImageChange({ backgroundImage: event.target.value })}
                    />
                  </label>
                  <label>
                    Image fit
                    <select
                      value={page.backgroundImageFit}
                      onChange={(event) => onImageChange({ backgroundImageFit: event.target.value as DashboardPage["backgroundImageFit"] })}
                    >
                      <option value="cover">Cover</option>
                      <option value="contain">Contain</option>
                      <option value="fill">Stretch</option>
                    </select>
                  </label>
                  {page.backgroundImage && (
                    <div
                      className="page-background-preview"
                      style={{
                        backgroundImage: `url("${page.backgroundImage.replace(/"/g, '\\"')}")`,
                        backgroundSize: page.backgroundImageFit === "fill" ? "100% 100%" : page.backgroundImageFit,
                        backgroundPosition: "center",
                        backgroundRepeat: "no-repeat"
                      }}
                    />
                  )}
                </div>
              </div>
            ) : (
              <SolidColorEditor value={page.background} onChange={onSolidChange} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function rangeFill(value: number | string, min: number, max: number) {
  const numericValue = Number(value);
  const percentage = ((numericValue - min) / (max - min)) * 100;
  return `${Math.min(100, Math.max(0, percentage))}%`;
}

function getBarStyle(appearance: TileAppearance, id: string, fallbackColor: string) {
  const defaultGradientColor = appearance.barFillMode === "gradient" ? appearance.primaryColor : fallbackColor;
  return {
    color: appearance.barStyles[id]?.color ?? defaultGradientColor,
    fillMode: appearance.barStyles[id]?.fillMode ?? appearance.barFillMode,
    gradientTo: appearance.barStyles[id]?.gradientTo ?? appearance.barGradientTo,
    gradientType: appearance.barStyles[id]?.gradientType ?? appearance.barGradientType,
    gradientAngle: appearance.barStyles[id]?.gradientAngle ?? appearance.barGradientAngle,
    gradientStops: appearance.barStyles[id]?.gradientStops ?? appearance.barGradientStops,
    radius: appearance.barStyles[id]?.radius ?? appearance.barRadius
  };
}

function gradientId(tileId: string, key: string) {
  return `gradient_${tileId.replace(/[^a-zA-Z0-9]/g, "_")}_${key.replace(/[^a-zA-Z0-9]/g, "_")}`;
}

function SvgGradientStops({ from, to, stops }: { from: string; to: string; stops?: GradientStop[] }) {
  return (
    <>
      {normalizeGradientStops(from, to, stops).map((stop) => (
        <stop key={stop.id} offset={`${stop.position}%`} stopColor={stop.color} stopOpacity={stop.opacity / 100} />
      ))}
    </>
  );
}

function SvgBarGradientDef({
  id,
  orientation,
  style
}: {
  id: string;
  orientation: "vertical" | "horizontal";
  style: ReturnType<typeof getBarStyle>;
}) {
  if (style.gradientType === "radial") {
    return (
      <radialGradient id={id}>
        <SvgGradientStops from={style.color} to={style.gradientTo} stops={style.gradientStops} />
      </radialGradient>
    );
  }

  const vector = svgLinearGradientVector(style.gradientAngle ?? (orientation === "horizontal" ? 90 : 180));

  return (
    <linearGradient id={id} x1={vector.x1} y1={vector.y1} x2={vector.x2} y2={vector.y2}>
      <SvgGradientStops from={style.color} to={style.gradientTo} stops={style.gradientStops} />
    </linearGradient>
  );
}

function formatValue(value: number, format: AnalyticsQueryResponse["metric"]["valueFormat"]) {
  return format === "percent" ? `${value}%` : value.toLocaleString();
}

function wrapWords(value: string, maxChars: number, maxLines: number) {
  const manualLines = value.split("\n");
  const wrappedLines = manualLines.flatMap((line) => {
    const words = line.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let currentLine = "";

    words.forEach((word) => {
      const nextLine = currentLine ? `${currentLine} ${word}` : word;
      if (nextLine.length > maxChars && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = nextLine;
      }
    });

    if (currentLine) lines.push(currentLine);
    return lines.length > 0 ? lines : [line];
  });

  const limitedLines = wrappedLines.slice(0, maxLines);
  if (wrappedLines.length > maxLines && limitedLines.length > 0) {
    limitedLines[limitedLines.length - 1] = `${limitedLines[limitedLines.length - 1].replace(/\.+$/, "")}...`;
  }
  return limitedLines;
}

function getAxisLabel(appearance: TileAppearance, id: string, fallback: string) {
  return appearance.axisLabelOverrides[id] ?? fallback;
}

function getChartTypeLabel(chartType: ChartType) {
  return defaultDataset.chartTypes.find((item) => item.id === chartType)?.label ?? chartType;
}

function getQuestionLabel(questionId: QuestionId) {
  return defaultDataset.questions.find((question) => question.id === questionId)?.shortLabel ?? questionId;
}

function getPaletteId(colors: string[]) {
  return palettes.find((palette) => palette.colors.join(",") === colors.join(","))?.id ?? "custom";
}

function uniqueColors(colors: string[]) {
  return Array.from(new Set(colors.filter(Boolean)));
}

function getDocumentColors(tile?: DashboardTile) {
  if (!tile) return uniqueColors(["#0f1720", "#ffffff", "#16c9c3", "#00d17f", "#17a4ff", "#69776e"]);

  return uniqueColors([
    ...tile.appearance.palette,
    tile.appearance.primaryColor,
    tile.appearance.barGradientTo,
    tile.appearance.labelColor,
    tile.appearance.xAxisTextColor,
    tile.appearance.yAxisTextColor,
    tile.appearance.chartBackground,
    tile.appearance.gridColor,
    tile.appearance.background,
    tile.appearance.borderColor
  ]);
}

const gradientStylePresets = [
  { id: "linear-left-right", label: "Left to right", type: "linear" as const, angle: 90, positions: [0, 100] },
  { id: "linear-top-bottom", label: "Top to bottom", type: "linear" as const, angle: 180, positions: [0, 100] },
  { id: "linear-diagonal", label: "Diagonal", type: "linear" as const, angle: 135, positions: [0, 35, 100] },
  { id: "radial-soft", label: "Radial", type: "radial" as const, angle: 90, positions: [0, 45, 100] },
  { id: "conic-sweep", label: "Conic", type: "conic" as const, angle: 90, positions: [0, 25, 60, 100] }
];

function getCompatibleChartTypes(result: AnalyticsQueryResponse) {
  const isSingleSeries = result.columns.length === 1;
  const chartTypes: ChartType[] = isSingleSeries
    ? ["vertical_bar", "horizontal_bar", "donut"]
    : ["grouped_bar", "stacked_bar", "line_chart"];
  return chartTypes.filter((chartType) => defaultDataset.chartTypes.some((item) => item.id === chartType));
}

function AxisTick(props: { x?: string | number; y?: string | number; payload?: { value: string }; appearance: TileAppearance; axisDirection?: "x" | "y" }) {
  const { payload, appearance, axisDirection = "x" } = props;
  const x = Number(props.x ?? 0);
  const y = Number(props.y ?? 0);
  const label = payload?.value ?? "";
  const lines = appearance.axisLabelWrap ? wrapWords(label, appearance.axisLabelWidth, appearance.axisLabelMaxLines) : label.split("\n");
  const lineHeight = appearance.axisFontSize + 3;
  const yAxisLabelWidth = appearance.axisLabelWidth * 5;
  const yAxisGap = 18;
  const yAxisAnchorOffset =
    appearance.axisLabelAlign === "start" ? -(yAxisLabelWidth + yAxisGap) : appearance.axisLabelAlign === "middle" ? -(yAxisLabelWidth / 2 + yAxisGap) : -yAxisGap;
  const textAnchor = axisDirection === "y" ? appearance.axisLabelAlign : appearance.axisLabelRotation < 0 ? "end" : appearance.axisLabelRotation > 0 ? "start" : appearance.axisLabelAlign;
  const baseX = axisDirection === "y" ? x + yAxisAnchorOffset : x;
  const baseY = y;
  const initialDy = axisDirection === "y" ? -((lines.length - 1) * lineHeight) / 2 : 0;

  return (
    <g transform={`translate(${baseX + appearance.axisLabelDx},${baseY + appearance.axisLabelDy}) rotate(${appearance.axisLabelRotation})`}>
      <text
        fill={axisDirection === "y" ? appearance.yAxisTextColor : appearance.xAxisTextColor}
        fontSize={appearance.axisFontSize}
        textAnchor={textAnchor}
        dominantBaseline={axisDirection === "y" ? "middle" : undefined}
      >
        {lines.map((line, index) => (
          <tspan key={`${line}-${index}`} x={0} dy={index === 0 ? initialDy : lineHeight}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

function getAnnotation(annotations: AnalyticsAnnotation[], rowId: string, columnId: string) {
  return annotations.find((annotation) => annotation.rowId === rowId && annotation.columnId === columnId);
}

function sampleSizeLabel(result: AnalyticsQueryResponse) {
  const bases = result.table.flatMap((row) => Object.values(row.bases)).filter((base) => base > 0);
  const uniqueBases = [...new Set(bases)].sort((a, b) => a - b);
  if (uniqueBases.length === 0) return "Sample n/a";
  if (uniqueBases.length === 1) return `Sample n=${uniqueBases[0].toLocaleString()}`;
  return `Sample n=${uniqueBases[0].toLocaleString()}-${uniqueBases[uniqueBases.length - 1].toLocaleString()}`;
}

function confidenceLevelLabel(value: number) {
  return `${Math.round(value * 100)}% confidence`;
}

function resultConfidenceLevel(result: AnalyticsQueryResponse) {
  return result.statistics?.confidenceLevel ?? result.query.confidenceLevel ?? 0.95;
}

function ValueLabel(props: {
  x?: unknown;
  y?: unknown;
  width?: unknown;
  value?: unknown;
  payload?: { optionId: string };
  result: AnalyticsQueryResponse;
  appearance: TileAppearance;
}) {
  const { payload, result, appearance } = props;

  if (!appearance.showValueLabels) return null;

  const x = Number(props.x ?? 0);
  const y = Number(props.y ?? 0);
  const width = Number(props.width ?? 0);
  const value = Number(props.value ?? 0);
  const annotation = payload && appearance.showAnnotations ? getAnnotation(result.annotations, payload.optionId, result.columns[0]?.id) : undefined;
  const yOffset =
    appearance.labelPosition === "insideBottom"
      ? 18
      : appearance.labelPosition === "insideTop"
        ? 20
        : appearance.labelPosition === "center"
          ? 0
          : -appearance.labelOffset;
  const labelY = appearance.labelPosition === "center" ? y + 18 : y + yOffset;

  return (
    <text
      x={x + width / 2}
      y={labelY}
      textAnchor="middle"
      className={annotation ? `chart-value ${annotation.direction}` : "chart-value"}
      style={{ fill: annotation ? undefined : appearance.labelColor, fontSize: appearance.labelFontSize }}
    >
      {formatValue(value, result.metric.valueFormat)}
      {annotation ? (annotation.direction === "up" ? "↑" : "↓") : ""}
    </text>
  );
}

function HorizontalValueLabel(props: {
  x?: unknown;
  y?: unknown;
  width?: unknown;
  height?: unknown;
  value?: unknown;
  result: AnalyticsQueryResponse;
  appearance: TileAppearance;
}) {
  const { result, appearance } = props;

  if (!appearance.showValueLabels) return null;

  const x = Number(props.x ?? 0);
  const y = Number(props.y ?? 0);
  const width = Number(props.width ?? 0);
  const height = Number(props.height ?? 0);
  const value = Number(props.value ?? 0);
  const edgePadding = Math.max(6, appearance.labelOffset);
  const labelX =
    appearance.labelPosition === "center"
      ? x + width / 2
      : appearance.labelPosition === "top"
        ? x + width + edgePadding
        : appearance.labelPosition === "insideTop"
          ? x + Math.max(edgePadding, width - edgePadding)
          : x + edgePadding;
  const labelY = y + height / 2;
  const textAnchor =
    appearance.labelPosition === "center"
      ? "middle"
      : appearance.labelPosition === "top"
        ? "start"
        : appearance.labelPosition === "insideTop"
          ? "end"
          : "start";

  return (
    <text
      x={labelX}
      y={labelY}
      textAnchor={textAnchor}
      dominantBaseline="middle"
      className="chart-value"
      style={{ fill: appearance.labelColor, fontSize: appearance.labelFontSize }}
    >
      {formatValue(value, result.metric.valueFormat)}
    </text>
  );
}

function HorizontalCategoryLabel(props: {
  x?: unknown;
  y?: unknown;
  width?: unknown;
  height?: unknown;
  value?: unknown;
  appearance: TileAppearance;
}) {
  const { appearance } = props;

  if (appearance.axisLabelPlacement === "outside") return null;

  const x = Number(props.x ?? 0);
  const y = Number(props.y ?? 0);
  const width = Number(props.width ?? 0);
  const height = Number(props.height ?? 0);
  const label = String(props.value ?? "");
  const lines = appearance.axisLabelWrap ? wrapWords(label, appearance.axisLabelWidth, appearance.axisLabelMaxLines) : label.split("\n");
  const lineHeight = appearance.axisFontSize + 3;
  const baseY = y + height / 2 + appearance.axisLabelDy - ((lines.length - 1) * lineHeight) / 2;
  const insideStart = appearance.axisLabelPlacement === "insideStart";
  const baseX = insideStart ? x + 12 + appearance.axisLabelDx : x + width / 2 + appearance.axisLabelDx;

  return (
    <text
      x={baseX}
      y={baseY}
      fill={appearance.yAxisTextColor}
      fontSize={appearance.axisFontSize}
      textAnchor={insideStart ? "start" : "middle"}
      dominantBaseline="middle"
      pointerEvents="none"
    >
      {lines.map((line, index) => (
        <tspan key={`${line}-${index}`} x={baseX} dy={index === 0 ? 0 : lineHeight}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

function VerticalBarChartView({ tile }: { tile: DashboardTile }) {
  const { result, appearance } = tile;
  const column = result.columns[0];
  const chartData = result.table.map((row) => ({
    optionId: row.optionId,
    label: row.label,
    axisLabel: getAxisLabel(appearance, row.optionId, row.label),
    value: row.values[column.id],
    base: row.bases[column.id]
  }));

  return (
    <div className="chart-card" style={{ background: appearance.chartBackground }} aria-label="Query-driven vertical bar chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 32, right: 20, left: 8, bottom: 18 }} barCategoryGap={appearance.barCategoryGap} barGap={appearance.barGap}>
          <defs>
            {chartData.map((item, index) => {
              const fallback = appearance.palette[index % appearance.palette.length] ?? appearance.primaryColor;
              const style = getBarStyle(appearance, item.optionId, fallback);
              return <SvgBarGradientDef id={gradientId(tile.id, item.optionId)} key={item.optionId} orientation="vertical" style={style} />;
            })}
          </defs>
          {appearance.showGrid && <CartesianGrid stroke={appearance.gridColor} vertical={false} />}
          <XAxis dataKey="axisLabel" interval={0} tick={(props) => <AxisTick {...props} appearance={appearance} />} tickLine={false} height={appearance.axisHeight} />
          <YAxis tick={{ fill: appearance.yAxisTextColor, fontSize: appearance.axisFontSize }} tickLine={false} axisLine={false} />
          <Tooltip formatter={(value) => [formatValue(Number(value ?? 0), result.metric.valueFormat), result.metric.label]} />
          <Bar dataKey="value" radius={[appearance.barRadius, appearance.barRadius, 0, 0]} barSize={appearance.barSize}>
            {chartData.map((item, index) => (
              <Cell
                key={item.optionId}
                fill={getBarStyle(appearance, item.optionId, appearance.palette[index % appearance.palette.length] ?? appearance.primaryColor).fillMode === "gradient" ? `url(#${gradientId(tile.id, item.optionId)})` : getBarStyle(appearance, item.optionId, appearance.palette[index % appearance.palette.length] ?? appearance.primaryColor).color}
                {...({ radius: [getBarStyle(appearance, item.optionId, appearance.primaryColor).radius, getBarStyle(appearance, item.optionId, appearance.primaryColor).radius, 0, 0] } as Record<string, unknown>)}
              />
            ))}
            <LabelList content={(props) => <ValueLabel {...props} result={result} appearance={appearance} />} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function GroupedBarChartView({ tile }: { tile: DashboardTile }) {
  const { result, appearance } = tile;
  const chartData = result.table.map((row) => ({
    optionId: row.optionId,
    label: row.label,
    axisLabel: getAxisLabel(appearance, row.optionId, row.label),
    ...row.values
  }));

  return (
    <div className="chart-card" style={{ background: appearance.chartBackground }} aria-label="Query-driven grouped bar chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 20, right: 20, left: 8, bottom: 18 }} barCategoryGap={appearance.barCategoryGap} barGap={appearance.barGap}>
          <defs>
            {result.columns.map((column, index) => {
              const fallback = appearance.palette[index % appearance.palette.length] ?? appearance.primaryColor;
              const style = getBarStyle(appearance, column.id, fallback);
              return <SvgBarGradientDef id={gradientId(tile.id, column.id)} key={column.id} orientation="vertical" style={style} />;
            })}
          </defs>
          {appearance.showGrid && <CartesianGrid stroke={appearance.gridColor} vertical={false} />}
          <XAxis dataKey="axisLabel" interval={0} tick={(props) => <AxisTick {...props} appearance={appearance} />} tickLine={false} height={appearance.axisHeight} />
          <YAxis tick={{ fill: appearance.yAxisTextColor, fontSize: appearance.axisFontSize }} tickLine={false} axisLine={false} />
          <Tooltip formatter={(value) => [formatValue(Number(value ?? 0), result.metric.valueFormat), result.metric.label]} />
          <Legend verticalAlign="top" height={36} />
          {result.columns.map((column, index) => (
            <Bar
              key={column.id}
              dataKey={column.id}
              name={column.label}
              fill={getBarStyle(appearance, column.id, appearance.palette[index % appearance.palette.length] ?? appearance.primaryColor).fillMode === "gradient" ? `url(#${gradientId(tile.id, column.id)})` : getBarStyle(appearance, column.id, appearance.palette[index % appearance.palette.length] ?? appearance.primaryColor).color}
              radius={[getBarStyle(appearance, column.id, appearance.primaryColor).radius, getBarStyle(appearance, column.id, appearance.primaryColor).radius, 0, 0]}
              barSize={appearance.barSize}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function HorizontalBarChartView({ tile }: { tile: DashboardTile }) {
  const { result, appearance } = tile;
  const column = result.columns[0];
  const preferredYAxisWidth = appearance.axisLabelWidth * 5 + 28;
  const reservedOutsideWidth = 180;
  const yAxisWidth = appearance.axisLabelPlacement === "outside" ? Math.max(150, preferredYAxisWidth > reservedOutsideWidth ? preferredYAxisWidth : reservedOutsideWidth) : 16;
  const chartData = result.table.map((row) => ({
    optionId: row.optionId,
    label: row.label,
    axisLabel: getAxisLabel(appearance, row.optionId, row.label),
    value: row.values[column.id],
    base: row.bases[column.id]
  }));

  return (
    <div className="chart-card" style={{ background: appearance.chartBackground }} aria-label="Query-driven horizontal bar chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 18, right: 34, left: 18, bottom: 22 }} barCategoryGap={appearance.barCategoryGap}>
          <defs>
            {chartData.map((item, index) => {
              const fallback = appearance.palette[index % appearance.palette.length] ?? appearance.primaryColor;
              const style = getBarStyle(appearance, item.optionId, fallback);
              return <SvgBarGradientDef id={gradientId(tile.id, item.optionId)} key={item.optionId} orientation="horizontal" style={style} />;
            })}
          </defs>
          {appearance.showGrid && <CartesianGrid stroke={appearance.gridColor} horizontal={false} />}
          <XAxis type="number" tick={{ fill: appearance.xAxisTextColor, fontSize: appearance.axisFontSize }} tickLine={false} axisLine={false} />
          <YAxis
            type="category"
            dataKey="axisLabel"
            width={yAxisWidth}
            tick={appearance.axisLabelPlacement === "outside" ? (props) => <AxisTick {...props} appearance={appearance} axisDirection="y" /> : false}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip formatter={(value) => [formatValue(Number(value ?? 0), result.metric.valueFormat), result.metric.label]} />
          <Bar dataKey="value" radius={[0, appearance.barRadius, appearance.barRadius, 0]} barSize={appearance.barSize}>
            <LabelList dataKey="axisLabel" content={(props) => <HorizontalCategoryLabel {...props} appearance={appearance} />} />
            {chartData.map((item, index) => (
              <Cell
                key={item.optionId}
                fill={getBarStyle(appearance, item.optionId, appearance.palette[index % appearance.palette.length] ?? appearance.primaryColor).fillMode === "gradient" ? `url(#${gradientId(tile.id, item.optionId)})` : getBarStyle(appearance, item.optionId, appearance.palette[index % appearance.palette.length] ?? appearance.primaryColor).color}
              />
            ))}
            <LabelList content={(props) => <HorizontalValueLabel {...props} result={result} appearance={appearance} />} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function StackedBarChartView({ tile }: { tile: DashboardTile }) {
  const { result, appearance } = tile;
  const chartData = result.table.map((row) => ({
    optionId: row.optionId,
    label: row.label,
    axisLabel: getAxisLabel(appearance, row.optionId, row.label),
    ...row.values
  }));

  return (
    <div className="chart-card" style={{ background: appearance.chartBackground }} aria-label="Query-driven stacked bar chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 20, right: 20, left: 8, bottom: 18 }} barCategoryGap={appearance.barCategoryGap}>
          <defs>
            {result.columns.map((column, index) => {
              const fallback = appearance.palette[index % appearance.palette.length] ?? appearance.primaryColor;
              const style = getBarStyle(appearance, column.id, fallback);
              return <SvgBarGradientDef id={gradientId(tile.id, column.id)} key={column.id} orientation="vertical" style={style} />;
            })}
          </defs>
          {appearance.showGrid && <CartesianGrid stroke={appearance.gridColor} vertical={false} />}
          <XAxis dataKey="axisLabel" interval={0} tick={(props) => <AxisTick {...props} appearance={appearance} />} tickLine={false} height={appearance.axisHeight} />
          <YAxis tick={{ fill: appearance.yAxisTextColor, fontSize: appearance.axisFontSize }} tickLine={false} axisLine={false} />
          <Tooltip formatter={(value) => [formatValue(Number(value ?? 0), result.metric.valueFormat), result.metric.label]} />
          <Legend verticalAlign="top" height={36} />
          {result.columns.map((column, index) => (
            <Bar
              key={column.id}
              dataKey={column.id}
              name={column.label}
              stackId="stack"
              fill={getBarStyle(appearance, column.id, appearance.palette[index % appearance.palette.length] ?? appearance.primaryColor).fillMode === "gradient" ? `url(#${gradientId(tile.id, column.id)})` : getBarStyle(appearance, column.id, appearance.palette[index % appearance.palette.length] ?? appearance.primaryColor).color}
              radius={index === result.columns.length - 1 ? [appearance.barRadius, appearance.barRadius, 0, 0] : [0, 0, 0, 0]}
              barSize={appearance.barSize}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function LineChartView({ tile }: { tile: DashboardTile }) {
  const { result, appearance } = tile;
  const chartData = result.table.map((row) => ({
    optionId: row.optionId,
    label: row.label,
    axisLabel: getAxisLabel(appearance, row.optionId, row.label),
    ...row.values
  }));

  return (
    <div className="chart-card" style={{ background: appearance.chartBackground }} aria-label="Query-driven line chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 20, right: 24, left: 8, bottom: 18 }}>
          {appearance.showGrid && <CartesianGrid stroke={appearance.gridColor} vertical={false} />}
          <XAxis dataKey="axisLabel" interval={0} tick={(props) => <AxisTick {...props} appearance={appearance} />} tickLine={false} height={appearance.axisHeight} />
          <YAxis tick={{ fill: appearance.yAxisTextColor, fontSize: appearance.axisFontSize }} tickLine={false} axisLine={false} />
          <Tooltip formatter={(value) => [formatValue(Number(value ?? 0), result.metric.valueFormat), result.metric.label]} />
          <Legend verticalAlign="top" height={36} />
          {result.columns.map((column, index) => (
            <Line
              key={column.id}
              type="monotone"
              dataKey={column.id}
              name={column.label}
              stroke={getBarStyle(appearance, column.id, appearance.palette[index % appearance.palette.length] ?? appearance.primaryColor).color}
              strokeWidth={3}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function DonutChartView({ tile }: { tile: DashboardTile }) {
  const { result, appearance } = tile;
  const column = result.columns[0];
  const chartData = result.table.map((row, index) => ({
    optionId: row.optionId,
    name: getAxisLabel(appearance, row.optionId, row.label),
    value: row.values[column.id],
    fill: getBarStyle(appearance, row.optionId, appearance.palette[index % appearance.palette.length] ?? appearance.primaryColor).color
  }));

  return (
    <div className="chart-card" style={{ background: appearance.chartBackground }} aria-label="Query-driven donut chart">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip formatter={(value) => [formatValue(Number(value ?? 0), result.metric.valueFormat), result.metric.label]} />
          <Legend verticalAlign="bottom" height={84} />
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            innerRadius="48%"
            outerRadius="78%"
            paddingAngle={2}
            label={appearance.showValueLabels ? (entry) => formatValue(Number(entry.value ?? 0), result.metric.valueFormat) : false}
          >
            {chartData.map((item) => (
              <Cell key={item.optionId} fill={item.fill} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChartView({ tile }: { tile: DashboardTile }) {
  if (tile.visualization === "vertical_bar") return <VerticalBarChartView tile={tile} />;
  if (tile.visualization === "horizontal_bar") return <HorizontalBarChartView tile={tile} />;
  if (tile.visualization === "grouped_bar") return <GroupedBarChartView tile={tile} />;
  if (tile.visualization === "stacked_bar") return <StackedBarChartView tile={tile} />;
  if (tile.visualization === "line_chart") return <LineChartView tile={tile} />;
  if (tile.visualization === "donut") return <DonutChartView tile={tile} />;
  return null;
}

function TileRenderer({ tile, selected, onSelect }: { tile: DashboardTile; selected: boolean; onSelect: () => void }) {
  const result = tile.result;

  return (
    <article
      className={selected ? "dashboard-tile selected" : "dashboard-tile"}
      style={{
        background: backgroundStyle(tile.appearance.backgroundMode, tile.appearance.background, tile.appearance.gradientFrom, tile.appearance.gradientTo, tile.appearance.gradientStops, tile.appearance.gradientType),
        borderColor: tile.appearance.borderColor,
        borderRadius: tile.appearance.borderRadius,
        opacity: tile.appearance.opacity / 100,
        boxShadow: effectShadow(tile.appearance)
      }}
      onClick={onSelect}
    >
      <div className="tile-header tile-drag-handle">
        <div>
          <h2>{tile.title}</h2>
        </div>
      </div>
      <div className="tile-scroll-area">
        <ChartView tile={tile} />
        <div className="tile-meta">
          <span>{getQuestionLabel(result.metadataRefs.question)}</span>
          <span>{sampleSizeLabel(result)}</span>
          <span>{result.weighting.applied ? result.weighting.label : "Unweighted"}</span>
          <span>{result.metric.label}</span>
          <span>{confidenceLevelLabel(resultConfidenceLevel(result))}</span>
        </div>
        {tile.appearance.showNotes && result.warnings.length > 0 && (
          <div className="notes">
            {result.warnings.slice(0, 1).map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

function CanvasElementRenderer({
  element,
  selected,
  onSelect
}: {
  element: DashboardCanvasElement;
  selected: boolean;
  onSelect: () => void;
}) {
  if (element.type === "image") {
    return (
      <div
        className={selected ? "canvas-element selected" : "canvas-element"}
        style={{
          borderColor: element.style.borderColor,
          borderWidth: element.style.borderWidth,
          borderStyle: element.style.borderStyle,
          borderRadius: element.style.borderRadius,
          opacity: element.style.opacity / 100,
          boxShadow: effectShadow(element.style)
        }}
        onClick={onSelect}
      >
        {element.content ? <img src={element.content} alt="" style={{ objectFit: element.style.objectFit }} /> : <div className="image-placeholder">Image URL</div>}
      </div>
    );
  }

  if (element.type === "text") {
    return (
      <div
        className={selected ? "canvas-element text-element selected" : "canvas-element text-element"}
        style={{
          color: element.style.textColor,
          fontFamily: element.style.fontFamily,
          fontSize: element.style.fontSize,
          fontWeight: element.style.fontWeight,
          fontStyle: element.style.fontStyle,
          textDecoration: element.style.textDecoration,
          textAlign: element.style.textAlign,
          lineHeight: element.style.lineHeight,
          padding: element.style.padding,
          background: backgroundStyle(element.style.fillMode, element.style.fill, element.style.gradientFrom, element.style.gradientTo, element.style.gradientStops, element.style.gradientType),
          borderColor: element.style.borderColor,
          borderWidth: element.style.borderWidth,
          borderStyle: element.style.borderStyle,
          borderRadius: element.style.borderRadius,
          opacity: element.style.opacity / 100,
          boxShadow: effectShadow(element.style)
        }}
        onClick={onSelect}
      >
        {element.content}
      </div>
    );
  }

  return (
    <div
      className={selected ? `canvas-element shape-element ${element.type} selected` : `canvas-element shape-element ${element.type}`}
      style={{
        background: backgroundStyle(element.style.fillMode, element.style.fill, element.style.gradientFrom, element.style.gradientTo, element.style.gradientStops, element.style.gradientType),
        borderColor: element.style.borderColor,
        borderWidth: element.style.borderWidth,
        borderStyle: element.style.borderStyle,
        borderRadius: element.type === "circle" ? 999 : element.style.borderRadius,
        opacity: element.style.opacity / 100,
        boxShadow: effectShadow(element.style)
      }}
      onClick={onSelect}
    />
  );
}

function makeTileId() {
  return `tile_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function makeElementId() {
  return `element_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function makePageId() {
  return `page_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function nextZIndex(page: DashboardPage) {
  const tileZ = page.tiles.map((tile) => tile.layout.zIndex);
  const elementZ = page.elements.map((element) => element.layout.zIndex);
  return Math.max(0, ...tileZ, ...elementZ) + 1;
}

function clampZIndex(value: number) {
  return Math.max(1, value);
}

function normalizeDashboard(dashboard: DashboardDraft): DashboardDraft {
  return {
    ...dashboard,
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
          breakBy: variableSet.breakBy ?? (defaultBreakBy.id as BreakById),
          metric: variableSet.metric ?? defaultQuestion.defaultMetric,
          chartType: variableSet.chartType ?? (defaultQuestion.allowedChartTypes.find((item) => item !== "table") ?? "table"),
          weight: variableSet.weight ?? defaultDataset.defaultWeight,
          filterField: variableSet.filterField ?? (defaultFilterDimension?.id ?? null),
          filterValue: variableSet.filterValue ?? "all"
        })) ?? seedVariableSets()
    },
    pages: dashboard.pages.map((page) => ({
          ...page,
          ...defaultPageDesign(),
          ...page,
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

type LayerItem =
  | { id: string; type: "tile"; name: string; hidden: boolean; locked: boolean; zIndex: number }
  | { id: string; type: "element"; name: string; hidden: boolean; locked: boolean; zIndex: number };

export default function App() {
  const designModalRef = useRef<HTMLDivElement | null>(null);
  const [dashboard, setDashboardState] = useState<DashboardDraft>(() => {
    try {
      const savedDashboard = window.localStorage.getItem(storageKey);
      return savedDashboard ? normalizeDashboard(JSON.parse(savedDashboard) as DashboardDraft) : initialDashboard;
    } catch {
      return initialDashboard;
    }
  });
  const [history, setHistory] = useState<DashboardDraft[]>([]);
  const [future, setFuture] = useState<DashboardDraft[]>([]);
  const [saveState, setSaveState] = useState("Saved locally");
  const [activePageId, setActivePageId] = useState("page_overview");
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [selectedChartPartId, setSelectedChartPartId] = useState<string>("all");
  const [leftPanelView, setLeftPanelView] = useState<"pages" | "layers" | "insert" | "data">("pages");
  const [settingsView, setSettingsView] = useState<"home" | "page" | "layout" | "element" | "chart" | "container">("home");
  const [designModal, setDesignModal] = useState<DesignModal>(null);
  const [canvasZoom, setCanvasZoom] = useState(85);
  const [selectedDataSource, setSelectedDataSource] = useState<{ kind: "question" | "variableSet"; id: string }>({
    kind: "variableSet",
    id: initialDashboard.analysisLibrary.variableSets[0]?.id ?? defaultQuestion.id
  });
  const [question, setQuestion] = useState<QuestionId>(defaultQuestion.id);
  const [breakBy, setBreakBy] = useState<BreakById>(defaultBreakBy.id as BreakById);
  const [metric, setMetric] = useState<Metric>(defaultQuestion.defaultMetric);
  const [chartType, setChartType] = useState<ChartType>(defaultQuestion.allowedChartTypes.find((item) => item !== "table") ?? "table");
  const [weight, setWeight] = useState<WeightId | null>(defaultDataset.defaultWeight);
  const [filterField, setFilterField] = useState<FilterFieldId | null>(defaultFilterDimension?.id ?? null);
  const [filterValue, setFilterValue] = useState("all");
  const [variableSetDraftName, setVariableSetDraftName] = useState(defaultQuestion.shortLabel);
  const [variableSetDescription, setVariableSetDescription] = useState("");
  const [variableSetQuestionIds, setVariableSetQuestionIds] = useState<QuestionId[]>([defaultQuestion.id]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedQuestion = useMemo(() => {
    return defaultDataset.questions.find((item) => item.id === question) ?? defaultQuestion;
  }, [question]);
  const savedVariableSets = dashboard.analysisLibrary.variableSets;
  const selectedVariableSet = selectedDataSource.kind === "variableSet" ? savedVariableSets.find((item) => item.id === selectedDataSource.id) ?? null : null;

  const sortedPages = [...dashboard.pages].sort((a, b) => a.order - b.order);
  const activePage = sortedPages.find((page) => page.id === activePageId) ?? sortedPages[0];
  const selectedTile = activePage?.tiles.find((tile) => tile.id === selectedTileId) ?? null;
  const selectedElement = activePage?.elements.find((element) => element.id === selectedElementId) ?? null;
  const selectedFilterDimension = filterField ? filterDimensions.find((item) => item.id === filterField) : undefined;
  const selectedChartTypes = selectedQuestion.allowedChartTypes.filter((item) => item !== "table");
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

  const query: AnalyticsQueryRequest = {
    dataset: defaultDataset.id,
    question,
    breakBy,
    filters: filterField && filterValue !== "all" ? [{ field: filterField, values: [filterValue] }] : [],
    weight,
    metric,
    chartType,
    confidenceLevel: 0.95
  };

  function applyQuestionSelection(nextQuestion: typeof defaultDataset.questions[number], sourceId = nextQuestion.id) {
    setSelectedDataSource({ kind: "question", id: sourceId });
    setQuestion(nextQuestion.id);
    setBreakBy(nextQuestion.allowedBreakBys[0]);
    setMetric(nextQuestion.defaultMetric);
    setChartType(nextQuestion.allowedChartTypes.find((item) => item !== "table") ?? "table");
    setWeight(defaultDataset.defaultWeight);
    setFilterField(defaultFilterDimension?.id ?? null);
    setFilterValue("all");
    setVariableSetDraftName(nextQuestion.shortLabel);
    setVariableSetDescription(`Saved view for ${nextQuestion.shortLabel}`);
    setVariableSetQuestionIds([nextQuestion.id]);
  }

  function applyVariableSetSelection(variableSet: SavedVariableSet) {
    const nextQuestion = defaultDataset.questions.find((item) => item.id === variableSet.primaryQuestionId) ?? defaultQuestion;
    setSelectedDataSource({ kind: "variableSet", id: variableSet.id });
    setQuestion(nextQuestion.id);
    setBreakBy(nextQuestion.allowedBreakBys.includes(variableSet.breakBy) ? variableSet.breakBy : nextQuestion.allowedBreakBys[0]);
    setMetric(nextQuestion.allowedMetrics.includes(variableSet.metric) ? variableSet.metric : nextQuestion.defaultMetric);
    setChartType(nextQuestion.allowedChartTypes.includes(variableSet.chartType) ? variableSet.chartType : nextQuestion.allowedChartTypes.find((item) => item !== "table") ?? "table");
    setWeight(variableSet.weight);
    setFilterField(variableSet.filterField);
    setFilterValue(variableSet.filterValue);
    setVariableSetDraftName(variableSet.label);
    setVariableSetDescription(variableSet.description);
    setVariableSetQuestionIds(variableSet.questionIds);
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
      breakBy,
      metric,
      chartType,
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
          setChartType(nextQuestion.allowedChartTypes.find((item) => item !== "table") ?? "table");
        }
        return next;
      }

      return [...current, questionId];
    });
  }

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(dashboard));
    setSaveState("Saved locally");
  }, [dashboard]);

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
    setIsLoading(true);
    setError(null);

    try {
      const response = await runAnalyticsQuery(query);
      const sourceLabel = selectedVariableSet?.label ?? selectedQuestion.shortLabel;
      const tile: DashboardTile = {
        id: makeTileId(),
        name: sourceLabel,
        title: sourceLabel,
        locked: false,
        hidden: false,
        layout: { x: 48, y: 72 + activePage.tiles.length * 28, width: 760, height: 460, zIndex: nextZIndex(activePage) },
        query,
        visualization: chartType,
        appearance: { ...defaultAppearance, palette: [...defaultAppearance.palette] },
        result: response
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
      exportType: "powerpoint-ready-dashboard-spec",
      generatedAt: new Date().toISOString(),
      canvas: {
        width: canvasWidth,
        height: canvasHeight
      },
      dashboard
    };
    const blob = new Blob([JSON.stringify(exportSpec, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${dashboard.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "ecofocus-dashboard"}-ppt-spec.json`;
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

  function addPage() {
    const page: DashboardPage = {
      id: makePageId(),
      title: `Page ${dashboard.pages.length + 1}`,
      order: dashboard.pages.length + 1,
      ...defaultPageDesign(),
      elements: [],
      tiles: []
    };

    setDashboard((current) => ({ ...current, status: "draft", pages: [...current.pages, page] }));
    setActivePageId(page.id);
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

  return (
    <main className="builder-shell">
      <header className="builder-header">
        <div className="top-nav">
          <span className="app-mark">EF</span>
          <button type="button">File</button>
          <button type="button">Resize</button>
          <button type="button">Editing</button>
        </div>
        <h1>{dashboard.title}</h1>
        <div className="publish-controls">
          <span className="save-state">{saveState}</span>
          <button type="button" className="secondary" onClick={undo} disabled={history.length === 0}>
            Undo
          </button>
          <button type="button" className="secondary" onClick={redo} disabled={future.length === 0}>
            Redo
          </button>
          <button type="button" className="secondary" onClick={duplicateSelectedItem} disabled={!selectedTile && !selectedElement}>
            Duplicate
          </button>
          <button type="button" className="secondary" onClick={deleteSelectedItem} disabled={!selectedTile && !selectedElement}>
            Delete
          </button>
          <button type="button" className="secondary" onClick={resetDashboard}>
            Reset
          </button>
          <button type="button" className="secondary" onClick={exportDashboardSpec}>
            Export spec
          </button>
          <span className={dashboard.status === "published" ? "status published" : "status"}>{dashboard.status}</span>
          <button type="button" onClick={() => setDashboard((current) => ({ ...current, status: current.status === "published" ? "draft" : "published" }))}>
            {dashboard.status === "published" ? "Unpublish" : "Publish"}
          </button>
        </div>
      </header>

      <section className="builder-workspace">
        <nav className="tool-rail" aria-label="Design tools">
          <button type="button" className={leftPanelView === "pages" ? "active" : ""} onClick={() => setLeftPanelView("pages")}>
            <span>▦</span>
            Pages
          </button>
          <button type="button" className={leftPanelView === "insert" ? "active" : ""} onClick={() => setLeftPanelView("insert")}>
            <span>＋</span>
            Elements
          </button>
          <button type="button" className={leftPanelView === "data" ? "active" : ""} onClick={() => setLeftPanelView("data")}>
            <span>▥</span>
            Charts
          </button>
          <button type="button" className={leftPanelView === "layers" ? "active" : ""} onClick={() => setLeftPanelView("layers")}>
            <span>☰</span>
            Layers
          </button>
        </nav>
        <aside className="panel controls" aria-label="Data controls">
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
              <button type="button" className="secondary" onClick={addPage}>
                New page
              </button>
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

                <div className="explorer-section-card">
                  <div className="explorer-section-header">
                    <strong>Variable sets</strong>
                    <small>{savedVariableSets.length} saved</small>
                  </div>
                  <div className="explorer-item-list">
                    {savedVariableSets.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        className={selectedDataSource.kind === "variableSet" && selectedDataSource.id === item.id ? "explorer-item active" : "explorer-item"}
                        onClick={() => applyVariableSetSelection(item)}
                      >
                        <strong>{item.label}</strong>
                        <span>{item.topic}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="explorer-section-card">
                  <div className="explorer-section-header">
                    <strong>Questions</strong>
                    <small>{defaultDataset.questions.length} available</small>
                  </div>
                  <div className="explorer-item-list">
                    {defaultDataset.questions.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        className={selectedDataSource.kind === "question" && selectedDataSource.id === item.id ? "explorer-item active" : "explorer-item"}
                        onClick={() => applyQuestionSelection(item)}
                      >
                        <strong>{item.shortLabel}</strong>
                        <span>{item.topic}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="explorer-section-card">
                  <div className="explorer-section-header">
                    <strong>Authoring</strong>
                    <small>Current analysis object</small>
                  </div>
                  <div className="color-summary-card">
                    <div>
                      <span>Selected source</span>
                      <strong>{selectedVariableSet ? selectedVariableSet.label : selectedQuestion.shortLabel}</strong>
                    </div>
                    <small>{selectedVariableSet ? selectedVariableSet.description : selectedQuestion.topic}</small>
                  </div>
                  <label>
                    Save as variable set
                    <input value={variableSetDraftName} onChange={(event) => setVariableSetDraftName(event.target.value)} placeholder="Name this saved set" />
                  </label>
                  <label>
                    Description
                    <input value={variableSetDescription} onChange={(event) => setVariableSetDescription(event.target.value)} placeholder="Describe this variable set" />
                  </label>
                  <label>
                    Primary question
                    <select value={question} onChange={(event) => setQuestion(event.target.value as QuestionId)}>
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
                  <div className="compact-grid">
                    <button type="button" className="secondary" onClick={() => saveCurrentVariableSet(!selectedVariableSet)}>
                      {selectedVariableSet ? "Update set" : "Save set"}
                    </button>
                    <button type="button" className="secondary" disabled={!selectedVariableSet} onClick={() => selectedVariableSet && deleteVariableSet(selectedVariableSet.id)}>
                      Delete set
                    </button>
                  </div>
                  {!selectedVariableSet && (
                    <button type="button" className="secondary" onClick={() => saveCurrentVariableSet(true)}>
                      Save as new set
                    </button>
                  )}
                </div>

                <div className="explorer-section-card">
                  <div className="explorer-section-header">
                    <strong>Build tile</strong>
                    <small>Query-driven output</small>
                  </div>
                  <label>
                    Banner
                    <select value={breakBy} onChange={(event) => setBreakBy(event.target.value as BreakById)}>
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
                  <label>
                    Chart type
                    <select value={chartType} onChange={(event) => setChartType(event.target.value as ChartType)}>
                      {selectedChartTypes.map((item) => (
                        <option value={item} key={item}>
                          {defaultDataset.chartTypes.find((chartItem) => chartItem.id === item)?.label ?? item}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="button" onClick={addTileFromQuery} disabled={isLoading}>
                    {isLoading ? "Adding..." : "Add tile from source"}
                  </button>
                </div>
              </div>
              {error && <div className="error">{error}</div>}
              </>
              )}
            </>
          )}
        </aside>

        <section className="canvas" aria-label="Dashboard canvas">
          <div className="page-header">
            <div>
              <p className="eyebrow">Page {activePage.order}</p>
              <h2>{activePage.title}</h2>
            </div>
            <div className="canvas-toolbar">
              <span>{activePage.tiles.length + activePage.elements.length} element{activePage.tiles.length + activePage.elements.length === 1 ? "" : "s"}</span>
              <div className="zoom-control" aria-label="Canvas zoom">
                <button type="button" className="mini-button" onClick={() => updateCanvasZoom(canvasZoom - 10)}>-</button>
                <input type="range" min="35" max="160" step="5" value={canvasZoom} style={{ "--range-fill": rangeFill(canvasZoom, 35, 160) } as React.CSSProperties} onChange={(event) => updateCanvasZoom(Number(event.target.value))} />
                <button type="button" className="mini-button" onClick={() => updateCanvasZoom(canvasZoom + 10)}>+</button>
                <strong>{canvasZoom}%</strong>
              </div>
            </div>
          </div>
          <div className="floating-format-bar" aria-label="Quick actions">
            <button type="button" onClick={() => setSettingsView("page")}>Design</button>
            <span />
            <button type="button" onClick={() => setSettingsView("layout")} disabled={!selectedTile && !selectedElement}>Position</button>
            <button type="button" onClick={() => changeSelectedLayer("front")} disabled={!selectedTile && !selectedElement}>Front</button>
            <button type="button" onClick={duplicateSelectedItem} disabled={!selectedTile && !selectedElement}>Duplicate</button>
            <button type="button" onClick={deleteSelectedItem} disabled={!selectedTile && !selectedElement}>Delete</button>
          </div>
          <div className="canvas-viewport">
            <div className="canvas-zoom-shell" style={{ width: canvasWidth * canvasScale, height: canvasHeight * canvasScale }}>
              <div
                className="freeform-canvas"
                onClick={(event) => {
                  if (event.currentTarget === event.target) {
                    selectPage();
                  }
                }}
                style={{
                  width: canvasWidth,
                  height: canvasHeight,
                  background: canvasBackground(activePage),
                  backgroundSize: canvasBackgroundSize(activePage),
                  backgroundRepeat: canvasBackgroundRepeat(activePage),
                  backgroundPosition: canvasBackgroundPosition(activePage),
                  transform: `scale(${canvasScale})`
                }}
              >
                {activePage.tiles.length === 0 && activePage.elements.length === 0 && (
                  <div className="empty-state">Add charts, tables, text, shapes, or images to start building this page.</div>
                )}
                {activePage.elements.filter((element) => !element.hidden).map((element) => (
                  <Rnd
                    key={element.id}
                    bounds="parent"
                    scale={canvasScale}
                    size={{ width: element.layout.width, height: element.layout.height }}
                    position={{ x: element.layout.x, y: element.layout.y }}
                    style={{ zIndex: element.layout.zIndex }}
                    dragGrid={activePage.snapToGrid ? [activePage.gridSize, activePage.gridSize] : undefined}
                    resizeGrid={activePage.snapToGrid ? [activePage.gridSize, activePage.gridSize] : undefined}
                    disableDragging={element.locked}
                    enableResizing={!element.locked}
                    onDragStart={() => {
                      selectElement(element.id);
                    }}
                    onDragStop={(_, data) => updateElementLayout(element.id, { x: data.x, y: data.y })}
                    onResizeStop={(_, __, ref, ___, position) =>
                      updateElementLayout(element.id, {
                        width: ref.offsetWidth,
                        height: ref.offsetHeight,
                        x: position.x,
                        y: position.y
                      })
                    }
                  >
                    <CanvasElementRenderer
                      element={element}
                      selected={element.id === selectedElementId}
                      onSelect={() => {
                        selectElement(element.id);
                      }}
                    />
                  </Rnd>
                ))}
                {activePage.tiles.filter((tile) => !tile.hidden).map((tile) => (
                  <Rnd
                    key={tile.id}
                    bounds="parent"
                    scale={canvasScale}
                    dragHandleClassName="tile-drag-handle"
                    minWidth={320}
                    minHeight={220}
                    size={{ width: tile.layout.width, height: tile.layout.height }}
                    position={{ x: tile.layout.x, y: tile.layout.y }}
                    style={{ zIndex: tile.layout.zIndex }}
                    dragGrid={activePage.snapToGrid ? [activePage.gridSize, activePage.gridSize] : undefined}
                    resizeGrid={activePage.snapToGrid ? [activePage.gridSize, activePage.gridSize] : undefined}
                    disableDragging={tile.locked}
                    enableResizing={!tile.locked}
                    onDragStart={() => {
                      selectTile(tile.id);
                    }}
                    onDragStop={(_, data) => updateTileLayout(tile.id, { x: data.x, y: data.y })}
                    onResizeStop={(_, __, ref, ___, position) =>
                      updateTileLayout(tile.id, {
                        width: ref.offsetWidth,
                        height: ref.offsetHeight,
                        x: position.x,
                        y: position.y
                      })
                    }
                  >
                    <TileRenderer
                      tile={tile}
                      selected={tile.id === selectedTileId}
                      onSelect={() => {
                        selectTile(tile.id);
                      }}
                    />
                  </Rnd>
                ))}
              </div>
            </div>
          </div>
          <div className="page-strip" aria-label="Dashboard pages">
            {sortedPages.map((page) => (
              <button
                type="button"
                key={page.id}
                className={page.id === activePage.id ? "page-thumb active" : "page-thumb"}
                onClick={() => {
                  setActivePageId(page.id);
                  selectPage();
                }}
              >
                <span>{page.order}</span>
                <div>
                  <strong>{page.title}</strong>
                  <small>{page.tiles.length + page.elements.length} items</small>
                </div>
              </button>
            ))}
            <button type="button" className="page-thumb add" onClick={addPage}>+</button>
          </div>
        </section>

        <aside className="panel settings" aria-label="Tile settings">
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
          <button type="button" className="secondary" onClick={deleteActivePage} disabled={dashboard.pages.length <= 1}>
            Delete page
          </button>
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
              <label>
                Visualization
                <select
                  value={selectedTile.visualization}
                  onChange={(event) => {
                    const nextVisualization = event.target.value as ChartType;
                    updateSelectedTile({
                      visualization: nextVisualization,
                      query: { ...selectedTile.query, chartType: nextVisualization },
                      result: { ...selectedTile.result, query: { ...selectedTile.result.query, chartType: nextVisualization } }
                    });
                  }}
                >
                  {getCompatibleChartTypes(selectedTile.result).map((item) => (
                    <option value={item} key={item}>
                      {getChartTypeLabel(item)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="panel-title subtle">
                <h2>Display</h2>
              </div>
              <div className="toggle-list">
                <label><input type="checkbox" checked={selectedTile.appearance.showGrid} onChange={(event) => updateSelectedAppearance({ showGrid: event.target.checked })} /> Chart grid</label>
                <label><input type="checkbox" checked={selectedTile.appearance.showValueLabels} onChange={(event) => updateSelectedAppearance({ showValueLabels: event.target.checked })} /> Value labels</label>
                <label><input type="checkbox" checked={selectedTile.appearance.showAnnotations} onChange={(event) => updateSelectedAppearance({ showAnnotations: event.target.checked })} /> Arrows</label>
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
        </aside>
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
