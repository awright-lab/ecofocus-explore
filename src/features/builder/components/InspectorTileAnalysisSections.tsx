import { useState } from "react";
import type React from "react";
import { getChartTypeLabel, getCompatibleChartTypes } from "../../analytics/analyticsDisplay";
import type { ChartType } from "../../../../shared/types/analytics";
import type { BuilderInspectorProps } from "./BuilderInspector";
import {
  buildSettingProvenancePickerView,
  buildSettingProvenanceRows,
  updatesForSavedBanner,
  updatesForSavedFilter,
  updatesForSavedWeight,
  type SettingProvenanceEmptyState,
  type SettingProvenanceOption,
  type SettingProvenanceRow
} from "./inspectorSettingProvenanceModel";
import {
  buildRelatedAnalyticalObjectsView,
  type RelatedAnalyticalObjectsView
} from "./inspectorRelatedObjectsModel";
import { buildInspectorTileSummary } from "./inspectorTileSummaryModel";
import {
  buildSavedTileSettingConfirmation,
  buildTileQueryActionState,
  buildTileQueryStatus,
  type SavedTileSettingConfirmation,
  type SavedTileSettingKind
} from "./inspectorTileQueryModel";
import {
  TileComparisonControls,
  TileFilterWeightControls,
  TileQueryActions,
  TileQuestionConfigSection
} from "./InspectorTileQuerySections";

export function TileAnalysisResultSection(props: BuilderInspectorProps) {
  const { activePage, selectedTile, updateSelectedTile } = props;

  if (!selectedTile) {
    return null;
  }
  const summary = buildInspectorTileSummary(selectedTile);
  const relatedObjects = buildRelatedAnalyticalObjectsView(selectedTile, activePage.tiles);

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
                <div className="tile-handoff-source lifecycle">
                  <span>{summary.lifecycleLabel}</span>
                  <small>{summary.lifecycleDescription}</small>
                </div>
                <div className="explorer-chip-row">
                  {summary.lifecycleChips.map((chip) => (
                    <span className="explorer-chip" key={chip}>{chip}</span>
                  ))}
                </div>
                <div className="explorer-chip-row">
                  {summary.chips.map((chip) => (
                    <span className="explorer-chip" key={chip}>{chip}</span>
                  ))}
                </div>
                <RelatedAnalyticalObjectsCard view={relatedObjects} />
                <small className="tile-handoff-cue">{summary.editCue}</small>
              </div>
    </>
  );
}

function RelatedAnalyticalObjectsCard({ view }: { view: RelatedAnalyticalObjectsView }) {
  return (
    <div className="related-objects-card" aria-label="Related analytical objects">
      <div className="explorer-section-header">
        <strong>{view.label}</strong>
        <small>{view.description}</small>
      </div>
      {view.rows.length > 0 ? (
        <div className="related-objects-list">
          {view.rows.map((item) => (
            <div className="related-object-row" key={item.id}>
              <span>{item.title}</span>
              <small>{item.description}</small>
              <div className="explorer-chip-row">
                {item.badges.map((badge) => (
                  <span className="explorer-chip" key={badge}>{badge}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <small className="tile-handoff-cue">{view.emptyLabel}</small>
      )}
    </div>
  );
}

export function TileAnalysisQuerySection(props: BuilderInspectorProps) {
  const {
    selectedTile,
    selectedTileQuestion,
    savedBanners,
    savedFilters,
    savedWeights,
    updateSelectedTile,
    recordSavedSettingOriginCue,
    saveSelectedTileBanner,
    saveSelectedTileFilter,
    saveSelectedTileWeight,
    onViewSavedSettingInLibrary,
    isLoading
  } = props;
  const [saveConfirmation, setSaveConfirmation] = useState<(SavedTileSettingConfirmation & { tileId: string }) | null>(null);
  const [recentlySavedSetting, setRecentlySavedSetting] = useState<{ tileId: string; kind: Exclude<SavedTileSettingKind, "set"> } | null>(null);

  if (!selectedTile || !selectedTileQuestion) {
    return null;
  }
  const tile = selectedTile;
  const queryStatus = buildTileQueryStatus(tile);
  const actionState = buildTileQueryActionState(queryStatus, isLoading);
  const provenanceRows = buildSettingProvenanceRows(tile, savedBanners, savedFilters, savedWeights);
  const compatibleSavedBanners = savedBanners.filter((item) => selectedTileQuestion.allowedBreakBys.includes(item.breakBy));
  const pickerView = buildSettingProvenancePickerView(tile, compatibleSavedBanners, savedFilters, savedWeights);
  const bannerDisabled = (tile.query.comparisonMode ?? "none") === "wave";
  const activeBannerOption = pickerView.bannerOptions.find((item) => item.id === pickerView.activeBannerId);
  const activeFilterOption = pickerView.filterOptions.find((item) => item.id === pickerView.activeFilterId);
  const activeWeightOption = pickerView.weightOptions.find((item) => item.id === pickerView.activeWeightId);
  const showSaveConfirmation = saveConfirmation?.tileId === tile.id && actionState.canSaveSettings;
  const recentlySavedKind = recentlySavedSetting?.tileId === tile.id ? recentlySavedSetting.kind : null;

  function saveEmptyStateSetting(kind: Exclude<SavedTileSettingKind, "set">, saveAction: () => void) {
    saveAction();
    const nextConfirmation = buildSavedTileSettingConfirmation(kind);
    setSaveConfirmation({ tileId: tile.id, ...nextConfirmation });
    setRecentlySavedSetting({ tileId: tile.id, kind });
  }

  function applySavedBanner(optionId: string) {
    const nextBanner = compatibleSavedBanners.find((item) => item.id === optionId);
    if (!nextBanner) return;
    updateSelectedTile(updatesForSavedBanner(tile, nextBanner));
    recordSavedSettingOriginCue("banner", nextBanner.label, tile.id);
  }

  function applySavedFilter(optionId: string) {
    const nextFilter = savedFilters.find((item) => item.id === optionId);
    if (!nextFilter) return;
    updateSelectedTile(updatesForSavedFilter(tile, nextFilter));
    recordSavedSettingOriginCue("filter", nextFilter.label, tile.id);
  }

  function applySavedWeight(optionId: string) {
    const nextWeight = savedWeights.find((item) => item.id === optionId);
    if (!nextWeight) return;
    updateSelectedTile(updatesForSavedWeight(tile, nextWeight));
    recordSavedSettingOriginCue("weight", nextWeight.label, tile.id);
  }

  const provenancePickerConfigs = [
    {
      kind: "banner" as const,
      row: provenanceRows.find((row) => row.id === "banner"),
      options: pickerView.bannerOptions,
      activeOptionId: pickerView.activeBannerId,
      activeOption: activeBannerOption,
      emptyState: bannerDisabled ? { label: "Wave comparison uses Summary", helper: "Turn off wave comparison before applying a saved banner." } : pickerView.bannerEmptyState,
      placeholder: bannerDisabled ? "Wave comparison" : pickerView.bannerOptions.length === 0 ? "No saved banners" : "Apply saved banner",
      selectLabel: "Apply saved banner",
      disabled: bannerDisabled || pickerView.bannerOptions.length === 0,
      onApply: applySavedBanner,
      action:
        !bannerDisabled && pickerView.bannerOptions.length === 0
          ? {
            label: "Save current banner",
            disabled: !actionState.canSaveSettings,
            disabledReason: actionState.saveHelperText,
            onClick: () => saveEmptyStateSetting("banner", saveSelectedTileBanner)
          }
          : undefined
    },
    {
      kind: "filter" as const,
      row: provenanceRows.find((row) => row.id === "filter"),
      options: pickerView.filterOptions,
      activeOptionId: pickerView.activeFilterId,
      activeOption: activeFilterOption,
      emptyState: pickerView.filterEmptyState,
      placeholder: pickerView.filterOptions.length === 0 ? "No saved filters" : "Apply saved filter",
      selectLabel: "Apply saved filter",
      disabled: pickerView.filterOptions.length === 0,
      onApply: applySavedFilter,
      action:
        pickerView.filterOptions.length === 0
          ? {
            label: "Save current filter",
            disabled: !actionState.canSaveSettings,
            disabledReason: actionState.saveHelperText,
            onClick: () => saveEmptyStateSetting("filter", saveSelectedTileFilter)
          }
          : undefined
    },
    {
      kind: "weight" as const,
      row: provenanceRows.find((row) => row.id === "weight"),
      options: pickerView.weightOptions,
      activeOptionId: pickerView.activeWeightId,
      activeOption: activeWeightOption,
      emptyState: pickerView.weightEmptyState,
      placeholder: pickerView.weightOptions.length === 0 ? "No saved weights" : "Apply saved weight",
      selectLabel: "Apply saved weight",
      disabled: pickerView.weightOptions.length === 0,
      onApply: applySavedWeight,
      action:
        pickerView.weightOptions.length === 0
          ? {
            label: "Save current weight",
            disabled: !actionState.canSaveSettings,
            disabledReason: actionState.saveHelperText,
            onClick: () => saveEmptyStateSetting("weight", saveSelectedTileWeight)
          }
          : undefined
    }
  ];

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
        {provenancePickerConfigs.map((config) => (
          config.row && (
            <SettingProvenancePickerCard
              key={config.kind}
              row={config.row}
              options={config.options}
              activeOptionId={config.activeOptionId}
              activeOption={config.activeOption}
              emptyState={config.emptyState}
              placeholder={config.placeholder}
              selectLabel={config.selectLabel}
              disabled={config.disabled}
              recentlySaved={recentlySavedKind === config.kind && Boolean(config.activeOption)}
              action={config.action}
              onApply={config.onApply}
            />
          )
        ))}
      </div>
      {showSaveConfirmation && (
        <div className="tile-query-action-confirmation" role="status">
          <strong>{saveConfirmation.label}</strong>
          <span>{saveConfirmation.message}</span>
          <button type="button" className="secondary inline-action" onClick={() => onViewSavedSettingInLibrary(saveConfirmation.libraryView)}>
            View in library
          </button>
        </div>
      )}
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

function SettingProvenancePickerCard({
  row,
  options,
  activeOptionId,
  activeOption,
  emptyState,
  placeholder,
  selectLabel,
  disabled,
  recentlySaved,
  action,
  onApply
}: {
  row: SettingProvenanceRow;
  options: SettingProvenanceOption[];
  activeOptionId: string;
  activeOption?: SettingProvenanceOption;
  emptyState: SettingProvenanceEmptyState;
  placeholder: string;
  selectLabel: string;
  disabled: boolean;
  recentlySaved: boolean;
  action?: { label: string; disabled: boolean; disabledReason: string; onClick: () => void };
  onApply: (optionId: string) => void;
}) {
  return (
    <div className={row.saved ? "settings-provenance-item saved" : "settings-provenance-item"}>
      <span>{row.label}</span>
      <strong>{row.value}</strong>
      <small>{row.source}</small>
      <select
        aria-label={selectLabel}
        value={activeOptionId}
        disabled={disabled}
        onChange={(event) => onApply(event.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((item) => (
          <option value={item.id} key={item.id} title={item.description}>{item.label} - {item.summary}</option>
        ))}
      </select>
      <SettingProvenanceOptionDetail
        option={activeOption}
        recentlySaved={recentlySaved}
        emptyState={emptyState}
        action={action}
      />
    </div>
  );
}

function SettingProvenanceOptionDetail({
  option,
  recentlySaved = false,
  emptyState,
  action
}: {
  option?: SettingProvenanceOption;
  recentlySaved?: boolean;
  emptyState: SettingProvenanceEmptyState;
  action?: { label: string; disabled: boolean; disabledReason: string; onClick: () => void };
}) {
  return (
    <div className={option ? recentlySaved ? "settings-provenance-detail active recently-saved" : "settings-provenance-detail active" : "settings-provenance-detail"}>
      <span>{option?.summary ?? emptyState.label}</span>
      <small>{option?.description ?? emptyState.helper}</small>
      {recentlySaved && <small className="recently-saved-label">Newly saved reusable setting</small>}
      {!option && action && (
        <button type="button" className="mini-button" disabled={action.disabled} title={action.disabled ? action.disabledReason : undefined} onClick={action.onClick}>
          {action.label}
        </button>
      )}
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
