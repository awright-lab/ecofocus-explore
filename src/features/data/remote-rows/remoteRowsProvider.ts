/** Read-only adapter boundary. Providers must enforce maxBytes before decoding a response. */
export const remoteRowsLimits = Object.freeze({ rows: 25, fields: 40, selected: 8, bytes: 131072, cell: 8192, cursor: 1024, history: 10, cache: 3, identity: 512 });
export type Source = { datasetId: string; datasetRevision: string; schemaRevision: string };
export type Field = { id: string; label: string; sourceColumn: string };
export type RawValue = string | number | null;
export type Row = { position: string; values: Record<string, RawValue> };
export type Request = { source: Source; cursor: string | null; limit: number; maxBytes: number; signal: AbortSignal };
export type RemoteRowsProvider = {
  schema(request: Request): Promise<unknown>;
  rows(request: Request & { columns: readonly string[] }): Promise<unknown>;
};
export type Page<T> = { source: Source; cursor: string | null; nextCursor: string | null; items: T[] };
const object = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const bounded = (x: unknown, max: number = remoteRowsLimits.identity): x is string => typeof x === 'string' && x.length > 0 && x.length <= max;
const cursor = (x: unknown): x is string | null => x === null || bounded(x, remoteRowsLimits.cursor);
export function validSource(source: Source): boolean { return bounded(source.datasetId) && bounded(source.datasetRevision) && bounded(source.schemaRevision); }
export function sourceKey(source: Source): string { return JSON.stringify([source.datasetId, source.datasetRevision, source.schemaRevision]); }
function envelope(payload: unknown, request: Request): Record<string, unknown> {
  if (!validSource(request.source) || !cursor(request.cursor) || !Number.isInteger(request.limit) || request.limit < 1 || request.maxBytes !== remoteRowsLimits.bytes) throw Error('Invalid inspection request.');
  if (!object(payload)) throw Error('Malformed page response.');
  let size: number;
  try { size = new TextEncoder().encode(JSON.stringify(payload)).byteLength; } catch { throw Error('Malformed page response.'); }
  if (size > request.maxBytes) throw Error('Page response exceeded the size limit.');
  if (!object(payload.source) || sourceKey(payload.source as Source) !== sourceKey(request.source)) throw Error('The dataset or schema revision changed. Refresh from the current source.');
  if (!cursor(payload.cursor) || payload.cursor !== request.cursor || !cursor(payload.nextCursor) || payload.nextCursor !== null && payload.nextCursor === request.cursor) throw Error('Invalid or mismatched page cursor.');
  if (!Array.isArray(payload.items) || payload.items.length > request.limit) throw Error('Page response exceeded the item limit.');
  return payload;
}
function checkNormalizedSize(value: unknown, maxBytes: number) {
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > maxBytes) throw Error('Page response exceeded the size limit.');
}
export function validateSchema(payload: unknown, request: Request): Page<Field> {
  if (request.limit > remoteRowsLimits.fields) throw Error('Invalid field page limit.');
  const p = envelope(payload, request); const seen = new Set<string>();
  const items = (p.items as unknown[]).map(item => {
    if (!object(item) || !bounded(item.id) || typeof item.label !== 'string' || item.label.length > 512 || !bounded(item.sourceColumn) || seen.has(item.id)) throw Error('Malformed or ambiguous field page.');
    seen.add(item.id); return { id: item.id, label: item.label, sourceColumn: item.sourceColumn };
  });
  const result = { source: request.source, cursor: request.cursor, nextCursor: p.nextCursor as string | null, items };
  checkNormalizedSize(result, request.maxBytes); return result;
}
export function validateRows(payload: unknown, request: Request & { columns: readonly string[] }): Page<Row> {
  if (request.limit > remoteRowsLimits.rows) throw Error('Invalid row page limit.');
  if (!request.columns.length || request.columns.length > remoteRowsLimits.selected || new Set(request.columns).size !== request.columns.length || request.columns.some(id => !bounded(id))) throw Error('Invalid requested columns.');
  const p = envelope(payload, request), seen = new Set<string>();
  if (!Array.isArray(p.columns) || p.columns.length !== request.columns.length || p.columns.some((id, i) => id !== request.columns[i])) throw Error('Response columns do not match the request.');
  const items = (p.items as unknown[]).map(item => {
    if (!object(item) || !bounded(item.position) || seen.has(item.position) || !object(item.values)) throw Error('Malformed or ambiguous row page.');
    seen.add(item.position); const values: Record<string, RawValue> = Object.create(null);
    for (const [id, value] of Object.entries(item.values)) {
      if (!request.columns.includes(id) || !(value === null || typeof value === 'string' && value.length <= remoteRowsLimits.cell || typeof value === 'number' && Number.isFinite(value))) throw Error('Invalid or unexpected cell value.');
      values[id] = value as RawValue;
    }
    return { position: item.position, values };
  });
  const result = { source: request.source, cursor: request.cursor, nextCursor: p.nextCursor as string | null, items };
  checkNormalizedSize({ ...result, columns: request.columns }, request.maxBytes); return result;
}
