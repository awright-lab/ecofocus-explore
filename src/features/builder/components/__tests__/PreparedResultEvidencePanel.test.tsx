// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import ResultEvidencePanel from "../ResultEvidencePanel";
import { preparedEvidenceFixture } from "../../../analytics/__tests__/preparedEvidenceFixture";
import { previewVersionedRefresh } from "../../../analytics/versionedLocalRefresh";
let root: Root, host: HTMLDivElement, outside: HTMLButtonElement;
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.stubGlobal("crypto", webcrypto); host = document.createElement("div"); outside = document.createElement("button"); outside.textContent = "Outside"; document.body.append(host, outside); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); outside.remove(); vi.unstubAllGlobals(); });
async function until(check: () => boolean) { for (let i = 0; i < 300 && !check(); i++) await act(async () => new Promise(r => setTimeout(r, 5))); expect(check(), host.textContent ?? "").toBe(true); }
async function fixture() { const f = await preparedEvidenceFixture(), p = await previewVersionedRefresh(f.context, { signal: new AbortController().signal }); const tile = { ...f.tile, result: p.result, query: structuredClone(p.result.query) }; await act(async () => root.render(<ResultEvidencePanel tile={tile} startOpen/>)); await until(() => !!host.querySelector('textarea[aria-label="Recorded preparation recipe (JSON)"]')); return { ...f, tile }; }
it("shows the checked retained source/version and complete read-only recipe without altering stored analysis", async () => {
  const f = await fixture(), before = structuredClone(f.tile), recipe = host.querySelector<HTMLTextAreaElement>("textarea")!;
  expect(recipe.readOnly).toBe(true); expect(JSON.parse(recipe.value)).toEqual(f.prepared.preparation); expect(host.textContent).toContain(f.original.id); expect(host.textContent).toContain(f.prepared.preparation!.sourceFingerprint); expect(host.textContent).toContain("does not recheck current studies"); expect(f.tile).toEqual(before);
});
it.each(["inside", "outside", "blur"] as const)("withholds corrupted lineage and preserves focus ownership for %s", async owner => {
  const f = await fixture(), recipe = host.querySelector<HTMLTextAreaElement>("textarea")!; recipe.focus(); if (owner === "outside") outside.focus(); if (owner === "blur") recipe.blur(); const active = document.activeElement;
  const next = structuredClone(f.tile); next.result.localExecution!.preparation!.recipe.steps[1].to = "Corrupt replacement"; await act(async () => root.render(<ResultEvidencePanel tile={next} startOpen/>)); expect(host.querySelector("textarea")).toBeNull(); expect(document.activeElement).toBe(owner === "inside" ? host.querySelector("summary") : active); await until(() => host.textContent?.includes("could not be verified") ?? false); expect(host.textContent).not.toContain("Corrupt replacement");
});
it("returns owned focus to the stable summary when an invalid result replaces the complete panel", async () => {
  const f = await fixture(); host.querySelector<HTMLTextAreaElement>("textarea")!.focus(); const next = structuredClone(f.tile); next.result.table[1].optionId = next.result.table[0].optionId; await act(async () => root.render(<ResultEvidencePanel tile={next} startOpen/>)); expect(host.querySelector("textarea")).toBeNull(); expect(document.activeElement).toBe(host.querySelector("summary")); expect(host.querySelector('[role="alert"]')).not.toBeNull();
});
it("does not assert preparation facts while an integrity check is pending", async () => {
  const f = await preparedEvidenceFixture(), p = await previewVersionedRefresh(f.context, { signal: new AbortController().signal }); let release: (() => void) | undefined;
  vi.stubGlobal("crypto", { subtle: { digest: async (...args: Parameters<typeof webcrypto.subtle.digest>) => { await new Promise<void>(r => { release = r; }); return webcrypto.subtle.digest(...args); } } });
  const tile = { ...f.tile, result: p.result }; await act(async () => root.render(<ResultEvidencePanel tile={tile} startOpen/>)); expect(release).toBeDefined(); expect(host.querySelector("textarea")).toBeNull(); expect(host.textContent).toContain("Checking the recorded"); await act(async () => { release!(); }); await until(() => !!host.querySelector("textarea"));
});
