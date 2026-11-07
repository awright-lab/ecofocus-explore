export class JsonSizeBudgetError extends Error {}

/** UTF-16 characters in JSON.stringify's quoted string, without allocating it. */
export function quotedJsonLength(value: string, maximum = Number.MAX_SAFE_INTEGER): number {
  let size = value.length + 2;
  if (size > maximum) throw new JsonSizeBudgetError("JSON character budget exceeded.");
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code === 34 || code === 92 || code === 8 || code === 9 || code === 10 || code === 12 || code === 13) size++;
    else if (code < 32) size += 5;
    else if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) i++;
      else size += 5;
    } else if (code >= 0xdc00 && code <= 0xdfff) size += 5;
    if (size > maximum) throw new JsonSizeBudgetError("JSON character budget exceeded.");
  }
  return size;
}

/** Counts plain JSON data exactly as compact JSON, including repeated aliases.
 * No output string is built; accessors/custom serialization are refused. */
export function assertJsonSize(value: unknown, limits: { maxChars: number; maxNodes: number; maxDepth: number }) {
  if (![limits.maxChars, limits.maxNodes, limits.maxDepth].every(n => Number.isSafeInteger(n) && n > 0)) throw new Error("Invalid JSON size limits.");
  if (Object.getOwnPropertyDescriptor(Object.prototype, "toJSON") || Object.getOwnPropertyDescriptor(Array.prototype, "toJSON")) throw new Error("Custom JSON serialization is unsupported for a bounded backup.");
  let characters = 0, nodes = 0;
  const active = new WeakSet<object>(), keys = new Map<string, number>();
  function charge(size: number) {
    if (size > limits.maxChars - characters) throw new JsonSizeBudgetError("JSON character budget exceeded.");
    characters += size;
  }
  function work(depth: number) {
    if (++nodes > limits.maxNodes) throw new JsonSizeBudgetError("JSON value-count budget exceeded.");
    if (depth > limits.maxDepth) throw new JsonSizeBudgetError("JSON nesting budget exceeded.");
  }
  function memberValue(object: object, key: string) {
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    if (!descriptor) return undefined;
    if (!Object.hasOwn(descriptor, "value")) throw new Error("Accessor values cannot be backed up without changing their meaning.");
    return descriptor.value as unknown;
  }
  function visit(item: unknown, depth: number, arraySlot = false) {
    work(depth);
    if (item === undefined) { if (arraySlot) charge(4); return; }
    if (item === null) { charge(4); return; }
    if (typeof item === "string") { charge(quotedJsonLength(item, limits.maxChars - characters)); return; }
    if (typeof item === "boolean") { charge(item ? 4 : 5); return; }
    if (typeof item === "number") { charge(Number.isFinite(item) ? String(item).length : 4); return; }
    if (typeof item !== "object") throw new Error("Unsupported non-JSON value in backup.");
    const array = Array.isArray(item), prototype = Object.getPrototypeOf(item);
    if (prototype !== null && prototype !== (array ? Array.prototype : Object.prototype)) throw new Error("Custom objects are unsupported in a bounded backup.");
    const custom = Object.getOwnPropertyDescriptor(item, "toJSON");
    if (custom && (!Object.hasOwn(custom, "value") || typeof custom.value === "function")) throw new Error("Custom JSON serialization is unsupported for a bounded backup.");
    if (active.has(item)) throw new Error("Circular data cannot be backed up as JSON.");
    active.add(item);
    try {
      charge(2);
      if (array) {
        for (let i = 0; i < item.length; i++) {
          if (i) charge(1);
          visit(memberValue(item, String(i)), depth + 1, true);
        }
      } else {
        let members = 0;
        for (const key in item) {
          if (!Object.hasOwn(item, key)) continue;
          const next = memberValue(item, key);
          if (next === undefined) { work(depth + 1); continue; }
          if (members++) charge(1);
          let keyLength = keys.get(key);
          if (keyLength === undefined) {
            keyLength = quotedJsonLength(key, limits.maxChars - characters);
            if (keys.size < 4096) keys.set(key, keyLength);
          }
          charge(keyLength + 1);
          visit(next, depth + 1);
        }
      }
    } finally { active.delete(item); }
  }
  if (value === undefined) throw new Error("A JSON root value is required.");
  visit(value, 0);
  return { characters, nodes };
}
