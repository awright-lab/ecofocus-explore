import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
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

const defaultDataset = datasets[0];
const defaultQuestion = defaultDataset.questions.find((question) => question.id === defaultDataset.defaultQuestion) ?? defaultDataset.questions[0];
const bannerDimensions = getBannerDimensions(defaultDataset.id);
const filterDimensions = getFilterDimensions(defaultDataset.id);
const defaultBreakBy = bannerDimensions.find((dimension) => dimension.id === defaultDataset.defaultBreakBy) ?? bannerDimensions[0];
const defaultFilterDimension = filterDimensions[0];
const chartColors = ["#39784d", "#6c9b4d", "#2d6f73", "#a06b3a", "#6f6697"];

function formatValue(value: number, format: AnalyticsQueryResponse["metric"]["valueFormat"]) {
  return format === "percent" ? `${value}%` : value.toLocaleString();
}

function getAnnotation(annotations: AnalyticsAnnotation[], rowId: string, columnId: string) {
  return annotations.find((annotation) => annotation.rowId === rowId && annotation.columnId === columnId);
}

function DirectionMarker({ annotation }: { annotation?: AnalyticsAnnotation }) {
  if (!annotation) {
    return null;
  }

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
}) {
  const { payload, result } = props;
  const x = Number(props.x ?? 0);
  const y = Number(props.y ?? 0);
  const width = Number(props.width ?? 0);
  const value = Number(props.value ?? 0);
  const annotation = payload ? getAnnotation(result.annotations, payload.optionId, result.columns[0]?.id) : undefined;

  return (
    <text x={x + width / 2} y={y - 8} textAnchor="middle" className={annotation ? `chart-value ${annotation.direction}` : "chart-value"}>
      {formatValue(value, result.metric.valueFormat)}
      {annotation ? (annotation.direction === "up" ? "↑" : "↓") : ""}
    </text>
  );
}

function VerticalBarChartView({ result }: { result: AnalyticsQueryResponse }) {
  const column = result.columns[0];
  const chartData = result.table.map((row) => ({
    optionId: row.optionId,
    label: row.label,
    value: row.values[column.id],
    base: row.bases[column.id]
  }));

  return (
    <div className="chart-card" aria-label="Query-driven vertical bar chart">
      <ResponsiveContainer width="100%" height={420}>
        <BarChart data={chartData} margin={{ top: 32, right: 20, left: 8, bottom: 92 }}>
          <CartesianGrid stroke="#e6ebe4" vertical={false} />
          <XAxis dataKey="label" interval={0} tick={{ fill: "#526157", fontSize: 12 }} tickLine={false} height={94} />
          <YAxis tick={{ fill: "#69776e", fontSize: 12 }} tickLine={false} axisLine={false} />
          <Tooltip
            formatter={(value) => [formatValue(Number(value ?? 0), result.metric.valueFormat), result.metric.label]}
            labelStyle={{ color: "#17211b" }}
          />
          <Bar dataKey="value" fill="#438757" radius={[2, 2, 0, 0]}>
            <LabelList content={(props) => <ValueLabel {...props} result={result} />} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function GroupedBarChartView({ result }: { result: AnalyticsQueryResponse }) {
  const chartData = result.table.map((row) => ({
    optionId: row.optionId,
    label: row.label,
    ...row.values
  }));

  return (
    <div className="chart-card" aria-label="Query-driven grouped bar chart">
      <ResponsiveContainer width="100%" height={430}>
        <BarChart data={chartData} margin={{ top: 20, right: 20, left: 8, bottom: 84 }}>
          <CartesianGrid stroke="#e6ebe4" vertical={false} />
          <XAxis dataKey="label" interval={0} tick={{ fill: "#526157", fontSize: 12 }} tickLine={false} height={88} />
          <YAxis tick={{ fill: "#69776e", fontSize: 12 }} tickLine={false} axisLine={false} />
          <Tooltip formatter={(value) => [formatValue(Number(value ?? 0), result.metric.valueFormat), result.metric.label]} />
          <Legend verticalAlign="top" height={36} />
          {result.columns.map((column, index) => (
            <Bar key={column.id} dataKey={column.id} name={column.label} fill={chartColors[index % chartColors.length]} radius={[2, 2, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChartView({ result }: { result: AnalyticsQueryResponse }) {
  if (result.query.chartType === "vertical_bar") {
    return <VerticalBarChartView result={result} />;
  }

  if (result.query.chartType === "grouped_bar") {
    return <GroupedBarChartView result={result} />;
  }

  return null;
}

function ResultsTable({ result }: { result: AnalyticsQueryResponse }) {
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
                    <DirectionMarker annotation={getAnnotation(result.annotations, row.optionId, column.id)} />
                  </strong>
                  <span>Base {row.bases[column.id]}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function App() {
  const [question, setQuestion] = useState<QuestionId>(defaultQuestion.id);
  const [breakBy, setBreakBy] = useState<BreakById>(defaultBreakBy.id as BreakById);
  const [metric, setMetric] = useState<Metric>(defaultQuestion.defaultMetric);
  const [viewMode, setViewMode] = useState<"chart" | "table">("chart");
  const [chartType, setChartType] = useState<ChartType>(defaultQuestion.allowedChartTypes.find((item) => item !== "table") ?? "table");
  const [weight, setWeight] = useState<WeightId | null>(defaultDataset.defaultWeight);
  const [filterField] = useState<FilterFieldId | null>(defaultFilterDimension?.id ?? null);
  const [filterValue, setFilterValue] = useState("all");
  const [result, setResult] = useState<AnalyticsQueryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedQuestion = useMemo(() => {
    return defaultDataset.questions.find((item) => item.id === question) ?? defaultQuestion;
  }, [question]);

  const selectedFilterDimension = useMemo(() => {
    return filterField ? filterDimensions.find((item) => item.id === filterField) : undefined;
  }, [filterField]);

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

  async function handleRunQuery() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await runAnalyticsQuery(query);
      setResult(response);
    } catch (queryError) {
      setError(queryError instanceof Error ? queryError.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="intro">
        <p className="eyebrow">Internal MVP</p>
        <h1>EcoFocus Explore</h1>
        <p>
          Query-driven survey exploration for crosstabs and charts. This environment is separate from the current EcoFocus portal and uses mock analytics data until Snowflake is connected.
        </p>
      </section>

      <section className="workspace">
        <aside className="controls" aria-label="Explore controls">
          <label>
            Dataset
            <select value={defaultDataset.id} disabled>
              <option value={defaultDataset.id}>{defaultDataset.label}</option>
            </select>
          </label>

          <label>
            Question
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
            <span>{selectedQuestion.topic} · {selectedQuestion.universe}</span>
          </label>

          <label>
            Break by
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
            Metric
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

          <button type="button" onClick={handleRunQuery} disabled={isLoading}>
            {isLoading ? "Running..." : "Run query"}
          </button>
        </aside>

        <section className="output" aria-live="polite">
          <div className="output-header">
            <div>
              <p className="eyebrow">Explore output</p>
              <h2>{selectedQuestion.shortLabel}</h2>
            </div>
            <code>{query.question} by {query.breakBy} · {query.weight ?? "unweighted"}</code>
          </div>

          {error && <div className="error">{error}</div>}

          {!result && !error && (
            <div className="empty-state">
              Choose a question and banner, then run the query to generate normalized mock analytics output.
            </div>
          )}

          {result && (
            <>
              {result.query.chartType === "table" ? <ResultsTable result={result} /> : <ChartView result={result} />}
              {result.query.chartType !== "table" && <ResultsTable result={result} />}
              <div className="footnote">{result.weighting.applied ? result.weighting.label : "Unweighted"} · {result.metric.label}</div>
              {result.warnings.length > 0 && (
                <div className="warnings">
                  {result.warnings.map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </div>
              )}
              <div className="notes">
                {result.notes.map((note) => (
                  <p key={note}>{note}</p>
                ))}
              </div>
              <details>
                <summary>Structured query</summary>
                <pre>{JSON.stringify(result.query, null, 2)}</pre>
              </details>
            </>
          )}
        </section>
      </section>
    </main>
  );
}
