import { remoteRowsLimits, sourceKey, type RemoteRowsProvider, type Request, type Source } from './remoteRowsProvider';
/** Synthetic test/development fixture; no network or array proportional to the logical dataset. */
export function syntheticRemoteRows(source: Source, rowCount = 1_000_000, fieldCount = 10_000) {
  const stats = { schemaRequests: 0, rowRequests: 0, maxRowsGenerated: 0, maxFieldsGenerated: 0, maxColumnsRequested: 0 };
  function offset(request: Request, kind: string, length: number) {
    if (request.signal.aborted) throw new DOMException('Canceled', 'AbortError');
    if (sourceKey(request.source) !== sourceKey(source)) throw Error('Source revision changed.');
    if (request.cursor === null) return 0;
    const prefix = `${kind}:`, number = request.cursor.startsWith(prefix) ? Number(request.cursor.slice(prefix.length)) : NaN;
    if (!Number.isSafeInteger(number) || number < 0 || number >= length) throw Error('Invalid synthetic cursor.');
    return number;
  }
  const provider: RemoteRowsProvider = {
    async schema(request) {
      stats.schemaRequests++; const from = offset(request, 'f', fieldCount), count = Math.min(request.limit, remoteRowsLimits.fields, fieldCount - from);
      stats.maxFieldsGenerated = Math.max(stats.maxFieldsGenerated, count);
      return { source, cursor: request.cursor, nextCursor: from + count < fieldCount ? `f:${from + count}` : null, items: Array.from({ length: count }, (_, i) => ({ id: `field-${from + i}`, label: `Synthetic field ${from + i}`, sourceColumn: `column-${from + i}` })) };
    },
    async rows(request) {
      stats.rowRequests++; const from = offset(request, 'r', rowCount), count = Math.min(request.limit, remoteRowsLimits.rows, rowCount - from);
      stats.maxRowsGenerated = Math.max(stats.maxRowsGenerated, count); stats.maxColumnsRequested = Math.max(stats.maxColumnsRequested, request.columns.length);
      const items = Array.from({ length: count }, (_, i) => { const position = from + i; const values: Record<string, string | number | null> = Object.create(null); for (const id of request.columns) { const n = Number(id.slice(6)); if (!/^field-\d+$/.test(id) || n >= fieldCount) throw Error('Unknown synthetic field.'); if (position % 4 === 1) values[id] = ''; else if (position % 4 === 2) values[id] = null; else if (position % 4 === 3) values[id] = 0; } return { position: String(position + 1), values }; });
      return { source, columns: [...request.columns], cursor: request.cursor, nextCursor: from + count < rowCount ? `r:${from + count}` : null, items };
    },
  };
  return { provider, stats };
}
