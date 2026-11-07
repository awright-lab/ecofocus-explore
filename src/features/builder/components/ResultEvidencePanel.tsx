import { resultIdentityIssue } from "../../../../shared/analytics/resultIdentities";
import { useId, useMemo, useState } from "react";
import type { DashboardTile } from "../../../../shared/types/dashboard";
import { buildResultEvidence, resultRowLabelOverride } from "../../analytics/resultEvidence";
export default function ResultEvidencePanel({ tile }: { tile: DashboardTile }) {
  const issue = resultIdentityIssue(tile.result);
  if (issue) return <details className="result-evidence-panel" data-canvas-keyboard-scope="controls"><summary>Explain a result</summary><p role="alert">{issue}</p></details>;
  return <ValidResultEvidencePanel tile={tile} />;
}
function ValidResultEvidencePanel({ tile }: { tile: DashboardTile }) {
  const prefix = useId();
  const owner = useMemo(() => ({}), [tile.id, tile.result]);
  const empty = { owner, rowId: "", columnId: "", search: "", columnSearch: "" };
  const [selection, setSelection] = useState(empty);
  const { rowId, columnId, search, columnSearch } = selection.owner === owner ? selection : empty;
  function updateSelection(update: Partial<Omit<typeof empty, "owner">>) {
    setSelection(previous => ({ ...(previous.owner === owner ? previous : empty), ...update, owner }));
  }
  const rows = tile.result.table, columns = tile.result.columns;
  const row = rows.find(item => item.optionId === rowId) ?? rows[0], column = columns.find(item => item.id === columnId) ?? columns[0];
  const activeSearch = rows.length > 20 ? search.trim().toLocaleLowerCase() : "";
  const displayRowLabel = (item: typeof rows[number]) => {
    const display = resultRowLabelOverride(tile, item.optionId)?.trim();
    return display && display !== item.label ? `${display} (source: ${item.label})` : item.label;
  };
  const matching = rows.filter(item => displayRowLabel(item).toLocaleLowerCase().includes(activeSearch));
  const visible = matching.slice(0, 200);
  const rowLabels = new Map<string, number>(), rowPositions = new Map<string, number>();
  rows.forEach((item, index) => { rowLabels.set(item.label, (rowLabels.get(item.label) ?? 0) + 1); rowPositions.set(item.optionId, index + 1); });
  if (row && !visible.some(item => item.optionId === row.optionId)) visible.push(row);
  const activeColumnSearch = columns.length > 20 ? columnSearch.trim().toLocaleLowerCase() : "";
  const matchingColumns = columns.filter(item => item.label.toLocaleLowerCase().includes(activeColumnSearch));
  const visibleColumns = matchingColumns.slice(0, 200);
  const columnLabels = new Map<string, number>();
  columns.forEach(item => columnLabels.set(item.label, (columnLabels.get(item.label) ?? 0) + 1));
  const columnPositions = new Map(columns.map((item, index) => [item.id, index + 1]));
  if (column && !visibleColumns.some(item => item.id === column.id)) visibleColumns.push(column);
  const evidence = useMemo(() => row && column ? buildResultEvidence(tile, row.optionId, column.id) : null, [tile, row?.optionId, column?.id]);
  return <details className="result-evidence-panel" data-canvas-keyboard-scope="controls">
    <summary>Explain a result</summary>
    <p>Choose a row and column to inspect the recorded value and its context.</p>
    {!evidence ? <p>No result cells are available to explain.</p> : <>
      {rows.length > 20 && <label htmlFor={`${prefix}-search`}>Find a result row<input id={`${prefix}-search`} value={search} onChange={event => updateSelection({ search: event.target.value })} /></label>}
      <label htmlFor={`${prefix}-row`}>Result row<select id={`${prefix}-row`} value={row.optionId} onChange={event => updateSelection({ rowId: event.target.value })}>{visible.map(item => <option key={item.optionId} value={item.optionId}>{rowLabels.get(item.label)! > 1 ? `${displayRowLabel(item)} (row ${rowPositions.get(item.optionId)})` : displayRowLabel(item)}</option>)}</select></label>
      {matching.length > 200 && <p role="status">Showing the first 200 of {matching.length.toLocaleString()} matching rows. Search to narrow the list.</p>}
      {activeSearch && matching.length === 0 && <p role="status">No rows match. Your current row remains selected.</p>}
      {columns.length > 20 && <label htmlFor={`${prefix}-column-search`}>Find a result column<input id={`${prefix}-column-search`} value={columnSearch} onChange={event => updateSelection({ columnSearch: event.target.value })} /></label>}
      <label htmlFor={`${prefix}-column`}>Result column<select id={`${prefix}-column`} value={column.id} onChange={event => updateSelection({ columnId: event.target.value })}>{visibleColumns.map(item => <option key={item.id} value={item.id}>{columnLabels.get(item.label)! > 1 || !item.label.trim() ? `${item.label || "Unnamed column"} (column ${columnPositions.get(item.id)})` : item.label}</option>)}</select></label>
      {matchingColumns.length > 200 && <p role="status">Showing the first 200 of {matchingColumns.length.toLocaleString()} matching columns. Search to narrow the list.</p>}
      {activeColumnSearch && matchingColumns.length === 0 && <p role="status">No columns match. Your current column remains selected.</p>}
      <section aria-label="Recorded result explanation">
        <h3>{evidence.heading}</h3>
        {!evidence.settingsCurrent && <p className="result-evidence-warning" role="status">The edited settings differ from the saved result. This explanation describes the saved result; refresh the analysis to apply your edits.</p>}
        <dl>{evidence.facts.map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>
        <p>{evidence.explanation}</p>
        {evidence.cellWarnings.map(warning => <p key={warning} className="result-evidence-warning" role="status">{warning}</p>)}
        {evidence.warnings.length > 0 && <details><summary>Notes for the whole result ({evidence.warnings.length})</summary><ul>{evidence.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul></details>}
      </section>
    </>}
  </details>;
}
