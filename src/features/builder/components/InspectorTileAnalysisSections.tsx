import type React from "react";
import { getChartTypeLabel, getCompatibleChartTypes } from "../../analytics/analyticsDisplay";
import type { ChartType } from "../../../../shared/types/analytics";
import type { BuilderInspectorProps } from "./BuilderInspector";
import { buildSettingProvenanceRows } from "./inspectorSettingProvenanceModel";
import { buildInspectorTileSummary } from "./inspectorTileSummaryModel";
import { buildTileQueryStatus } from "./inspectorTileQueryModel";
import {
  TileComparisonControls,
  TileFilterWeightControls,
  TileQueryActions,
  TileQuestionConfigSection
} from "./InspectorTileQuerySections";

export function TileAnalysisResultSection(props: BuilderInspectorProps) {
  const { selectedTile, updateSelectedTile } = props;

  if (!selectedTile) {
    return null;
  }
  const summary = buildInspectorTileSummary(selectedTile);

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
                <h2>Selected object</h2>
              </div>
              <div className="inspector-summary-card tile-handoff-card">
                <span className="inspector-summary-kicker">{summary.sourceKind}</span>
                <strong>{summary.title}</strong>
                <p>{summary.subtitle}</p>
                <div className="tile-handoff-source">
                  <span>{summary.sourceLabel}</span>
                  <small>{summary.sourceDescription}</small>
                </div>
                <div className="explorer-chip-row">
                  {summary.chips.map((chip) => (
                    <span className="explorer-chip" key={chip}>{chip}</span>
                  ))}
                </div>
                <small className="tile-handoff-cue">{summary.editCue}</small>
              </div>
    </>
  );
}

export function TileAnalysisQuerySection(props: BuilderInspectorProps) {
  const { selectedTile, selectedTileQuestion, savedBanners, savedFilters, savedWeights } = props;

  if (!selectedTile || !selectedTileQuestion) {
    return null;
  }
  const queryStatus = buildTileQueryStatus(selectedTile);
  const provenanceRows = buildSettingProvenanceRows(selectedTile, savedBanners, savedFilters, savedWeights);

  return (
    <div className="inspector-summary-card">
      <span className="inspector-summary-kicker">Edit analysis</span>
      <div className={queryStatus.hasPendingChanges ? "tile-query-status pending" : "tile-query-status"}>
        <div>
          <strong>{queryStatus.label}</strong>
          <span>{queryStatus.description}</span>
        </div>
        <small>{queryStatus.visualizationLabel}</small>
      </div>
      <div className="settings-provenance-row" aria-label="Current analytical setting provenance">
        {provenanceRows.map((row) => (
          <div className={row.saved ? "settings-provenance-item saved" : "settings-provenance-item"} key={row.id}>
            <span>{row.label}</span>
            <strong>{row.value}</strong>
            <small>{row.source}</small>
          </div>
        ))}
      </div>
      <div className="tile-query-group">
        <div className="explorer-section-header">
          <strong>Source settings</strong>
          <small>{queryStatus.sourceLabel}</small>
        </div>
        <div className="explorer-chip-row">
          <span className="explorer-chip">Question: {queryStatus.questionLabel}</span>
          <span className="explorer-chip">Compare: {queryStatus.comparisonLabel}</span>
        </div>
        <TileQuestionConfigSection {...props} />
      </div>
      <div className="tile-query-group">
        <div className="explorer-section-header">
          <strong>Comparison settings</strong>
          <small>Trend or compare waves</small>
        </div>
        <TileComparisonControls {...props} />
      </div>
      <div className="tile-query-group">
        <div className="explorer-section-header">
          <strong>Filters and weights</strong>
          <small>Analysis base</small>
        </div>
        <TileFilterWeightControls {...props} />
      </div>
      <div className="tile-query-group">
        <div className="explorer-section-header">
          <strong>Apply and save</strong>
          <small>{queryStatus.hasPendingChanges ? "Refresh to update result" : "Reusable settings"}</small>
        </div>
        <TileQueryActions {...props} />
      </div>
    </div>
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
