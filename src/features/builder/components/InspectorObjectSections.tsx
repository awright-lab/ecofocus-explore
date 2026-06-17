import type React from "react";
import { ColorField, rangeFill } from "../../design-system/DesignControls";
import {
  bannerDimensions,
  comparisonDatasetOptions,
  defaultDataset,
  filterDimensions,
  fontFamilies,
  waveComparisonChartTypes
} from "../builderConstants";
import { effectShadow, gradientCss } from "../builderHelpers";
import { comparisonSummaryLabel, tileSourceKindLabel } from "./CanvasRenderers";
import { getChartTypeLabel, getCompatibleChartTypes, getQuestionLabel } from "../../analytics/analyticsDisplay";
import type { BreakById, ChartType, ComparisonMode, FilterFieldId, Metric, WeightId } from "../../../../shared/types/analytics";
import type { DashboardCanvasElement } from "../../../../shared/types/dashboard";
import type { BuilderInspectorProps } from "./BuilderInspector";

export function ElementInspector(props: BuilderInspectorProps) {
  const {
    selectedElement,
    textStylePresets,
    setDesignModal,
    updateSelectedElement,
    applyTextStylePresetToSelection,
    deleteSelectedItem
  } = props;

  if (!selectedElement) {
    return null;
  }

  return (
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
                  <div className="settings-menu">
                    {textStylePresets.map((preset) => (
                      <button type="button" key={preset.id} className="menu-card" onClick={() => applyTextStylePresetToSelection(preset)}>
                        <strong>{preset.label}</strong>
                        <span>{preset.description}</span>
                      </button>
                    ))}
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
  );
}

export function TileContainerInspector(props: BuilderInspectorProps) {
  const {
    selectedTile,
    setDesignModal,
    updateSelectedAppearance,
    deleteSelectedItem
  } = props;

  if (!selectedTile) {
    return null;
  }

  return (
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
  );
}

export function TileAnalysisInspector(props: BuilderInspectorProps) {
  const {
    setSettingsView,
    selectedTile,
    selectedTileQuestion,
    selectedTileFilterDimension,
    setDesignModal,
    updateSelectedTile,
    updateSelectedAppearance,
    tileWithVisualization,
    duplicateTileAsVisualization,
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
