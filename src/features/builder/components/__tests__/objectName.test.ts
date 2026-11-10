import { expect, it } from "vitest";
import { normalizeObjectName } from "../objectName";
it.each(["Research note", "  North  audience  ", "年次比較", "مرحبا", "🌿 audience"]) ("accepts a useful Unicode name %s", value => expect(normalizeObjectName(value)).toBe(value.trim()));
it("accepts 200 code points including supplementary characters", () => { expect(normalizeObjectName("🌿".repeat(200))).toHaveLength(400); expect(normalizeObjectName("x".repeat(200))).toHaveLength(200); });
it.each(["", " \t\r\n ", "x".repeat(201), "🌿".repeat(201), "North\nSouth", "North\rSouth", "North\tSouth", "a\0b", "a\u007fb", "a\u0085b", "a\u2028b", "a\u2029b", "a\ud800b", "a\udfffb"]) ("refuses an unsupported new name", value => expect(() => normalizeObjectName(value)).toThrow("current report name was kept"));
