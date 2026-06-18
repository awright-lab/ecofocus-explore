import { useState } from "react";
import {
  bannerDimensions,
  comparisonDatasetOptions,
  defaultDataset,
  filterDimensions
} from "../builderConstants";
import type { BreakById, ComparisonMode, DatasetId, FilterFieldId, Metric, WeightId } from "../../../../shared/types/analytics";
import type { BuilderInspectorProps } from "./BuilderInspector";
import {
  buildSavedTileSettingConfirmation,
  buildTileQueryActionState,
  buildTileQueryStatus,
  type SavedTileSettingKind,
  tileRefreshQuery,
  toggleTileComparisonDataset,
  updateTileBanner,
  updateTileComparisonMode,
  updateTileFilterField,
  updateTileFilterValue,
  updateTileMetric,
  updateTileWeight
} from "./inspectorTileQueryModel";

export function TileQuestionConfigSection(props: BuilderInspectorProps) {
  const { selectedTile, selectedTileQuestion, updateSelectedTile } = props;

  if (!selectedTile || !selectedTileQuestion) {
    return null;
  }

  return (
    <div className="compact-grid">
      <label>
        Banner
        <select
          value={selectedTile.query.breakBy}
          disabled={selectedTile.query.comparisonMode === "wave"}
          onChange={(event) => updateSelectedTile(updateTileBanner(selectedTile, event.target.value as BreakById))}
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
          onChange={(event) => updateSelectedTile(updateTileMetric(selectedTile, event.target.value as Metric))}
        >
          {selectedTileQuestion.allowedMetrics.map((item) => (
            <option value={item} key={item}>
              {defaultDataset.metrics.find((metricItem) => metricItem.id === item)?.label ?? item}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function TileComparisonControls(props: BuilderInspectorProps) {
  const { selectedTile, updateSelectedTile } = props;

  if (!selectedTile) {
    return null;
  }

  const comparisonMode = selectedTile.query.comparisonMode ?? "none";
  const activeComparisons = selectedTile.query.comparisonDatasets ?? [];

  return (
    <>
      <div className="compact-grid">
        <label>
          Comparison
          <select
            value={comparisonMode}
            onChange={(event) => updateSelectedTile(updateTileComparisonMode(selectedTile, event.target.value as ComparisonMode))}
          >
            <option value="none">None</option>
            <option value="wave">Wave comparison</option>
          </select>
        </label>
        {comparisonMode === "wave" ? (
          <div className="explorer-meta-block">
            <span>Wave comparison locks the banner to Summary.</span>
          </div>
        ) : (
          <div className="explorer-meta-block">
            <span>Use comparisons to trend the same question across waves.</span>
          </div>
        )}
      </div>
      {comparisonMode === "wave" && (
        <div className="explorer-section-card compact nested">
          <div className="explorer-section-header">
            <strong>Comparison waves</strong>
            <small>Select one or more historical datasets</small>
          </div>
          <div className="explorer-chip-row comparison-chip-row">
            {comparisonDatasetOptions.map((dataset) => {
              const active = activeComparisons.includes(dataset.id);
              return (
                <button
                  type="button"
                  key={dataset.id}
                  className={active ? "explorer-chip-button active" : "explorer-chip-button secondary-chip"}
                  onClick={() => updateSelectedTile(toggleTileComparisonDataset(selectedTile, dataset.id as DatasetId))}
                >
                  {dataset.wave}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

export function TileFilterWeightControls(props: BuilderInspectorProps) {
  const { selectedTile, selectedTileFilterDimension, updateSelectedTile } = props;

  if (!selectedTile) {
    return null;
  }

  return (
    <>
      <div className="compact-grid">
        <label>
          Weight
          <select
            value={selectedTile.query.weight ?? "none"}
            onChange={(event) => updateSelectedTile(updateTileWeight(selectedTile, event.target.value === "none" ? null : (event.target.value as WeightId)))}
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
            onChange={(event) => updateSelectedTile(updateTileFilterField(selectedTile, event.target.value === "none" ? null : (event.target.value as FilterFieldId)))}
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
            onChange={(event) => updateSelectedTile(updateTileFilterValue(selectedTile, selectedTileFilterDimension.id, event.target.value))}
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
    </>
  );
}

export function TileQueryActions(props: BuilderInspectorProps) {
  const {
    selectedTile,
    rerunTileAnalysis,
    saveSelectedTileVariableSet,
    saveSelectedTileBanner,
    saveSelectedTileFilter,
    saveSelectedTileWeight,
    isLoading
  } = props;
  const [confirmation, setConfirmation] = useState<{ tileId: string; message: string } | null>(null);
  const [saveConfirmation, setSaveConfirmation] = useState<{ tileId: string; label: string; message: string } | null>(null);

  if (!selectedTile) {
    return null;
  }
  const tile = selectedTile;
  const queryStatus = buildTileQueryStatus(tile);
  const actionState = buildTileQueryActionState(queryStatus, isLoading);

  async function refreshSelectedTile() {
    const refreshed = await rerunTileAnalysis(tile, tileRefreshQuery(tile));
    if (!refreshed) return;
    setConfirmation({ tileId: tile.id, message: "Results refreshed for the selected object." });
    setSaveConfirmation(null);
  }
  function saveReusableSetting(kind: SavedTileSettingKind, saveAction: () => void) {
    saveAction();
    const nextConfirmation = buildSavedTileSettingConfirmation(kind);
    setSaveConfirmation({ tileId: tile.id, ...nextConfirmation });
  }
  const showConfirmation = confirmation?.tileId === tile.id && !queryStatus.hasPendingChanges;
  const showSaveConfirmation = saveConfirmation?.tileId === tile.id && actionState.canSaveSettings;

  return (
    <>
      <div className="tile-query-action-copy">
        <span>{actionState.refreshHelperText}</span>
      </div>
      <button
        type="button"
        onClick={() => void refreshSelectedTile()}
        disabled={!actionState.canRefresh}
      >
        {actionState.refreshLabel}
      </button>
      {showConfirmation && (
        <div className="tile-query-action-confirmation" role="status">
          {confirmation.message}
        </div>
      )}
      <div className="tile-query-action-copy">
        <span>{actionState.saveHelperText}</span>
      </div>
      <div className="analysis-library-actions">
        <button type="button" className="secondary" onClick={() => saveReusableSetting("set", saveSelectedTileVariableSet)} disabled={!actionState.canSaveSettings}>Save set</button>
        <button type="button" className="secondary" onClick={() => saveReusableSetting("banner", saveSelectedTileBanner)} disabled={!actionState.canSaveSettings}>Save banner</button>
        <button type="button" className="secondary" onClick={() => saveReusableSetting("filter", saveSelectedTileFilter)} disabled={!actionState.canSaveSettings}>Save filter</button>
        <button type="button" className="secondary" onClick={() => saveReusableSetting("weight", saveSelectedTileWeight)} disabled={!actionState.canSaveSettings}>Save weight</button>
      </div>
      {showSaveConfirmation && (
        <div className="tile-query-action-confirmation" role="status">
          <strong>{saveConfirmation.label}</strong>
          <span>{saveConfirmation.message}</span>
        </div>
      )}
    </>
  );
}
