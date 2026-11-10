import type { DashboardTile, TileAppearance } from "../../../../shared/types/dashboard";
import { dotIntervalCandidate, dotIntervalMethod, dotIntervals, dotIntervalExplanation } from "../../analytics/dotPlotIntervals";
export function DotPlotIntervalControl({tile,onChange}:{tile:DashboardTile;onChange:(patch:Partial<TileAppearance>)=>void}) {
  let issue = "", binding = "";
  try { binding = dotIntervalCandidate(tile).binding; if (tile.appearance.dotPlotIntervals !== undefined) dotIntervals(tile); }
  catch (error) { issue = error instanceof Error ? error.message : "Intervals are unavailable."; }
  const enabled = tile.appearance.dotPlotIntervals !== undefined;
  return <div><label><input type="checkbox" aria-label="Show individual 95% Wilson intervals" checked={enabled} disabled={!enabled && !!issue} onChange={event=>onChange({dotPlotIntervals:event.target.checked?{method:dotIntervalMethod,binding}:undefined})}/>
    I confirm independent, unweighted respondents without a complex survey design: show individual 95% Wilson intervals
  </label><small>{dotIntervalExplanation} Intervals are chart overlays; analytical Excel retains values and bases, not these interval drawings. Rendered outputs must fit the complete chart or refuse it.</small>{issue && <p role="status">{issue}</p>}</div>;
}
