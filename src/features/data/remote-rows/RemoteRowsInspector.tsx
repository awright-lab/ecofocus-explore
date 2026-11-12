import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useModalAccessibility } from '../../builder/hooks/useModalAccessibility';
import { remoteRowsLimits as limits, sourceKey, validSource, validateRows, validateSchema, type Field, type Page, type RemoteRowsProvider, type Row, type Source } from './remoteRowsProvider';
import './remoteRows.css';

type Props = { source: Source; provider?: RemoteRowsProvider; onClose: () => void };
type Owner = { provider: RemoteRowsProvider; key: string };
type Navigation = { owner: Owner; cursors: (string | null)[]; index: number };
const sameOwner = (a: Owner | null | undefined, b: Owner | null | undefined) => !!a && !!b && a.provider === b.provider && a.key === b.key;
const start = (owner: Owner): Navigation => ({ owner, cursors: [null], index: 0 });
function next(nav: Navigation, cursor: string): Navigation {
  if (nav.cursors.slice(0, nav.index + 1).includes(cursor)) throw Error('The provider returned a repeated cursor.');
  const cursors = [...nav.cursors.slice(0, nav.index + 1), cursor].slice(-limits.history);
  return { ...nav, cursors, index: cursors.length - 1 };
}
export function RemoteRowsInspector({ source, provider, onClose }: Props) {
  const modal = useRef<HTMLElement>(null), title = useId(), description = useId();
  useModalAccessibility(modal, onClose);
  const key = sourceKey(source), owner: Owner | null = provider && validSource(source) ? { provider, key } : null;
  const latest = useRef({ owner, columns: '' }); latest.current.owner = owner;
  const [generation, setGeneration] = useState(0), [schemaNav, setSchemaNav] = useState<Navigation | null>(null), [rowNav, setRowNav] = useState<Navigation | null>(null);
  const [selectedState, setSelectedState] = useState<{ owner: Owner; fields: Field[] } | null>(null);
  const selected = sameOwner(selectedState?.owner, owner) ? selectedState!.fields : [];
  const columns = JSON.stringify(selected.map(f => f.id)); latest.current.columns = columns;
  const selectedRef = useRef(selected); selectedRef.current = selected;
  const schema = owner && sameOwner(schemaNav?.owner, owner) ? schemaNav! : owner ? start(owner) : null;
  const rows = owner && rowNav?.owner.provider === owner.provider && rowNav.owner.key === `${key}:${columns}` ? rowNav : owner ? start({ ...owner, key: `${key}:${columns}` }) : null;
  const [schemaPage, setSchemaPage] = useState<{ owner: Owner; cursor: string | null; value: Page<Field> } | null>(null);
  const [rowPage, setRowPage] = useState<{ owner: Owner; cursor: string | null; value: Page<Row> } | null>(null);
  const [schemaStatus, setSchemaStatus] = useState(''), [rowStatus, setRowStatus] = useState(''), [schemaAttempt, setSchemaAttempt] = useState(0), [rowAttempt, setRowAttempt] = useState(0);
  const [inspected, setInspected] = useState<{ owner: Owner; cursor: string | null; row: Row; field: Field } | null>(null);
  const cache = useRef<Array<{ owner: Owner; cursor: string | null; value: Page<Row> }>>([]);
  const controllers = useRef<{ schema?: AbortController; rows?: AbortController }>({});
  const schemaCursor = schema?.cursors[schema.index] ?? null, rowCursor = rows?.cursors[rows.index] ?? null;
  const rowOwner = rows?.owner ?? null;
  const schemaCurrent = schemaPage && sameOwner(schemaPage.owner, owner) && schemaPage.cursor === schemaCursor ? schemaPage.value : null;
  const rowCurrent = rowPage && sameOwner(rowPage.owner, rowOwner) && rowPage.cursor === rowCursor ? rowPage.value : null;
  useEffect(() => {
    cache.current = []; setInspected(null);
    return () => { controllers.current.schema?.abort(); controllers.current.rows?.abort(); };
  }, [provider, key, generation]);
  useEffect(() => {
    if (!owner || !schema) return;
    const ac = new AbortController(); controllers.current.schema = ac; setSchemaPage(null); setSchemaStatus('Loading field page…');
    const request = { source: { ...source }, cursor: schemaCursor, limit: limits.fields, maxBytes: limits.bytes, signal: ac.signal };
    void owner.provider.schema(request).then(raw => {
      if (ac.signal.aborted || !sameOwner(latest.current.owner, owner)) return;
      const value = validateSchema(raw, request);
      if (selectedRef.current.some(f => value.items.some(g => g.id === f.id && (g.label !== f.label || g.sourceColumn !== f.sourceColumn)))) { controllers.current.rows?.abort(); cache.current = []; setSelectedState(null); setRowPage(null); setInspected(null); throw Error('A selected field identity changed. Refresh the inspector.'); }
      setSchemaPage({ owner, cursor: schemaCursor, value }); setSchemaStatus('');
    }).catch(error => { if (!ac.signal.aborted && sameOwner(latest.current.owner, owner)) { setSchemaPage(null); setSchemaStatus(error instanceof Error ? error.message : 'Field page unavailable.'); } });
    return () => ac.abort();
  // The selected list is deliberately not a dependency: choosing a field does not refetch the catalog.
  }, [provider, key, schemaCursor, schemaAttempt, generation]);
  useEffect(() => {
    setInspected(null);
    if (!owner || !rowOwner || !selected.length) { setRowPage(null); setRowStatus('Select at least one field to load rows.'); return; }
    const ac = new AbortController(); controllers.current.rows = ac; const currentColumns = selected.map(f => f.id);
    const hit = cache.current.find(entry => sameOwner(entry.owner, rowOwner) && entry.cursor === rowCursor);
    if (hit) { cache.current = [hit, ...cache.current.filter(entry => entry !== hit)].slice(0, limits.cache); setRowPage(hit); setRowStatus(''); return () => ac.abort(); }
    setRowPage(null); setRowStatus('Loading row page…');
    const request = { source: { ...source }, cursor: rowCursor, columns: currentColumns, limit: limits.rows, maxBytes: limits.bytes, signal: ac.signal };
    void owner.provider.rows(request).then(raw => {
      if (ac.signal.aborted || !sameOwner(latest.current.owner, owner) || latest.current.columns !== columns) return;
      const value = validateRows(raw, request), entry = { owner: rowOwner, cursor: rowCursor, value };
      cache.current = [entry, ...cache.current.filter(item => !(sameOwner(item.owner, rowOwner) && item.cursor === rowCursor))].slice(0, limits.cache); setRowPage(entry); setRowStatus('');
    }).catch(error => { if (!ac.signal.aborted && sameOwner(latest.current.owner, owner) && latest.current.columns === columns) { setRowPage(null); setRowStatus(error instanceof Error ? error.message : 'Row page unavailable.'); } });
    return () => ac.abort();
  }, [provider, key, columns, rowCursor, rowAttempt, generation]);
  function toggle(field: Field) {
    if (!owner) return; const exists = selected.some(f => f.id === field.id);
    const fields = exists ? selected.filter(f => f.id !== field.id) : selected.length < limits.selected ? [...selected, field] : selected;
    controllers.current.rows?.abort(); cache.current = []; setInspected(null); setRowPage(null); setRowNav(null); setSelectedState({ owner, fields });
  }
  function refresh() { controllers.current.schema?.abort(); controllers.current.rows?.abort(); cache.current = []; setSchemaNav(null); setRowNav(null); setSelectedState(null); setSchemaPage(null); setRowPage(null); setInspected(null); setGeneration(n => n + 1); }
  function cancel() { controllers.current.schema?.abort(); controllers.current.rows?.abort(); setSchemaStatus('Loading canceled. Retry or refresh.'); setRowStatus('Loading canceled. Retry or refresh.'); }
  const inspection = inspected && rowCurrent && sameOwner(inspected.owner, rowOwner) && inspected.cursor === rowCursor ? inspected : null;
  return createPortal(<div className="remote-rows-backdrop" data-canvas-keyboard-scope="controls"><section className="remote-rows-dialog" ref={modal} role="dialog" aria-modal="true" aria-labelledby={title} aria-describedby={description} tabIndex={-1} onKeyDown={e => e.stopPropagation()}>
    <header><div><h2 id={title}>Inspect remote rows</h2><p id={description}>Read-only pages, not a complete dataset. Row positions identify source rows, not necessarily people.</p></div><button type="button" onClick={onClose}>Close</button></header>
    {!owner ? <p role="alert">Remote row inspection is unavailable: no supported provider or valid dataset and schema revisions were supplied.</p> : <>
    <p>Dataset {source.datasetId} · data revision {source.datasetRevision} · schema revision {source.schemaRevision}</p>
    <div className="remote-rows-controls"><button type="button" onClick={refresh}>Refresh</button><button type="button" onClick={cancel}>Cancel loading</button></div>
    <h3>Choose fields</h3><p>Choose up to {limits.selected} fields. Field pages are loaded separately; selection only requests those columns.</p>
    {schemaStatus && <p role="status">{schemaStatus} <button type="button" onClick={() => setSchemaAttempt(n => n + 1)}>Retry fields</button></p>}
    {schemaCurrent && <><div className="remote-rows-fields">{schemaCurrent.items.map(field => <label key={field.id}><input type="checkbox" checked={selected.some(f => f.id === field.id)} disabled={selected.length >= limits.selected && !selected.some(f => f.id === field.id)} onChange={() => toggle(field)}/><span>{field.label || '(Unlabeled)'} <small>{field.sourceColumn} · {field.id}</small></span></label>)}</div>{!schemaCurrent.items.length && <p>No fields on this page.</p>}</>}
    <div className="remote-rows-controls"><button type="button" disabled={!schema || schema.index === 0} onClick={() => schema && setSchemaNav({ ...schema, index: schema.index - 1 })}>Previous fields</button><button type="button" disabled={!schemaCurrent?.nextCursor} onClick={() => { if (schema && schemaCurrent?.nextCursor) try { setSchemaNav(next(schema, schemaCurrent.nextCursor)); } catch (e) { setSchemaPage(null); setSchemaStatus((e as Error).message); } }}>Next fields</button></div>
    <p>Selected: {selected.length ? selected.map(f => `${f.label || '(Unlabeled)'} [${f.id}]`).join(', ') : 'none'}. Cursor history is limited to {limits.history} pages.</p>
    <h3>Loaded row page</h3><p>No total, full-dataset search, sorting or arbitrary page jumps are provided. At most {limits.rows} rows and {limits.selected} fields are displayed.</p>
    {rowStatus && <p role="status">{rowStatus} {selected.length > 0 && <button type="button" onClick={() => setRowAttempt(n => n + 1)}>Retry rows</button>}</p>}
    {rowCurrent && <><div className="remote-rows-table" tabIndex={0} role="region" aria-label="Loaded remote rows"><table><caption>Current loaded page only. Select a value to inspect it.</caption><thead><tr><th scope="col">Source row</th>{selected.map(f => <th scope="col" key={f.id}>{f.label || '(Unlabeled)'}<small>{f.sourceColumn} · {f.id}</small></th>)}</tr></thead><tbody>{rowCurrent.items.map(row => <tr key={row.position}><th scope="row">{row.position}</th>{selected.map(field => { const has = Object.hasOwn(row.values, field.id), value = has ? JSON.stringify(row.values[field.id]) : 'Missing'; return <td key={field.id}><button type="button" onClick={() => rowOwner && setInspected({ owner: rowOwner, cursor: rowCursor, row, field })} aria-label={`Inspect row ${row.position}, ${field.label} [${field.id}]: ${value.slice(0, 100)}`}>{value.length > 80 ? `${value.slice(0, 80)}…` : value}</button></td>; })}</tr>)}</tbody></table></div>{!rowCurrent.items.length && <p>No rows on this page.</p>}</>}
    <div className="remote-rows-controls"><button type="button" disabled={!rows || rows.index === 0} onClick={() => rows && setRowNav({ ...rows, index: rows.index - 1 })}>Previous rows</button><button type="button" disabled={!rowCurrent?.nextCursor} onClick={() => { if (rows && rowCurrent?.nextCursor) try { setRowNav(next(rows, rowCurrent.nextCursor)); } catch (e) { setRowPage(null); setRowStatus((e as Error).message); } }}>Next rows</button></div>
    <section aria-label="Exact value"><h3>Exact value</h3>{inspection ? <><p>Source row {inspection.row.position} · field {inspection.field.label} [{inspection.field.id}]</p><label>Escaped value<textarea readOnly rows={4} value={Object.hasOwn(inspection.row.values, inspection.field.id) ? JSON.stringify(inspection.row.values[inspection.field.id]) : 'Missing property'}/></label></> : <p>Select a cell on the current page. Missing properties, empty strings, null and numeric zero are distinct.</p>}</section>
    </>}
  </section></div>, document.body);
}
