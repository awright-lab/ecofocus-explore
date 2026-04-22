import { useEffect, useMemo, useState } from "react";
import { Rnd } from "react-rnd";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
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
import type { CanvasLayout, DashboardCanvasElement, DashboardCanvasElementType, DashboardDraft, DashboardPage, DashboardTile, TileAppearance } from "../shared/types/dashboard";

const defaultDataset = datasets[0];
const defaultQuestion = defaultDataset.questions.find((question) => question.id === defaultDataset.defaultQuestion) ?? defaultDataset.questions[0];
const bannerDimensions = getBannerDimensions(defaultDataset.id);
const filterDimensions = getFilterDimensions(defaultDataset.id);
const defaultBreakBy = bannerDimensions.find((dimension) => dimension.id === defaultDataset.defaultBreakBy) ?? bannerDimensions[0];
const defaultFilterDimension = filterDimensions[0];

const palettes = [
  { id: "forest", label: "Forest", colors: ["#39784d", "#6c9b4d", "#2d6f73", "#9a7a38", "#6f6697"] },
  { id: "ocean", label: "Ocean", colors: ["#1f6f8b", "#3b8ea5", "#5b7f95", "#74a7a0", "#4b6580"] },
  { id: "slate", label: "Slate", colors: ["#3d4a57", "#657483", "#8a775d", "#5d7a67", "#7a657c"] }
];

const defaultAppearance: TileAppearance = {
  primaryColor: palettes[0].colors[0],
  palette: palettes[0].colors,
  background: "#ffffff",
  backgroundMode: "solid",
  gradientFrom: "#ffffff",
  gradientTo: "#eef7ef",
  borderColor: "#dfe6dc",
  borderRadius: 8,
  opacity: 100,
  shadow: false,
  showGrid: true,
  gridColor: "#e6ebe4",
  axisColor: "#69776e",
  axisFontSize: 12,
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
  barStyles: {},
  showValueLabels: true,
  showTable: true,
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

function defaultPageDesign() {
  return {
    showCanvasGrid: true,
    snapToGrid: false,
    gridSize: defaultGridSize,
    background: "#ffffff",
    backgroundMode: "solid" as const,
    gradientFrom: "#ffffff",
    gradientTo: "#eef7ef"
  };
}

const initialDashboard: DashboardDraft = {
  id: "internal_mvp",
  title: "2025 EcoFocus Builder Draft",
  status: "draft",
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
    textColor: "#17211b",
    borderColor: "#438757",
    borderWidth: type === "rectangle" || type === "circle" ? 2 : 1,
    borderStyle: "solid",
    borderRadius: type === "rectangle" ? 8 : 0,
    opacity: 100,
    shadow: false,
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

function backgroundStyle(mode: "solid" | "gradient", solid: string, gradientFrom: string, gradientTo: string) {
  return mode === "gradient" ? `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` : solid;
}

function canvasBackground(page: DashboardPage) {
  const pageBackground = backgroundStyle(page.backgroundMode, page.background, page.gradientFrom, page.gradientTo);

  if (!page.showCanvasGrid) return pageBackground;

  return `linear-gradient(#eef3eb 1px, transparent 1px), linear-gradient(90deg, #eef3eb 1px, transparent 1px), ${pageBackground}`;
}

function getBarStyle(appearance: TileAppearance, id: string, fallbackColor: string) {
  return {
    color: appearance.barStyles[id]?.color ?? fallbackColor,
    fillMode: appearance.barStyles[id]?.fillMode ?? appearance.barFillMode,
    gradientTo: appearance.barStyles[id]?.gradientTo ?? appearance.barGradientTo,
    radius: appearance.barStyles[id]?.radius ?? appearance.barRadius
  };
}

function gradientId(tileId: string, key: string) {
  return `gradient_${tileId.replace(/[^a-zA-Z0-9]/g, "_")}_${key.replace(/[^a-zA-Z0-9]/g, "_")}`;
}

function formatValue(value: number, format: AnalyticsQueryResponse["metric"]["valueFormat"]) {
  return format === "percent" ? `${value}%` : value.toLocaleString();
}

function getAnnotation(annotations: AnalyticsAnnotation[], rowId: string, columnId: string) {
  return annotations.find((annotation) => annotation.rowId === rowId && annotation.columnId === columnId);
}

function DirectionMarker({ annotation, enabled }: { annotation?: AnalyticsAnnotation; enabled: boolean }) {
  if (!annotation || !enabled) return null;

  return (
    <span className={annotation.direction === "up" ? "direction direction-up" : "direction direction-down"}>
      {annotation.direction === "up" ? "↑" : "↓"}
    </span>
  );
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

function VerticalBarChartView({ tile }: { tile: DashboardTile }) {
  const { result, appearance } = tile;
  const column = result.columns[0];
  const chartData = result.table.map((row) => ({
    optionId: row.optionId,
    label: row.label,
    value: row.values[column.id],
    base: row.bases[column.id]
  }));

  return (
    <div className="chart-card" aria-label="Query-driven vertical bar chart">
      <ResponsiveContainer width="100%" height={390}>
        <BarChart data={chartData} margin={{ top: 32, right: 20, left: 8, bottom: 92 }} barCategoryGap={appearance.barCategoryGap} barGap={appearance.barGap}>
          <defs>
            {chartData.map((item, index) => {
              const fallback = appearance.palette[index % appearance.palette.length] ?? appearance.primaryColor;
              const style = getBarStyle(appearance, item.optionId, fallback);
              return (
                <linearGradient id={gradientId(tile.id, item.optionId)} key={item.optionId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={style.color} />
                  <stop offset="100%" stopColor={style.gradientTo} />
                </linearGradient>
              );
            })}
          </defs>
          {appearance.showGrid && <CartesianGrid stroke={appearance.gridColor} vertical={false} />}
          <XAxis dataKey="label" interval={0} tick={{ fill: appearance.axisColor, fontSize: appearance.axisFontSize }} tickLine={false} height={94} />
          <YAxis tick={{ fill: appearance.axisColor, fontSize: appearance.axisFontSize }} tickLine={false} axisLine={false} />
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
    ...row.values
  }));

  return (
    <div className="chart-card" aria-label="Query-driven grouped bar chart">
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={chartData} margin={{ top: 20, right: 20, left: 8, bottom: 84 }} barCategoryGap={appearance.barCategoryGap} barGap={appearance.barGap}>
          <defs>
            {result.columns.map((column, index) => {
              const fallback = appearance.palette[index % appearance.palette.length] ?? appearance.primaryColor;
              const style = getBarStyle(appearance, column.id, fallback);
              return (
                <linearGradient id={gradientId(tile.id, column.id)} key={column.id} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={style.color} />
                  <stop offset="100%" stopColor={style.gradientTo} />
                </linearGradient>
              );
            })}
          </defs>
          {appearance.showGrid && <CartesianGrid stroke={appearance.gridColor} vertical={false} />}
          <XAxis dataKey="label" interval={0} tick={{ fill: appearance.axisColor, fontSize: appearance.axisFontSize }} tickLine={false} height={88} />
          <YAxis tick={{ fill: appearance.axisColor, fontSize: appearance.axisFontSize }} tickLine={false} axisLine={false} />
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

function ChartView({ tile }: { tile: DashboardTile }) {
  if (tile.visualization === "vertical_bar") return <VerticalBarChartView tile={tile} />;
  if (tile.visualization === "grouped_bar") return <GroupedBarChartView tile={tile} />;
  return null;
}

function ResultsTable({ result, appearance }: { result: AnalyticsQueryResponse; appearance: TileAppearance }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Answer</th>
            {result.columns.map((column) => (
              <th key={column.id}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.table.map((row) => (
            <tr key={row.optionId}>
              <th>{row.label}</th>
              {result.columns.map((column) => (
                <td key={column.id}>
                  <strong>
                    {formatValue(row.values[column.id], result.metric.valueFormat)}
                    <DirectionMarker annotation={getAnnotation(result.annotations, row.optionId, column.id)} enabled={appearance.showAnnotations} />
                  </strong>
                  {appearance.showBases && <span>Base {row.bases[column.id]}</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TileRenderer({ tile, selected, onSelect }: { tile: DashboardTile; selected: boolean; onSelect: () => void }) {
  const result = tile.result;

  return (
    <article
      className={selected ? "dashboard-tile selected" : "dashboard-tile"}
      style={{
        background: backgroundStyle(tile.appearance.backgroundMode, tile.appearance.background, tile.appearance.gradientFrom, tile.appearance.gradientTo),
        borderColor: tile.appearance.borderColor,
        borderRadius: tile.appearance.borderRadius,
        opacity: tile.appearance.opacity / 100,
        boxShadow: tile.appearance.shadow ? "0 18px 36px rgba(20, 32, 25, 0.18)" : undefined
      }}
      onClick={onSelect}
    >
      <div className="tile-header">
        <div>
          <p className="eyebrow">{result.metadataRefs.question}</p>
          <h2>{tile.title}</h2>
        </div>
        <code>{tile.visualization}</code>
      </div>
      {tile.visualization === "table" ? <ResultsTable result={result} appearance={tile.appearance} /> : <ChartView tile={tile} />}
      {tile.appearance.showTable && tile.visualization !== "table" && <ResultsTable result={result} appearance={tile.appearance} />}
      <div className="footnote">{result.weighting.applied ? result.weighting.label : "Unweighted"} · {result.metric.label}</div>
      {tile.appearance.showNotes && (
        <div className="notes">
          {result.notes.map((note) => (
            <p key={note}>{note}</p>
          ))}
        </div>
      )}
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
          boxShadow: element.style.shadow ? "0 18px 36px rgba(20, 32, 25, 0.18)" : undefined
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
          background: backgroundStyle(element.style.fillMode, element.style.fill, element.style.gradientFrom, element.style.gradientTo),
          borderColor: element.style.borderColor,
          borderWidth: element.style.borderWidth,
          borderStyle: element.style.borderStyle,
          borderRadius: element.style.borderRadius,
          opacity: element.style.opacity / 100,
          boxShadow: element.style.shadow ? "0 18px 36px rgba(20, 32, 25, 0.18)" : undefined
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
        background: backgroundStyle(element.style.fillMode, element.style.fill, element.style.gradientFrom, element.style.gradientTo),
        borderColor: element.style.borderColor,
        borderWidth: element.style.borderWidth,
        borderStyle: element.style.borderStyle,
        borderRadius: element.type === "circle" ? 999 : element.style.borderRadius,
        opacity: element.style.opacity / 100,
        boxShadow: element.style.shadow ? "0 18px 36px rgba(20, 32, 25, 0.18)" : undefined
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
    pages: dashboard.pages.map((page) => ({
      ...page,
      ...defaultPageDesign(),
      ...page,
      elements: page.elements.map((element) => ({
        ...element,
        name: element.name ?? (element.type === "text" ? "Text" : element.type === "image" ? "Image" : element.type === "circle" ? "Circle" : "Rectangle"),
        locked: element.locked ?? false,
        hidden: element.hidden ?? false,
        style: {
          ...defaultElementStyle(element.type),
          ...element.style
        }
      })),
      tiles: page.tiles.map((tile) => ({
        ...tile,
        name: tile.name ?? tile.title,
        locked: tile.locked ?? false,
        hidden: tile.hidden ?? false
      }))
    }))
  };
}

type LayerItem =
  | { id: string; type: "tile"; name: string; hidden: boolean; locked: boolean; zIndex: number }
  | { id: string; type: "element"; name: string; hidden: boolean; locked: boolean; zIndex: number };

export default function App() {
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
  const [canvasZoom, setCanvasZoom] = useState(85);
  const [question, setQuestion] = useState<QuestionId>(defaultQuestion.id);
  const [breakBy, setBreakBy] = useState<BreakById>(defaultBreakBy.id as BreakById);
  const [metric, setMetric] = useState<Metric>(defaultQuestion.defaultMetric);
  const [viewMode, setViewMode] = useState<"chart" | "table">("chart");
  const [chartType, setChartType] = useState<ChartType>(defaultQuestion.allowedChartTypes.find((item) => item !== "table") ?? "table");
  const [weight, setWeight] = useState<WeightId | null>(defaultDataset.defaultWeight);
  const [filterField] = useState<FilterFieldId | null>(defaultFilterDimension?.id ?? null);
  const [filterValue, setFilterValue] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedQuestion = useMemo(() => {
    return defaultDataset.questions.find((item) => item.id === question) ?? defaultQuestion;
  }, [question]);

  const sortedPages = [...dashboard.pages].sort((a, b) => a.order - b.order);
  const activePage = sortedPages.find((page) => page.id === activePageId) ?? sortedPages[0];
  const selectedTile = activePage?.tiles.find((tile) => tile.id === selectedTileId) ?? null;
  const selectedElement = activePage?.elements.find((element) => element.id === selectedElementId) ?? null;
  const selectedFilterDimension = filterField ? filterDimensions.find((item) => item.id === filterField) : undefined;
  const selectedChartTypes = selectedQuestion.allowedChartTypes.filter((item) => item !== "table");
  const activeChartType = viewMode === "table" ? "table" : chartType;
  const chartStyleTargets =
    selectedTile?.visualization === "vertical_bar"
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
    chartType: activeChartType
  };

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(dashboard));
    setSaveState("Saved locally");
  }, [dashboard]);

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
      const tile: DashboardTile = {
        id: makeTileId(),
        name: selectedQuestion.shortLabel,
        title: selectedQuestion.shortLabel,
        locked: false,
        hidden: false,
        layout: { x: 48, y: 72 + activePage.tiles.length * 28, width: 760, height: activeChartType === "table" ? 360 : 560, zIndex: nextZIndex(activePage) },
        query,
        visualization: activeChartType,
        appearance: { ...defaultAppearance, palette: [...defaultAppearance.palette] },
        result: response
      };

      setDashboard((current) => ({
        ...current,
        status: "draft",
        pages: current.pages.map((page) => (page.id === activePage.id ? { ...page, tiles: [...page.tiles, tile] } : page))
      }));
      setSelectedTileId(tile.id);
      setSelectedElementId(null);
      setSelectedChartPartId("all");
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
      setSelectedTileId(item.id);
      setSelectedElementId(null);
    } else {
      setSelectedElementId(item.id);
      setSelectedTileId(null);
    }

    setSelectedChartPartId("all");
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
    setSelectedElementId(element.id);
    setSelectedTileId(null);
    setSelectedChartPartId("all");
  }

  function updateSelectedAppearance(updates: Partial<TileAppearance>) {
    if (!selectedTile) return;
    updateSelectedTile({ appearance: { ...selectedTile.appearance, ...updates } });
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
    setSelectedTileId(null);
    setSelectedElementId(null);
    setSelectedChartPartId("all");
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
      setSelectedTileId(duplicate.id);
      setSelectedElementId(null);
      setSelectedChartPartId("all");
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
      setSelectedElementId(duplicate.id);
      setSelectedTileId(null);
      setSelectedChartPartId("all");
    }
  }

  function resetDashboard() {
    setDashboard(initialDashboard);
    setActivePageId("page_overview");
    setSelectedTileId(null);
    setSelectedElementId(null);
    setSelectedChartPartId("all");
    setSettingsView("home");
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
                      setSelectedTileId(null);
                      setSelectedElementId(null);
                      setSelectedChartPartId("all");
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
                <h2>Data</h2>
              </div>
              <label>
                Variable set
                <select
                  value={question}
                  onChange={(event) => {
                    const nextQuestion = defaultDataset.questions.find((item) => item.id === event.target.value) ?? defaultQuestion;
                    setQuestion(nextQuestion.id);
                    setBreakBy(nextQuestion.allowedBreakBys[0]);
                    setMetric(nextQuestion.defaultMetric);
                    setChartType(nextQuestion.allowedChartTypes.find((item) => item !== "table") ?? "table");
                  }}
                >
                  {defaultDataset.questions.map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.shortLabel}
                    </option>
                  ))}
                </select>
                <span>{selectedQuestion.topic}</span>
              </label>
              <label>
                Columns
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
              {selectedFilterDimension && (
            <label>
              Filter
              <select value={filterValue} onChange={(event) => setFilterValue(event.target.value)}>
                <option value="all">All {selectedFilterDimension.label.toLowerCase()}s</option>
                {selectedFilterDimension.values.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
              )}
              <div className="segmented" aria-label="View mode">
                <button type="button" className={viewMode === "chart" ? "active" : ""} onClick={() => setViewMode("chart")}>
                  Chart
                </button>
                <button type="button" className={viewMode === "table" ? "active" : ""} onClick={() => setViewMode("table")}>
                  Table
                </button>
              </div>
              {viewMode === "chart" && (
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
              )}
              <button type="button" onClick={addTileFromQuery} disabled={isLoading}>
                {isLoading ? "Adding..." : "Add tile"}
              </button>
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
                <input type="range" min="35" max="160" step="5" value={canvasZoom} onChange={(event) => updateCanvasZoom(Number(event.target.value))} />
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
                style={{
                  width: canvasWidth,
                  height: canvasHeight,
                  background: canvasBackground(activePage),
                  backgroundSize: activePage.showCanvasGrid ? `${activePage.gridSize}px ${activePage.gridSize}px` : undefined,
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
                      setSelectedElementId(element.id);
                      setSelectedTileId(null);
                      setSelectedChartPartId("all");
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
                        setSelectedElementId(element.id);
                        setSelectedTileId(null);
                        setSelectedChartPartId("all");
                      }}
                    />
                  </Rnd>
                ))}
                {activePage.tiles.filter((tile) => !tile.hidden).map((tile) => (
                  <Rnd
                    key={tile.id}
                    bounds="parent"
                    scale={canvasScale}
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
                      setSelectedTileId(tile.id);
                      setSelectedElementId(null);
                      setSelectedChartPartId("all");
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
                        setSelectedTileId(tile.id);
                        setSelectedElementId(null);
                        setSelectedChartPartId("all");
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
                  setSelectedTileId(null);
                  setSelectedElementId(null);
                  setSelectedChartPartId("all");
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
                <h2>{settingsView === "page" ? "Page" : settingsView === "layout" ? "Arrange" : settingsView === "container" ? "Container" : selectedElement ? "Element" : "Tile"}</h2>
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
          <label>
            Page background
            <select
              value={activePage.backgroundMode}
              onChange={(event) => updateActivePage({ backgroundMode: event.target.value as "solid" | "gradient" })}
            >
              <option value="solid">Solid</option>
              <option value="gradient">Gradient</option>
            </select>
          </label>
          {activePage.backgroundMode === "solid" ? (
            <label>
              Background
              <input type="color" value={activePage.background} onChange={(event) => updateActivePage({ background: event.target.value })} />
            </label>
          ) : (
            <>
              <label>
                Gradient start
                <input type="color" value={activePage.gradientFrom} onChange={(event) => updateActivePage({ gradientFrom: event.target.value })} />
              </label>
              <label>
                Gradient end
                <input type="color" value={activePage.gradientTo} onChange={(event) => updateActivePage({ gradientTo: event.target.value })} />
              </label>
            </>
          )}
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
                <>
                  <label>
                    Gradient start
                    <input
                      type="color"
                      value={selectedElement.style.gradientFrom}
                      onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, gradientFrom: event.target.value } })}
                    />
                  </label>
                  <label>
                    Gradient end
                    <input
                      type="color"
                      value={selectedElement.style.gradientTo}
                      onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, gradientTo: event.target.value } })}
                    />
                  </label>
                </>
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
                      onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, opacity: Number(event.target.value) } })}
                    />
                  </label>
                  <div className="toggle-list">
                    <label>
                      <input
                        type="checkbox"
                        checked={selectedElement.style.shadow}
                        onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, shadow: event.target.checked } })}
                      /> Shadow
                    </label>
                  </div>
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
          ) : (
            <>
              <label>
                Layer name
                <input value={selectedTile.name} onChange={(event) => updateSelectedTile({ name: event.target.value })} />
              </label>
              <label>
                Title
                <input value={selectedTile.title} onChange={(event) => updateSelectedTile({ title: event.target.value })} />
              </label>
              <label>
                Visualization
                <select value={selectedTile.visualization} onChange={(event) => updateSelectedTile({ visualization: event.target.value as ChartType })}>
                  {selectedTile.result.query.question === "Q15_TOP2_BRAND_PRIORITIES" && <option value="vertical_bar">Vertical bar</option>}
                  {selectedTile.result.query.breakBy !== "SUMMARY" && <option value="grouped_bar">Grouped bar</option>}
                  <option value="table">Table</option>
                </select>
              </label>
              <label>
                Palette
                <select
                  value={palettes.find((palette) => palette.colors.join(",") === selectedTile.appearance.palette.join(","))?.id ?? "custom"}
                  onChange={(event) => {
                    const nextPalette = palettes.find((palette) => palette.id === event.target.value) ?? palettes[0];
                    updateSelectedAppearance({ palette: nextPalette.colors, primaryColor: nextPalette.colors[0] });
                  }}
                >
                  {palettes.map((palette) => (
                    <option key={palette.id} value={palette.id}>
                      {palette.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Primary color
                <input type="color" value={selectedTile.appearance.primaryColor} onChange={(event) => updateSelectedAppearance({ primaryColor: event.target.value, palette: [event.target.value, ...selectedTile.appearance.palette.slice(1)] })} />
              </label>
              {selectedTile.visualization !== "table" && (
                <>
                  <div className="panel-title subtle">
                    <h2>Chart Design</h2>
                  </div>
                  <label>
                    Style target
                    <select value={selectedChartPartId} onChange={(event) => setSelectedChartPartId(event.target.value)}>
                      <option value="all">All bars</option>
                      {chartStyleTargets.map((target) => (
                        <option key={target.id} value={target.id}>
                          {target.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Bar fill
                    <select
                      value={selectedChartPart ? getBarStyle(selectedTile.appearance, selectedChartPart.id, selectedTile.appearance.primaryColor).fillMode : selectedTile.appearance.barFillMode}
                      onChange={(event) =>
                        selectedChartPart
                          ? updateSelectedBarStyle({ fillMode: event.target.value as "solid" | "gradient" })
                          : updateSelectedAppearance({ barFillMode: event.target.value as "solid" | "gradient" })
                      }
                    >
                      <option value="solid">Solid</option>
                      <option value="gradient">Gradient</option>
                    </select>
                  </label>
                  <label>
                    Bar color
                    <input
                      type="color"
                      value={selectedChartPart ? getBarStyle(selectedTile.appearance, selectedChartPart.id, selectedTile.appearance.primaryColor).color : selectedTile.appearance.primaryColor}
                      onChange={(event) =>
                        selectedChartPart
                          ? updateSelectedBarStyle({ color: event.target.value })
                          : updateSelectedAppearance({ primaryColor: event.target.value, palette: [event.target.value, ...selectedTile.appearance.palette.slice(1)] })
                      }
                    />
                  </label>
                  <label>
                    Bar gradient end
                    <input
                      type="color"
                      value={selectedChartPart ? getBarStyle(selectedTile.appearance, selectedChartPart.id, selectedTile.appearance.primaryColor).gradientTo : selectedTile.appearance.barGradientTo}
                      onChange={(event) =>
                        selectedChartPart ? updateSelectedBarStyle({ gradientTo: event.target.value }) : updateSelectedAppearance({ barGradientTo: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Bar roundness
                    <input
                      type="range"
                      min="0"
                      max="36"
                      value={selectedChartPart ? getBarStyle(selectedTile.appearance, selectedChartPart.id, selectedTile.appearance.primaryColor).radius : selectedTile.appearance.barRadius}
                      onChange={(event) =>
                        selectedChartPart ? updateSelectedBarStyle({ radius: Number(event.target.value) }) : updateSelectedAppearance({ barRadius: Number(event.target.value) })
                      }
                    />
                  </label>
                  <label>
                    Bar width
                    <input type="range" min="16" max="140" value={selectedTile.appearance.barSize} onChange={(event) => updateSelectedAppearance({ barSize: Number(event.target.value) })} />
                  </label>
                  <label>
                    Bar spacing
                    <input type="range" min="0" max="48" value={selectedTile.appearance.barGap} onChange={(event) => updateSelectedAppearance({ barGap: Number(event.target.value) })} />
                  </label>
                  <label>
                    Group spacing
                    <input type="range" min="0" max="64" value={selectedTile.appearance.barCategoryGap} onChange={(event) => updateSelectedAppearance({ barCategoryGap: Number(event.target.value) })} />
                  </label>
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
                    Label color
                    <input type="color" value={selectedTile.appearance.labelColor} onChange={(event) => updateSelectedAppearance({ labelColor: event.target.value })} />
                  </label>
                  <label>
                    Label size
                    <input type="range" min="9" max="28" value={selectedTile.appearance.labelFontSize} onChange={(event) => updateSelectedAppearance({ labelFontSize: Number(event.target.value) })} />
                  </label>
                  <label>
                    Label offset
                    <input type="range" min="0" max="32" value={selectedTile.appearance.labelOffset} onChange={(event) => updateSelectedAppearance({ labelOffset: Number(event.target.value) })} />
                  </label>
                  <label>
                    Axis color
                    <input type="color" value={selectedTile.appearance.axisColor} onChange={(event) => updateSelectedAppearance({ axisColor: event.target.value })} />
                  </label>
                  <label>
                    Axis text size
                    <input type="range" min="8" max="22" value={selectedTile.appearance.axisFontSize} onChange={(event) => updateSelectedAppearance({ axisFontSize: Number(event.target.value) })} />
                  </label>
                  <label>
                    Grid color
                    <input type="color" value={selectedTile.appearance.gridColor} onChange={(event) => updateSelectedAppearance({ gridColor: event.target.value })} />
                  </label>
                </>
              )}
              <div className="panel-title subtle">
                <h2>Container</h2>
              </div>
              <label>
                Background style
                <select
                  value={selectedTile.appearance.backgroundMode}
                  onChange={(event) => updateSelectedAppearance({ backgroundMode: event.target.value as "solid" | "gradient" })}
                >
                  <option value="solid">Solid</option>
                  <option value="gradient">Gradient</option>
                </select>
              </label>
              {selectedTile.appearance.backgroundMode === "solid" ? (
                <label>
                  Background
                  <input type="color" value={selectedTile.appearance.background} onChange={(event) => updateSelectedAppearance({ background: event.target.value })} />
                </label>
              ) : (
                <>
                  <label>
                    Gradient start
                    <input type="color" value={selectedTile.appearance.gradientFrom} onChange={(event) => updateSelectedAppearance({ gradientFrom: event.target.value })} />
                  </label>
                  <label>
                    Gradient end
                    <input type="color" value={selectedTile.appearance.gradientTo} onChange={(event) => updateSelectedAppearance({ gradientTo: event.target.value })} />
                  </label>
                </>
              )}
              <label>
                Border
                <input type="color" value={selectedTile.appearance.borderColor} onChange={(event) => updateSelectedAppearance({ borderColor: event.target.value })} />
              </label>
              <label>
                Rounded corners
                <input type="range" min="0" max="36" value={selectedTile.appearance.borderRadius} onChange={(event) => updateSelectedAppearance({ borderRadius: Number(event.target.value) })} />
              </label>
              <label>
                Transparency
                <input type="range" min="20" max="100" value={selectedTile.appearance.opacity} onChange={(event) => updateSelectedAppearance({ opacity: Number(event.target.value) })} />
              </label>
              <div className="toggle-list">
                <label><input type="checkbox" checked={selectedTile.appearance.shadow} onChange={(event) => updateSelectedAppearance({ shadow: event.target.checked })} /> Shadow</label>
                <label><input type="checkbox" checked={selectedTile.appearance.showGrid} onChange={(event) => updateSelectedAppearance({ showGrid: event.target.checked })} /> Chart grid</label>
                <label><input type="checkbox" checked={selectedTile.appearance.showValueLabels} onChange={(event) => updateSelectedAppearance({ showValueLabels: event.target.checked })} /> Value labels</label>
                <label><input type="checkbox" checked={selectedTile.appearance.showTable} onChange={(event) => updateSelectedAppearance({ showTable: event.target.checked })} /> Table below chart</label>
                <label><input type="checkbox" checked={selectedTile.appearance.showBases} onChange={(event) => updateSelectedAppearance({ showBases: event.target.checked })} /> Bases</label>
                <label><input type="checkbox" checked={selectedTile.appearance.showAnnotations} onChange={(event) => updateSelectedAppearance({ showAnnotations: event.target.checked })} /> Arrows</label>
                <label><input type="checkbox" checked={selectedTile.appearance.showNotes} onChange={(event) => updateSelectedAppearance({ showNotes: event.target.checked })} /> Notes</label>
              </div>
              <button
                type="button"
                className="secondary"
                onClick={deleteSelectedItem}
              >
                Remove tile
              </button>
            </>
          )}
            </>
          )}
            </>
          )}
        </aside>
      </section>
    </main>
  );
}
