import type React from "react";
import {
  bannerDimensions,
  comparisonDatasetOptions,
  defaultDataset,
  filterDimensions,
  waveComparisonChartTypes
} from "../builderConstants";
import { comparisonSummaryLabel, tileSourceKindLabel } from "./CanvasRenderers";
import { getChartTypeLabel, getCompatibleChartTypes, getQuestionLabel } from "../../analytics/analyticsDisplay";
import type { BreakById, ChartType, ComparisonMode, FilterFieldId, Metric, WeightId } from "../../../../shared/types/analytics";
import type { BuilderInspectorProps } from "./BuilderInspector";

export function TileAnalysisResultSection(props: BuilderInspectorProps) {
  const { selectedTile, updateSelectedTile } = props;

  if (!selectedTile) {
    return null;
  }

  return (
    <>
              <div className="panel-title subtle">
                <h2>Content</h2>
              </div>
              <label>
                Title
                <input value={selectedTile.title} onChange={(event) => updateSelectedTile({ title: event.target.value })} />
              </label>
              <div className="panel-title subtle">
                <h2>Analysis</h2>
              </div>
              <div className="inspector-summary-card">
                <span className="inspector-summary-kicker">
                  {tileSourceKindLabel(selectedTile.source)}{selectedTile.source ? `: ${selectedTile.source.label}` : ""}
                </span>
                <strong>{getQuestionLabel(selectedTile.result.metadataRefs.question)}</strong>
                <div className="explorer-chip-row">
                  <span className="explorer-chip">Banner: {bannerDimensions.find((item) => item.id === selectedTile.query.breakBy)?.label ?? selectedTile.query.breakBy}</span>
                  <span className="explorer-chip">Compare: {comparisonSummaryLabel(selectedTile.query)}</span>
                  <span className="explorer-chip">Metric: {selectedTile.result.metric.label}</span>
                  <span className="explorer-chip">Weight: {selectedTile.result.weighting.applied ? selectedTile.result.weighting.label : "Unweighted"}</span>
                  <span className="explorer-chip">
                    Filter: {selectedTile.query.filters.length > 0 ? selectedTile.query.filters.map((filter) => filter.values.join(", ")).join(" · ") : "None"}
                  </span>
                </div>
              </div>
    </>
  );
}

export function TileAnalysisQuerySection(props: BuilderInspectorProps) {
  const {
    selectedTile,
    selectedTileQuestion,
    selectedTileFilterDimension,
    updateSelectedTile,
    rerunTileAnalysis,
    saveSelectedTileVariableSet,
    saveSelectedTileBanner,
    saveSelectedTileFilter,
    saveSelectedTileWeight,
    isLoading
  } = props;

  if (!selectedTile) {
    return null;
  }

  return (
    <>
              {selectedTileQuestion && (
                <div className="inspector-summary-card">
                  <span className="inspector-summary-kicker">Edit analysis</span>
                  <div className="compact-grid">
                    <label>
                      Banner
                      <select
                        value={selectedTile.query.breakBy}
                        disabled={selectedTile.query.comparisonMode === "wave"}
                        onChange={(event) =>
                          updateSelectedTile({
                            query: { ...selectedTile.query, breakBy: event.target.value as BreakById }
                          })
                        }
                      >
                        {bannerDimensions
                          .filter((item) => selectedTileQuestion.allowedBreakBys.includes(item.id as BreakById))
                          .map((item) => (
                            <option value={item.id} key={item.id}>
                              {item.label}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Cells
                      <select
                        value={selectedTile.query.metric}
                        onChange={(event) =>
                          updateSelectedTile({
                            query: { ...selectedTile.query, metric: event.target.value as Metric }
                          })
                        }
                      >
                        {selectedTileQuestion.allowedMetrics.map((item) => (
                          <option value={item} key={item}>
                            {defaultDataset.metrics.find((metricItem) => metricItem.id === item)?.label ?? item}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="compact-grid">
                    <label>
                      Comparison
                      <select
                        value={selectedTile.query.comparisonMode ?? "none"}
                        onChange={(event) => {
                          const nextMode = event.target.value as ComparisonMode;
                          const nextVisualization =
                            nextMode === "wave" && !waveComparisonChartTypes.includes(selectedTile.visualization)
                              ? waveComparisonChartTypes[0]
                              : selectedTile.visualization;
                          updateSelectedTile({
                            visualization: nextVisualization,
                            query: {
                              ...selectedTile.query,
                              chartType: nextVisualization,
                              comparisonMode: nextMode,
                              breakBy: nextMode === "wave" ? "SUMMARY" : selectedTile.query.breakBy,
                              comparisonDatasets: nextMode === "wave" ? selectedTile.query.comparisonDatasets ?? [] : []
                            }
                          });
                        }}
                      >
                        <option value="none">None</option>
                        <option value="wave">Wave comparison</option>
                      </select>
                    </label>
                    {(selectedTile.query.comparisonMode ?? "none") === "wave" ? (
                      <div className="explorer-meta-block">
                        <span>Wave comparison locks the banner to Summary.</span>
                      </div>
                    ) : (
                      <div className="explorer-meta-block">
                        <span>Use comparisons to trend the same question across waves.</span>
                      </div>
                    )}
                  </div>
                  {(selectedTile.query.comparisonMode ?? "none") === "wave" && (
                    <div className="explorer-section-card compact nested">
                      <div className="explorer-section-header">
                        <strong>Comparison waves</strong>
                        <small>Select one or more historical datasets</small>
                      </div>
                      <div className="explorer-chip-row comparison-chip-row">
                        {comparisonDatasetOptions.map((dataset) => {
                          const activeComparisons = selectedTile.query.comparisonDatasets ?? [];
                          const active = activeComparisons.includes(dataset.id);
                          return (
                            <button
                              type="button"
                              key={dataset.id}
                              className={active ? "explorer-chip-button active" : "explorer-chip-button secondary-chip"}
                              onClick={() =>
                                updateSelectedTile({
                                  query: {
                                    ...selectedTile.query,
                                    comparisonMode: "wave",
                                    breakBy: "SUMMARY",
                                    comparisonDatasets: active
                                      ? activeComparisons.filter((item) => item !== dataset.id)
                                      : [...activeComparisons, dataset.id]
                                  }
                                })
                              }
                            >
                              {dataset.wave}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div className="compact-grid">
                    <label>
                      Weight
                      <select
                        value={selectedTile.query.weight ?? "none"}
                        onChange={(event) =>
                          updateSelectedTile({
                            query: { ...selectedTile.query, weight: event.target.value === "none" ? null : (event.target.value as WeightId) }
                          })
                        }
                      >
                        <option value="none">Unweighted</option>
                        {defaultDataset.weights.map((item) => (
                          <option value={item.id} key={item.id}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Filter field
                      <select
                        value={selectedTile.query.filters[0]?.field ?? "none"}
                        onChange={(event) =>
                          updateSelectedTile({
                            query: {
                              ...selectedTile.query,
                              filters:
                                event.target.value === "none"
                                  ? []
                                  : [{ field: event.target.value as FilterFieldId, values: ["all"] }]
                            }
                          })
                        }
                      >
                        <option value="none">No filter</option>
                        {filterDimensions.map((item) => (
                          <option value={item.id} key={item.id}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {selectedTileFilterDimension && (
                    <label>
                      Filter value
                      <select
                        value={selectedTile.query.filters[0]?.values[0] ?? "all"}
                        onChange={(event) =>
                          updateSelectedTile({
                            query: {
                              ...selectedTile.query,
                              filters: [{ field: selectedTileFilterDimension.id, values: [event.target.value] }]
                            }
                          })
                        }
                      >
                        <option value="all">All {selectedTileFilterDimension.label.toLowerCase()}s</option>
                        {selectedTileFilterDimension.values.map((item) => (
                          <option value={item.id} key={item.id}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      rerunTileAnalysis(selectedTile, {
                        ...selectedTile.query,
                        breakBy: (selectedTile.query.comparisonMode ?? "none") === "wave" ? "SUMMARY" : selectedTile.query.breakBy,
                        chartType: selectedTile.visualization,
                        filters:
                          selectedTile.query.filters[0]?.field && selectedTile.query.filters[0]?.values[0] !== "all"
                            ? selectedTile.query.filters
                            : []
                      })
                    }
                    disabled={isLoading}
                  >
                    {isLoading ? "Refreshing..." : "Refresh analysis"}
                  </button>
                  <div className="analysis-library-actions">
                    <button type="button" className="secondary" onClick={saveSelectedTileVariableSet}>Save set</button>
                    <button type="button" className="secondary" onClick={saveSelectedTileBanner}>Save banner</button>
                    <button type="button" className="secondary" onClick={saveSelectedTileFilter}>Save filter</button>
                    <button type="button" className="secondary" onClick={saveSelectedTileWeight}>Save weight</button>
                  </div>
                </div>
              )}
    </>
  );
}

export function TileAnalysisDisplaySection(props: BuilderInspectorProps) {
  const {
    selectedTile,
    updateSelectedTile,
    updateSelectedAppearance,
    tileWithVisualization,
    duplicateTileAsVisualization
  } = props;

  if (!selectedTile) {
    return null;
  }

  return (
    <>
              <label>
                Visualization
                <select
                  value={selectedTile.visualization}
                  onChange={(event) => {
                    const nextVisualization = event.target.value as ChartType;
                    updateSelectedTile(tileWithVisualization(selectedTile, nextVisualization));
                  }}
                >
                  {getCompatibleChartTypes(selectedTile.result).map((item) => (
                    <option value={item} key={item}>
                      {getChartTypeLabel(item)}
                    </option>
                  ))}
                </select>
              </label>
              {selectedTile.visualization === "table" && (
                <div className="table-convert-card">
                  <div className="explorer-section-header">
                    <strong>Convert table to chart</strong>
                    <small>Pick a view for this same query</small>
                  </div>
                  <div className="explorer-chip-row">
                    {getCompatibleChartTypes(selectedTile.result)
                      .filter((item) => item !== "table")
                      .map((item) => (
                        <button
                          type="button"
                          key={item}
                          className="explorer-chip-button"
                          onClick={() => updateSelectedTile(tileWithVisualization(selectedTile, item))}
                        >
                          {getChartTypeLabel(item)}
                        </button>
                      ))}
                  </div>
                  <div className="explorer-section-header table-convert-subhead">
                    <strong>Keep table and create chart</strong>
                    <small>Useful when the page needs both views</small>
                  </div>
                  <div className="explorer-chip-row">
                    {getCompatibleChartTypes(selectedTile.result)
                      .filter((item) => item !== "table")
                      .map((item) => (
                        <button
                          type="button"
                          key={`duplicate-${item}`}
                          className="explorer-chip-button secondary-chip"
                          onClick={() => duplicateTileAsVisualization(selectedTile, item)}
                        >
                          New {getChartTypeLabel(item)}
                        </button>
                      ))}
                  </div>
                </div>
              )}
              <div className="panel-title subtle">
                <h2>Display</h2>
              </div>
              <div className="toggle-list">
                <label><input type="checkbox" checked={selectedTile.appearance.showGrid} onChange={(event) => updateSelectedAppearance({ showGrid: event.target.checked })} /> {selectedTile.visualization === "table" ? "Table guides" : "Chart grid"}</label>
                <label><input type="checkbox" checked={selectedTile.appearance.showValueLabels} onChange={(event) => updateSelectedAppearance({ showValueLabels: event.target.checked })} /> {selectedTile.visualization === "table" ? "Cell values" : "Value labels"}</label>
                <label><input type="checkbox" checked={selectedTile.appearance.showAnnotations} onChange={(event) => updateSelectedAppearance({ showAnnotations: event.target.checked })} /> {selectedTile.visualization === "table" ? "Highlights" : "Arrows"}</label>
                <label><input type="checkbox" checked={selectedTile.appearance.showNotes} onChange={(event) => updateSelectedAppearance({ showNotes: event.target.checked })} /> Notes</label>
              </div>
    </>
  );
}

export function TileAnalysisDesignSection(props: BuilderInspectorProps) {
  const { selectedTile, setSettingsView, setDesignModal } = props;

  if (!selectedTile) {
    return null;
  }

  return (
    <>
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
  );
}
