import { useId, useMemo, useRef, useState } from "react";
import type { DashboardDraft } from "../../../../shared/types/dashboard";
import { applyReportColorTheme, removeReportColorTheme, validReportColorTheme, reportColorEligibility } from "../../design-system/reportColors";
import { useModalAccessibility } from "../hooks/useModalAccessibility";
export function ReportThemeControl({ dashboard, onChange }: { dashboard: DashboardDraft; onChange: (update: (current: DashboardDraft) => DashboardDraft) => void }) {
  const [open, setOpen] = useState(false);
  return <><button type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>Report colors</button>{open && <ReportThemeDialog dashboard={dashboard} onChange={onChange} onClose={() => setOpen(false)} />}</>;
}
function ReportThemeDialog({ dashboard, onChange, onClose }: { dashboard: DashboardDraft; onChange: (update: (current: DashboardDraft) => DashboardDraft) => void; onClose: () => void }) {
  const ref = useRef<HTMLElement | null>(null), title = useId(); useModalAccessibility(ref, onClose);
  const active = validReportColorTheme(dashboard.reportColorTheme) ? dashboard.reportColorTheme : null;
  const options = dashboard.designLibrary.palettes.filter(palette => palette.colors.length && palette.colors.every(color => /^#[0-9a-f]{6}$/i.test(color)));
  const [selected, setSelected] = useState(options.find(p => p.colors.join() === active?.palette.join())?.id ?? options[0]?.id ?? "");
  const palette = options.find(option => option.id === selected);
  const preview = useMemo(() => palette ? applyReportColorTheme(dashboard, palette.colors) : null, [dashboard, palette]);
  const tiles = dashboard.pages.flatMap(page => page.tiles), skipped = tiles.filter(tile => reportColorEligibility(tile)), overrides = tiles.filter(tile => Object.keys(tile.appearance.barStyles).length).length;
  return <div className="export-preflight-backdrop" onMouseDown={onClose}><section className="export-preflight-dialog report-theme-dialog" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={title} onMouseDown={e => e.stopPropagation()}>
    <header><div><h2 id={title}>Consistent report colors</h2><p>Keep the same category or audience color when results are filtered, reordered or added across this report.</p></div><button onClick={onClose}>Cancel colors</button></header>
    <p>Colors follow recorded study and field IDs, not renamed labels. Different fields or studies are not assumed equivalent. Your existing per-chart color overrides stay in place.</p>
    <p>{tiles.length} charts across {dashboard.pages.length} pages. {overrides} charts have explicit style overrides. {active ? `${tiles.filter(tile => tile.appearance.reportColorsEnabled === false).length} charts currently use individual palettes.` : "Report-wide colors are off."}</p>
    {skipped.length > 0 && <div role="status"><strong>{skipped.length} analyses need refresh and keep their chart colors</strong><ul>{skipped.map(tile => <li key={tile.id}>{tile.title || tile.name}: {reportColorEligibility(tile)}</li>)}</ul></div>}
    <label>Report palette<select value={selected} onChange={e => setSelected(e.target.value)}>{options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
    {palette && <div className="report-theme-swatches" aria-label="Selected palette">{palette.colors.map((color, index) => <span key={index} style={{ background: color }} role="img" aria-label={color} title={color} />)}</div>}
    <p>The palette repeats for larger sets. Labels remain essential; color alone does not identify a result. Choosing an individual chart palette later opts that chart out. Applying here includes every chart again.</p>
    <p>{preview?.reportColorTheme?.slots.length ?? 0} recorded category/audience assignments retained. Assignments remain stable when a category temporarily disappears. Theme changes keep their assignments and use the new palette.</p>
    <div className="report-theme-actions"><button disabled={!preview} onClick={() => { if (preview) { onChange(current => current.id === dashboard.id ? applyReportColorTheme(current, palette!.colors) : current); onClose(); } }}>Apply colors across report</button>{active && <button onClick={() => { onChange(current => current.id === dashboard.id ? removeReportColorTheme(current) : current); onClose(); }}>Restore individual palettes</button>}</div>
    <p>Use Undo to reverse this change. Page backgrounds, typography, data and chart layouts remain unchanged.</p>
  </section></div>;
}
