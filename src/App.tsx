import { useMemo, useState } from "react";
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
  showValueLabels: true,
  showTable: true,
  showBases: true,
  showNotes: true,
  showAnnotations: true
};

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

  return (
    <text x={x + width / 2} y={y - 8} textAnchor="middle" className={annotation ? `chart-value ${annotation.direction}` : "chart-value"}>
      {formatValue(value, result.metric.valueFormat)}
      {annotation ? (annotation.direction === "up" ? "↑" : "↓") : ""}
    </text>
  );
}

function VerticalBarChartView({ result, appearance }: { result: AnalyticsQueryResponse; appearance: TileAppearance }) {
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
        <BarChart data={chartData} margin={{ top: 32, right: 20, left: 8, bottom: 92 }}>
          <CartesianGrid stroke="#e6ebe4" vertical={false} />
          <XAxis dataKey="label" interval={0} tick={{ fill: "#526157", fontSize: 12 }} tickLine={false} height={94} />
          <YAxis tick={{ fill: "#69776e", fontSize: 12 }} tickLine={false} axisLine={false} />
          <Tooltip formatter={(value) => [formatValue(Number(value ?? 0), result.metric.valueFormat), result.metric.label]} />
          <Bar dataKey="value" radius={[2, 2, 0, 0]}>
            {chartData.map((item, index) => (
              <Cell key={item.optionId} fill={appearance.palette[index % appearance.palette.length] ?? appearance.primaryColor} />
            ))}
            <LabelList content={(props) => <ValueLabel {...props} result={result} appearance={appearance} />} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function GroupedBarChartView({ result, appearance }: { result: AnalyticsQueryResponse; appearance: TileAppearance }) {
  const chartData = result.table.map((row) => ({
    optionId: row.optionId,
    label: row.label,
    ...row.values
  }));

  return (
    <div className="chart-card" aria-label="Query-driven grouped bar chart">
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={chartData} margin={{ top: 20, right: 20, left: 8, bottom: 84 }}>
          <CartesianGrid stroke="#e6ebe4" vertical={false} />
          <XAxis dataKey="label" interval={0} tick={{ fill: "#526157", fontSize: 12 }} tickLine={false} height={88} />
          <YAxis tick={{ fill: "#69776e", fontSize: 12 }} tickLine={false} axisLine={false} />
          <Tooltip formatter={(value) => [formatValue(Number(value ?? 0), result.metric.valueFormat), result.metric.label]} />
          <Legend verticalAlign="top" height={36} />
          {result.columns.map((column, index) => (
            <Bar key={column.id} dataKey={column.id} name={column.label} fill={appearance.palette[index % appearance.palette.length]} radius={[2, 2, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChartView({ tile }: { tile: DashboardTile }) {
  if (tile.visualization === "vertical_bar") return <VerticalBarChartView result={tile.result} appearance={tile.appearance} />;
  if (tile.visualization === "grouped_bar") return <GroupedBarChartView result={tile.result} appearance={tile.appearance} />;
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
    <article className={selected ? "dashboard-tile selected" : "dashboard-tile"} onClick={onSelect}>
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
      <div className={selected ? "canvas-element selected" : "canvas-element"} onClick={onSelect}>
        {element.content ? <img src={element.content} alt="" /> : <div className="image-placeholder">Image URL</div>}
      </div>
    );
  }

  if (element.type === "text") {
    return (
      <div
        className={selected ? "canvas-element text-element selected" : "canvas-element text-element"}
        style={{ color: element.style.textColor, fontSize: element.style.fontSize }}
        onClick={onSelect}
      >
        {element.content}
      </div>
    );
  }

  return (
    <div
      className={selected ? `canvas-element shape-element ${element.type} selected` : `canvas-element shape-element ${element.type}`}
      style={{ background: element.style.fill, borderColor: element.style.borderColor }}
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

export default function App() {
  const [dashboard, setDashboard] = useState<DashboardDraft>({
    id: "internal_mvp",
    title: "2025 EcoFocus Builder Draft",
    status: "draft",
    pages: [
      {
        id: "page_overview",
        title: "Overview",
        order: 1,
        elements: [],
        tiles: []
      }
    ]
  });
  const [activePageId, setActivePageId] = useState("page_overview");
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
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

  const query: AnalyticsQueryRequest = {
    dataset: defaultDataset.id,
    question,
    breakBy,
    filters: filterField && filterValue !== "all" ? [{ field: filterField, values: [filterValue] }] : [],
    weight,
    metric,
    chartType: activeChartType
  };

  async function addTileFromQuery() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await runAnalyticsQuery(query);
      const tile: DashboardTile = {
        id: makeTileId(),
        title: selectedQuestion.shortLabel,
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

  function addCanvasElement(type: DashboardCanvasElementType) {
    const element: DashboardCanvasElement = {
      id: makeElementId(),
      type,
      layout: { x: 64, y: 64, width: type === "text" ? 280 : 220, height: type === "text" ? 80 : 160, zIndex: nextZIndex(activePage) },
      content: type === "text" ? "Text box" : "",
      style: {
        fill: type === "circle" || type === "rectangle" ? "#dfeee2" : "transparent",
        textColor: "#17211b",
        borderColor: "#438757",
        fontSize: 24
      }
    };

    setDashboard((current) => ({
      ...current,
      status: "draft",
      pages: current.pages.map((page) => (page.id === activePage.id ? { ...page, elements: [...page.elements, element] } : page))
    }));
    setSelectedElementId(element.id);
    setSelectedTileId(null);
  }

  function updateSelectedAppearance(updates: Partial<TileAppearance>) {
    if (!selectedTile) return;
    updateSelectedTile({ appearance: { ...selectedTile.appearance, ...updates } });
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
      elements: [],
      tiles: []
    };

    setDashboard((current) => ({ ...current, status: "draft", pages: [...current.pages, page] }));
    setActivePageId(page.id);
    setSelectedTileId(null);
    setSelectedElementId(null);
  }

  function deleteActivePage() {
    if (dashboard.pages.length <= 1) return;

    const remainingPages = sortedPages.filter((page) => page.id !== activePage.id).map((page, index) => ({ ...page, order: index + 1 }));
    setDashboard((current) => ({ ...current, status: "draft", pages: remainingPages }));
    setActivePageId(remainingPages[0].id);
    setSelectedTileId(null);
    setSelectedElementId(null);
  }

  return (
    <main className="builder-shell">
      <header className="builder-header">
        <div>
          <p className="eyebrow">EcoFocus Explore</p>
          <h1>{dashboard.title}</h1>
        </div>
        <div className="publish-controls">
          <span className={dashboard.status === "published" ? "status published" : "status"}>{dashboard.status}</span>
          <button type="button" onClick={() => setDashboard((current) => ({ ...current, status: current.status === "published" ? "draft" : "published" }))}>
            {dashboard.status === "published" ? "Unpublish" : "Publish"}
          </button>
        </div>
      </header>

      <section className="builder-workspace">
        <aside className="panel controls" aria-label="Data controls">
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

          <div className="panel-title">
            <h2>Insert</h2>
          </div>
          <div className="insert-grid">
            <button type="button" className="secondary" onClick={() => addCanvasElement("text")}>Text</button>
            <button type="button" className="secondary" onClick={() => addCanvasElement("rectangle")}>Rectangle</button>
            <button type="button" className="secondary" onClick={() => addCanvasElement("circle")}>Circle</button>
            <button type="button" className="secondary" onClick={() => addCanvasElement("image")}>Image</button>
          </div>

          <div className="panel-title">
            <h2>Data</h2>
          </div>
          <label>
            Dataset
            <select value={defaultDataset.id} disabled>
              <option value={defaultDataset.id}>{defaultDataset.label}</option>
            </select>
          </label>
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
        </aside>

        <section className="canvas" aria-label="Dashboard canvas">
          <div className="page-header">
            <div>
              <p className="eyebrow">Page {activePage.order}</p>
              <h2>{activePage.title}</h2>
            </div>
            <span>{activePage.tiles.length + activePage.elements.length} element{activePage.tiles.length + activePage.elements.length === 1 ? "" : "s"}</span>
          </div>
          <div className="freeform-canvas">
            {activePage.tiles.length === 0 && activePage.elements.length === 0 && (
              <div className="empty-state">Add charts, tables, text, shapes, or images to start building this page.</div>
            )}
            {activePage.elements.map((element) => (
              <Rnd
                key={element.id}
                bounds="parent"
                size={{ width: element.layout.width, height: element.layout.height }}
                position={{ x: element.layout.x, y: element.layout.y }}
                style={{ zIndex: element.layout.zIndex }}
                onDragStart={() => {
                  setSelectedElementId(element.id);
                  setSelectedTileId(null);
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
                  }}
                />
              </Rnd>
            ))}
            {activePage.tiles.map((tile) => (
              <Rnd
                key={tile.id}
                bounds="parent"
                minWidth={320}
                minHeight={220}
                size={{ width: tile.layout.width, height: tile.layout.height }}
                position={{ x: tile.layout.x, y: tile.layout.y }}
                style={{ zIndex: tile.layout.zIndex }}
                onDragStart={() => {
                  setSelectedTileId(tile.id);
                  setSelectedElementId(null);
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
                  }}
                />
              </Rnd>
            ))}
          </div>
        </section>

        <aside className="panel settings" aria-label="Tile settings">
          <div className="panel-title">
            <h2>Settings</h2>
          </div>
          <label>
            Page title
            <input value={activePage.title} onChange={(event) => updateActivePage({ title: event.target.value })} />
          </label>
          <button type="button" className="secondary" onClick={deleteActivePage} disabled={dashboard.pages.length <= 1}>
            Delete page
          </button>
          <div className="panel-title subtle">
            <h2>{selectedElement ? "Element" : "Tile"}</h2>
          </div>
          {selectedElement ? (
            <>
              {selectedElement.type !== "rectangle" && selectedElement.type !== "circle" && (
                <label>
                  {selectedElement.type === "image" ? "Image URL" : "Text"}
                  <input value={selectedElement.content} onChange={(event) => updateSelectedElement({ content: event.target.value })} />
                </label>
              )}
              {selectedElement.type === "text" && (
                <>
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
                </>
              )}
              {(selectedElement.type === "rectangle" || selectedElement.type === "circle") && (
                <>
                  <label>
                    Fill
                    <input
                      type="color"
                      value={selectedElement.style.fill}
                      onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, fill: event.target.value } })}
                    />
                  </label>
                  <label>
                    Border
                    <input
                      type="color"
                      value={selectedElement.style.borderColor}
                      onChange={(event) => updateSelectedElement({ style: { ...selectedElement.style, borderColor: event.target.value } })}
                    />
                  </label>
                </>
              )}
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setDashboard((current) => ({
                    ...current,
                    status: "draft",
                    pages: current.pages.map((page) =>
                      page.id === activePage.id ? { ...page, elements: page.elements.filter((element) => element.id !== selectedElement.id) } : page
                    )
                  }));
                  setSelectedElementId(null);
                }}
              >
                Remove element
              </button>
            </>
          ) : !selectedTile ? (
            <div className="empty-state compact">Select a canvas item to edit its display.</div>
          ) : (
            <>
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
              <div className="toggle-list">
                <label><input type="checkbox" checked={selectedTile.appearance.showValueLabels} onChange={(event) => updateSelectedAppearance({ showValueLabels: event.target.checked })} /> Value labels</label>
                <label><input type="checkbox" checked={selectedTile.appearance.showTable} onChange={(event) => updateSelectedAppearance({ showTable: event.target.checked })} /> Table below chart</label>
                <label><input type="checkbox" checked={selectedTile.appearance.showBases} onChange={(event) => updateSelectedAppearance({ showBases: event.target.checked })} /> Bases</label>
                <label><input type="checkbox" checked={selectedTile.appearance.showAnnotations} onChange={(event) => updateSelectedAppearance({ showAnnotations: event.target.checked })} /> Arrows</label>
                <label><input type="checkbox" checked={selectedTile.appearance.showNotes} onChange={(event) => updateSelectedAppearance({ showNotes: event.target.checked })} /> Notes</label>
              </div>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setDashboard((current) => ({
                    ...current,
                    status: "draft",
                    pages: current.pages.map((page) =>
                      page.id === activePage.id ? { ...page, tiles: page.tiles.filter((tile) => tile.id !== selectedTile.id) } : page
                    )
                  }));
                  setSelectedTileId(null);
                  setSelectedElementId(null);
                }}
              >
                Remove tile
              </button>
            </>
          )}
        </aside>
      </section>
    </main>
  );
}
