import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { DashboardTile } from "../../../../shared/types/dashboard";
import { buildHeatmapModel, heatmapScaleExplanation } from "../../analytics/heatmapModel";
import { ownAxisLabel } from "../../design-system/axisLabels";
import { CompleteTableDialog } from "./CompleteTableDialog";
import "./heatmap-view.css";

export function HeatmapView({ tile, format }: { tile: DashboardTile; format: (value: number | null) => string }) {
  const model = useMemo(() => buildHeatmapModel(tile.result), [tile.result]);
  const [complete, setComplete] = useState(false);
  const completeButton = useRef<HTMLButtonElement | null>(null), previousRegion = useRef<HTMLDivElement | null>(null), restoreFocus = useRef(false);
  const regionRef = useCallback((node: HTMLDivElement | null) => {
    if (!node && previousRegion.current?.contains(document.activeElement)) restoreFocus.current = true;
    previousRegion.current = node;
  }, []);
  useLayoutEffect(() => {
    if (!restoreFocus.current) return;
    restoreFocus.current = false;
    // Restore only after the focused region has disappeared. A full component
    // unmount runs no layout effect; unrelated control focus is never stolen.
    if ((!document.activeElement || document.activeElement === document.body) && completeButton.current?.isConnected) completeButton.current.focus();
  });
  const rows = tile.result.table.slice(0, 50), columns = tile.result.columns.slice(0, 12);
  const sample = tile.result.weighting.applied ? "W" : tile.result.query.weight ? "base (weight unconfirmed)" : "n";
  return <div className="heatmap-view" data-canvas-keyboard-scope="controls">
    {model.status === "unavailable" ? <p role="status">{model.reason}</p> : <>
      <p className="heatmap-key">{heatmapScaleExplanation} Range: {format(model.minimum)} to {format(model.maximum)}.</p>
      {(rows.length < tile.result.table.length || columns.length < tile.result.columns.length) && <p role="status">Preview: {rows.length} of {tile.result.table.length} rows and {columns.length} of {tile.result.columns.length} columns. The scale includes the entire recorded result.</p>}
      <div ref={regionRef} className="heatmap-scroll" tabIndex={0} role="region" aria-label="Heatmap values and sample bases">
        <table><caption>Recorded {tile.result.metric.label}; unmodified values and per-cell bases</caption><thead><tr><th scope="col" style={{ fontSize: tile.appearance.axisFontSize }}>Response</th>{columns.map(column => <th scope="col" key={column.id} style={{ fontSize: tile.appearance.axisFontSize }}>{ownAxisLabel(tile.appearance, column.id) ?? column.label}</th>)}</tr></thead>
          <tbody>{rows.map((row, r) => <tr key={row.optionId}><th scope="row" style={{ fontSize: tile.appearance.axisFontSize }}>{ownAxisLabel(tile.appearance, row.optionId) ?? row.label}</th>{columns.map((column, c) => { const cell = model.cells[r][c]; return <td key={column.id} data-heatmap-value={cell.value ?? "unavailable"} style={{ background: cell.fill, color: cell.ink, fontSize: tile.appearance.labelFontSize }}><strong>{cell.value === null ? "Unavailable" : format(cell.value)}</strong><small style={{fontSize:Math.max(8,tile.appearance.labelFontSize-1)}}>{cell.base === null ? "Base unavailable" : `${sample}=${cell.base}`}</small></td>; })}</tr>)}</tbody>
        </table>
      </div>
    </>}
    <button ref={completeButton} type="button" onClick={() => setComplete(true)}>Explore complete heatmap values</button>
    {complete && <CompleteTableDialog tile={tile} onClose={() => setComplete(false)} />}
  </div>;
}
