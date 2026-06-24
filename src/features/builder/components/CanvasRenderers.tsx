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
import { datasets, defaultDataset, palettes } from "../builderConstants";
import { backgroundStyle, effectShadow, gradientCss, normalizeGradientStops, svgLinearGradientVector } from "../builderHelpers";
import type { AnalyticsAnnotation, AnalyticsQueryRequest, AnalyticsQueryResponse, ChartType, DatasetId, QuestionId } from "../../../../shared/types/analytics";
import type { DashboardCanvasElement, DashboardPage, DashboardTile, GradientStop, TileAppearance } from "../../../../shared/types/dashboard";
import { buildExecutedColumnComparisonPresentation, getExecutedSignificanceCell } from "./analysisSignificancePresentationModel";

export function getBarStyle(appearance: TileAppearance, id: string, fallbackColor: string) {
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

export function gradientId(tileId: string, key: string) {
  return `gradient_${tileId.replace(/[^a-zA-Z0-9]/g, "_")}_${key.replace(/[^a-zA-Z0-9]/g, "_")}`;
}

export function SvgGradientStops({ from, to, stops }: { from: string; to: string; stops?: GradientStop[] }) {
  return (
    <>
      {normalizeGradientStops(from, to, stops).map((stop) => (
        <stop key={stop.id} offset={`${stop.position}%`} stopColor={stop.color} stopOpacity={stop.opacity / 100} />
      ))}
    </>
  );
}

export function SvgBarGradientDef({
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

export function formatValue(value: number, format: AnalyticsQueryResponse["metric"]["valueFormat"]) {
  return format === "percent" ? `${value}%` : value.toLocaleString();
}

export function wrapWords(value: string, maxChars: number, maxLines: number) {
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

export function getAxisLabel(appearance: TileAppearance, id: string, fallback: string) {
  return appearance.axisLabelOverrides[id] ?? fallback;
}

export function getChartTypeLabel(chartType: ChartType) {
  return defaultDataset.chartTypes.find((item) => item.id === chartType)?.label ?? chartType;
}

export function getQuestionLabel(questionId: QuestionId) {
  return defaultDataset.questions.find((question) => question.id === questionId)?.shortLabel ?? questionId;
}

export function getPaletteId(colors: string[]) {
  return palettes.find((palette) => palette.colors.join(",") === colors.join(","))?.id ?? "custom";
}

export function uniqueColors(colors: string[]) {
  return Array.from(new Set(colors.filter(Boolean)));
}

export function getDocumentColors(tile?: DashboardTile) {
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

export const gradientStylePresets = [
  { id: "linear-left-right", label: "Left to right", type: "linear" as const, angle: 90, positions: [0, 100] },
  { id: "linear-top-bottom", label: "Top to bottom", type: "linear" as const, angle: 180, positions: [0, 100] },
  { id: "linear-diagonal", label: "Diagonal", type: "linear" as const, angle: 135, positions: [0, 35, 100] },
  { id: "radial-soft", label: "Radial", type: "radial" as const, angle: 90, positions: [0, 45, 100] },
  { id: "conic-sweep", label: "Conic", type: "conic" as const, angle: 90, positions: [0, 25, 60, 100] }
];

export function getCompatibleChartTypes(result: AnalyticsQueryResponse) {
  const isSingleSeries = result.columns.length === 1;
  const chartTypes: ChartType[] = isSingleSeries
    ? ["table", "vertical_bar", "horizontal_bar", "donut"]
    : ["table", "grouped_bar", "stacked_bar", "line_chart"];
  return chartTypes.filter((chartType) => defaultDataset.chartTypes.some((item) => item.id === chartType));
}

export function defaultVisualizationForQuestion(questionMetadata: typeof defaultDataset.questions[number]) {
  return questionMetadata.allowedChartTypes.includes("table")
    ? "table"
    : questionMetadata.allowedChartTypes.find((item) => item !== "table") ?? "table";
}

export function AxisTick(props: { x?: string | number; y?: string | number; payload?: { value: string }; appearance: TileAppearance; axisDirection?: "x" | "y" }) {
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

export function getAnnotation(annotations: AnalyticsAnnotation[], rowId: string, columnId: string) {
  return annotations.find((annotation) => annotation.rowId === rowId && annotation.columnId === columnId);
}

export function sampleSizeLabel(result: AnalyticsQueryResponse) {
  const bases = result.table.flatMap((row) => Object.values(row.bases)).filter((base) => base > 0);
  const uniqueBases = [...new Set(bases)].sort((a, b) => a - b);
  if (uniqueBases.length === 0) return "Sample n/a";
  if (uniqueBases.length === 1) return `Sample n=${uniqueBases[0].toLocaleString()}`;
  return `Sample n=${uniqueBases[0].toLocaleString()}-${uniqueBases[uniqueBases.length - 1].toLocaleString()}`;
}

export function confidenceLevelLabel(value: number) {
  return `${Math.round(value * 100)}% confidence`;
}

export function resultConfidenceLevel(result: AnalyticsQueryResponse) {
  return result.statistics?.confidenceLevel ?? result.query.confidenceLevel ?? 0.95;
}

export function comparisonDatasetsLabel(datasetIds: DatasetId[]) {
  if (datasetIds.length === 0) return "None";
  return datasetIds
    .map((datasetId) => datasets.find((dataset) => dataset.id === datasetId)?.wave ?? datasetId)
    .join(" vs ");
}

export function comparisonSummaryLabel(query: AnalyticsQueryRequest) {
  return query.comparisonMode === "wave" ? `Wave: ${comparisonDatasetsLabel(query.comparisonDatasets ?? [])}` : "None";
}

export function trendSpanLabel(query: AnalyticsQueryRequest) {
  if (query.comparisonMode !== "wave") return null;
  const waves = [query.dataset, ...(query.comparisonDatasets ?? [])]
    .map((datasetId) => datasets.find((dataset) => dataset.id === datasetId)?.wave ?? datasetId)
    .sort();
  return `${waves[0]}-${waves[waves.length - 1]} trend`;
}

export function tileSourceKindLabel(source: DashboardTile["source"]) {
  if (!source) return "Query";
  return source.kind === "variableSet" ? "Variable set" : "Question";
}

export function slugifyFileName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "ecofocus-dashboard";
}

export function pageSummary(page: DashboardPage) {
  const visibleTiles = page.tiles.filter((tile) => !tile.hidden);
  const visibleElements = page.elements.filter((element) => !element.hidden);
  return {
    tileCount: visibleTiles.length,
    elementCount: visibleElements.length,
    chartCount: visibleTiles.filter((tile) => tile.visualization !== "table").length,
    tableCount: visibleTiles.filter((tile) => tile.visualization === "table").length,
    trendTileCount: visibleTiles.filter((tile) => tile.query.comparisonMode === "wave").length,
    primaryTopics: [...new Set(visibleTiles.map((tile) => getQuestionLabel(tile.result.metadataRefs.question)))].slice(0, 4)
  };
}

export function tilePresentationNotes(tile: DashboardTile) {
  return [
    `${getQuestionLabel(tile.result.metadataRefs.question)} (${tileSourceKindLabel(tile.source)})`,
    ...(trendSpanLabel(tile.query) ? [trendSpanLabel(tile.query)!] : []),
    `Comparison: ${comparisonSummaryLabel(tile.query)}`,
    `${tile.result.metric.label}; ${sampleSizeLabel(tile.result)}; ${tile.result.weighting.applied ? tile.result.weighting.label : "Unweighted"}`,
    confidenceLevelLabel(resultConfidenceLevel(tile.result)),
    ...tile.result.notes.slice(0, 2)
  ];
}

export function ValueLabel(props: {
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

export function HorizontalValueLabel(props: {
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

export function HorizontalCategoryLabel(props: {
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

export function VerticalBarChartView({ tile }: { tile: DashboardTile }) {
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

export function GroupedBarChartView({ tile }: { tile: DashboardTile }) {
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

export function HorizontalBarChartView({ tile }: { tile: DashboardTile }) {
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

export function StackedBarChartView({ tile }: { tile: DashboardTile }) {
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

export function LineChartView({ tile }: { tile: DashboardTile }) {
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

export function DonutChartView({ tile }: { tile: DashboardTile }) {
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

export function TableView({ tile }: { tile: DashboardTile }) {
  const { result, appearance } = tile;
  const visibleColumns = result.columns;
  const executedSignificance = buildExecutedColumnComparisonPresentation(result);

  function tableCellAnnotation(rowId: string, columnId: string) {
    if (!appearance.showAnnotations) return null;
    return getAnnotation(result.annotations, rowId, columnId);
  }

  function tableCellSignificance(rowId: string, columnId: string) {
    if (!appearance.showAnnotations) return null;
    return getExecutedSignificanceCell(executedSignificance, rowId, columnId);
  }

  return (
    <div className="chart-card table-card" style={{ background: appearance.chartBackground }} aria-label="Query-driven table">
      <div className="table-shell">
        <table className="analytics-table">
          <thead>
            <tr>
              <th>Answer</th>
              {visibleColumns.map((column) => (
                <th key={column.id}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.table.map((row) => (
              <tr
                key={row.optionId}
                className={
                  row.presentation?.emphasis === "summary"
                    ? "table-row summary"
                    : row.presentation?.rowKind === "option"
                    ? "table-row detail"
                    : "table-row"
                }
              >
                <th>
                  <div className="table-row-label">
                    <span>{getAxisLabel(appearance, row.optionId, row.label)}</span>
                    {row.presentation?.emphasis === "summary" && (
                      <small>{row.presentation.rowKind === "topbox" ? "Top box" : row.presentation.rowKind === "bottombox" ? "Bottom box" : "Summary row"}</small>
                    )}
                  </div>
                </th>
                {visibleColumns.map((column) => {
                  const annotation = tableCellAnnotation(row.optionId, column.id);
                  const significanceCell = tableCellSignificance(row.optionId, column.id);
                  return (
                    <td key={column.id}>
                      <div className="table-cell-stack">
                        {appearance.showValueLabels && (
                          <span className={annotation ? `table-value ${annotation.direction}` : significanceCell ? `table-value significance-${significanceCell.direction}` : "table-value"}>
                            {formatValue(row.values[column.id], result.metric.valueFormat)}
                            {annotation && <span className={`direction direction-${annotation.direction}`}>{annotation.direction === "up" ? "↑" : "↓"}</span>}
                          </span>
                        )}
                        {significanceCell && (
                          <span className={`table-significance-marker ${significanceCell.direction}`} title={significanceCell.title}>
                            {significanceCell.label}
                          </span>
                        )}
                        {appearance.showBases && <small>Base {row.bases[column.id].toLocaleString()}</small>}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            {appearance.showAnnotations && executedSignificance.available && executedSignificance.significantComparisons > 0 && (
              <tr className="table-significance-row">
                <td colSpan={visibleColumns.length + 1}>
                  <div className="table-note-list significance">
                    <span>{executedSignificance.summaryLabel}</span>
                  </div>
                </td>
              </tr>
            )}
            {appearance.showNotes && result.notes.length > 0 && (
              <tr className="table-notes-row">
                <td colSpan={visibleColumns.length + 1}>
                  <div className="table-note-list">
                    {result.notes.slice(0, 2).map((note) => (
                      <span key={note}>{note}</span>
                    ))}
                  </div>
                </td>
              </tr>
            )}
            {appearance.showNotes && result.warnings.length > 0 && (
              <tr className="table-warning-row">
                <td colSpan={visibleColumns.length + 1}>
                  <div className="table-note-list warning">
                    {result.warnings.map((warning) => (
                      <span key={warning}>{warning}</span>
                    ))}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ChartView({ tile }: { tile: DashboardTile }) {
  if (tile.visualization === "table") return <TableView tile={tile} />;
  if (tile.visualization === "vertical_bar") return <VerticalBarChartView tile={tile} />;
  if (tile.visualization === "horizontal_bar") return <HorizontalBarChartView tile={tile} />;
  if (tile.visualization === "grouped_bar") return <GroupedBarChartView tile={tile} />;
  if (tile.visualization === "stacked_bar") return <StackedBarChartView tile={tile} />;
  if (tile.visualization === "line_chart") return <LineChartView tile={tile} />;
  if (tile.visualization === "donut") return <DonutChartView tile={tile} />;
  return null;
}

export function TileRenderer({ tile, selected, onSelect }: { tile: DashboardTile; selected: boolean; onSelect: () => void }) {
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
          {tile.source && <span className="tile-source-badge">{tileSourceKindLabel(tile.source)}: {tile.source.label}</span>}
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

export function CanvasElementRenderer({
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
