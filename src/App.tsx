import { useMemo, useState } from "react";
import { runAnalyticsQuery } from "./lib/api";
import { datasets } from "./lib/metadata";
import type { AnalyticsQueryRequest, AnalyticsQueryResponse, ChartType, DimensionId, Metric, QuestionId } from "../shared/types/analytics";

const defaultDataset = datasets[0];
const defaultQuestion = defaultDataset.questions[0];
const defaultBreakBy = defaultDataset.dimensions[0];

function formatValue(value: number, format: AnalyticsQueryResponse["metric"]["valueFormat"]) {
  return format === "percent" ? `${value}%` : value.toLocaleString();
}

function MiniGroupedBarChart({ result }: { result: AnalyticsQueryResponse }) {
  const maxValue = Math.max(...result.series.flatMap((series) => series.values), 1);

  return (
    <div className="chart-panel" aria-label="Query-driven grouped bar chart">
      {result.series.map((series) => (
        <div className="chart-row" key={series.id}>
          <div className="chart-row-label">{series.label}</div>
          <div className="bar-group">
            {series.values.map((value, index) => (
              <div className="bar-cell" key={`${series.id}-${result.labels[index]}`}>
                <div
                  className="bar"
                  style={{ width: `${Math.max((value / maxValue) * 100, 2)}%` }}
                  title={`${series.label}, ${result.labels[index]}: ${formatValue(value, result.metric.valueFormat)}; base ${series.bases[index]}`}
                />
                <span>{formatValue(value, result.metric.valueFormat)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="chart-legend">
        {result.labels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </div>
  );
}

function ResultsTable({ result }: { result: AnalyticsQueryResponse }) {
  const dataset = datasets.find((item) => item.id === result.query.dataset);
  const dimension = dataset?.dimensions.find((item) => item.id === result.query.breakBy);

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Answer</th>
            {dimension?.values.map((value) => (
              <th key={value.id}>{value.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.table.map((row) => (
            <tr key={row.optionId}>
              <th>{row.label}</th>
              {dimension?.values.map((value) => (
                <td key={value.id}>
                  <strong>{formatValue(row.values[value.id], result.metric.valueFormat)}</strong>
                  <span>Base {row.bases[value.id]}</span>
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
  const [breakBy, setBreakBy] = useState<DimensionId>(defaultBreakBy.id);
  const [metric, setMetric] = useState<Metric>("column_percent");
  const [chartType, setChartType] = useState<ChartType>("grouped_bar");
  const [result, setResult] = useState<AnalyticsQueryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedQuestion = useMemo(() => {
    return defaultDataset.questions.find((item) => item.id === question) ?? defaultQuestion;
  }, [question]);

  const query: AnalyticsQueryRequest = {
    dataset: defaultDataset.id,
    question,
    breakBy,
    filters: [],
    metric,
    chartType
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
            <select value={question} onChange={(event) => setQuestion(event.target.value as QuestionId)}>
              {defaultDataset.questions.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.shortLabel}
                </option>
              ))}
            </select>
          </label>

          <label>
            Break by
            <select value={breakBy} onChange={(event) => setBreakBy(event.target.value as DimensionId)}>
              {defaultDataset.dimensions.map((item) => (
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
                  {item === "column_percent" ? "Column %" : "Count"}
                </option>
              ))}
            </select>
          </label>

          <label>
            Chart
            <select value={chartType} onChange={(event) => setChartType(event.target.value as ChartType)}>
              {selectedQuestion.allowedChartTypes.map((item) => (
                <option value={item} key={item}>
                  {item === "grouped_bar" ? "Grouped bar" : "Table"}
                </option>
              ))}
            </select>
          </label>

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
            <code>{query.question} by {query.breakBy}</code>
          </div>

          {error && <div className="error">{error}</div>}

          {!result && !error && (
            <div className="empty-state">
              Choose a question and banner, then run the query to generate normalized mock analytics output.
            </div>
          )}

          {result && (
            <>
              <MiniGroupedBarChart result={result} />
              <ResultsTable result={result} />
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
