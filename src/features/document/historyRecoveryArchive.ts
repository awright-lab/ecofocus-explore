export interface HistoryArchiveRecord { store: string; key: unknown; value: unknown; }

// A tagged graph, not a workspace backup or restore format. Never coerce a
// damaged value to JSON (undefined, NaN, cycles and opaque UTF-16 matter).
export function encodeHistoryRecoveryArchive(databaseName: string, records: HistoryArchiveRecord[]): string {
  const nodes: unknown[] = [], seen = new Map<object, number>();
  function encode(value: unknown): unknown {
    if (value === null) return ["null"];
    if (typeof value === "string" || typeof value === "boolean") return [typeof value, value];
    if (typeof value === "undefined") return ["undefined"];
    if (typeof value === "bigint") return ["bigint", String(value)];
    if (typeof value === "number") return ["number", Object.is(value, -0) ? "-0" : Number.isNaN(value) ? "NaN" : value === Infinity ? "Infinity" : value === -Infinity ? "-Infinity" : value];
    if (typeof value !== "object") throw new Error("This recovery record contains an unsupported value. Its original storage has not been changed.");
    const known = seen.get(value); if (known !== undefined) return ["ref", known];
    const index = nodes.length; seen.set(value, index); nodes.push(null);
    if (value instanceof Date) nodes[index] = ["date", encode(value.getTime())];
    else if (value instanceof ArrayBuffer) nodes[index] = ["array-buffer", Array.from(new Uint8Array(value))];
    else if (Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null) {
      const entries = Object.entries(Object.getOwnPropertyDescriptors(value)).filter(([key]) => !(Array.isArray(value) && key === "length")).map(([key, descriptor]) => {
        if (!("value" in descriptor)) throw new Error("This recovery record contains an unsupported accessor. Its original storage has not been changed.");
        return [key, encode(descriptor.value)];
      });
      nodes[index] = Array.isArray(value) ? ["array", value.length, entries] : ["object", entries];
    } else throw new Error("This recovery record contains an unsupported storage type. Its original storage has not been changed.");
    return ["ref", index];
  }
  const entries = records.map(record => ({ store: record.store, key: encode(record.key), value: encode(record.value) }));
  return JSON.stringify({ kind: "ecofocus-history-storage-archive", version: 1, encoding: "tagged-graph-v1", databaseName, records: entries, nodes });
}
