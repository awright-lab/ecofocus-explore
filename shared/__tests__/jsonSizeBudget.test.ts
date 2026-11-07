import { expect, it, vi } from 'vitest';
import { assertJsonSize, quotedJsonLength } from '../jsonSizeBudget';
const limits = { maxChars: 1_000_000, maxNodes: 100_000, maxDepth: 96 };

it.each(['', 'ordinary', '"\\\b\t\n\f\r\0\u0001', 'é中文😀', '\ud800', '\udc00', '\ud800X\udc00', '\u2028\u2029'])('counts quoted JSON exactly without producing the quoted string (%s)', value => {
  const actual = JSON.stringify(value).length;
  expect(quotedJsonLength(value)).toBe(actual); expect(quotedJsonLength(value, actual)).toBe(actual);
  expect(() => quotedJsonLength(value, actual - 1)).toThrow('budget');
});
it('matches native compact JSON across a seeded plain-data oracle including aliases, omissions and sparse arrays', () => {
  let seed = 8162;
  const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 2 ** 32; };
  const samples = ['a', '"', '\\', '\0', '\n', '😀', '\ud800', '\udc00', 'é'];
  function value(depth: number): unknown {
    const kind = Math.floor(random() * (depth ? 6 : 4));
    if (kind === 0) return samples[Math.floor(random() * samples.length)].repeat(Math.floor(random() * 12));
    if (kind === 1) return random() < .2 ? Infinity : Math.floor(random() * 20) - 10;
    if (kind === 2) return random() < .5;
    if (kind === 3) return null;
    if (kind === 4) return Array.from({ length: Math.floor(random() * 6) }, () => value(depth - 1));
    return Object.fromEntries(Array.from({ length: Math.floor(random() * 5) }, (_, i) => [samples[Math.floor(random() * samples.length)] + i, value(depth - 1)]));
  }
  const alias = { toJSON: 'a real source column', ['__proto__']: 'safe own key', omit: undefined };
  for (const item of [[alias, alias, undefined, , -0, NaN], ...Array.from({ length: 250 }, () => value(4))]) {
    const exact = JSON.stringify(item).length;
    expect(assertJsonSize(item, limits).characters).toBe(exact);
    expect(assertJsonSize(item, { ...limits, maxChars: exact }).characters).toBe(exact);
    expect(() => assertJsonSize(item, { ...limits, maxChars: exact - 1 })).toThrow();
  }
});
it('rejects cycles, deep and excessive data before serialization while allowing repeated noncyclic references', () => {
  const cycle: Record<string, unknown> = {}; cycle.self = cycle;
  expect(() => assertJsonSize(cycle, limits)).toThrow('Circular');
  expect(() => assertJsonSize([1, 2], { ...limits, maxNodes: 2 })).toThrow('value-count');
  expect(() => assertJsonSize({ x: { y: 1 } }, { ...limits, maxDepth: 1 })).toThrow('nesting');
  expect(() => assertJsonSize(new Array(10_000), { ...limits, maxNodes: 50 })).toThrow('value-count');
});
it('does not run getters or custom serializers and rejects non-JSON objects', () => {
  const getter = vi.fn(() => 'never read'), custom = vi.fn(() => 'never serialize');
  const object = Object.defineProperty({}, 'x', { enumerable: true, get: getter });
  expect(() => assertJsonSize(object, limits)).toThrow('Accessor');
  expect(() => assertJsonSize({ toJSON: custom }, limits)).toThrow('Custom');
  expect(() => assertJsonSize(new Date(), limits)).toThrow('Custom');
  expect(() => assertJsonSize({ x: 1n }, limits)).toThrow('non-JSON');
  expect(getter).not.toHaveBeenCalled(); expect(custom).not.toHaveBeenCalled();
});
it('fails early on a large existing string and validates policy limits', () => {
  expect(() => assertJsonSize('x'.repeat(100_000), { ...limits, maxChars: 100 })).toThrow('character');
  for (const bad of [0, -1, NaN, Infinity, 1.5]) expect(() => assertJsonSize({}, { ...limits, maxChars: bad })).toThrow('Invalid');
});
