// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CloudSaveLab } from "../CloudSaveLab";

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("crypto", webcrypto);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function button(host: Element, label: string) {
  const found = Array.from(host.querySelectorAll("button")).find(node => node.textContent === label);
  if (!found) throw new Error(`Button not found: ${label}`);
  return found;
}
async function select(host: Element, label: string, value: string) {
  const node = host.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!;
  await act(async () => { node.value = value; node.dispatchEvent(new Event("change", { bubbles: true })); });
}
async function flush() { await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); }); }
async function click(host: Element, label: string) { await act(async () => button(host, label).click()); await flush(); }
async function renderLab() {
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  await act(async () => root.render(<CloudSaveLab />));
  const a = host.querySelector('section[aria-label="Device A"]')!, b = host.querySelector('section[aria-label="Device B"]')!;
  return { host, a, b, close: async () => { await act(async () => root.unmount()); host.remove(); } };
}
it("shows isolation warning, creates conflict and restores a separate copy without touching browser storage/network", async () => {
  const read = vi.spyOn(Storage.prototype, "getItem"), write = vi.spyOn(Storage.prototype, "setItem"), remove = vi.spyOn(Storage.prototype, "removeItem");
  const fetch = vi.fn(() => { throw new Error("Unexpected network request"); }); vi.stubGlobal("fetch", fetch);
  const { host, a, b, close } = await renderLab();
  try {
    expect(host.textContent).toContain("Live Supabase authentication, RLS and security are not verified");
    await select(host, "Device 1 account", "synthetic-alice"); await select(host, "Device 2 account", "synthetic-alice");
    await click(a, "Save cloud copy"); expect(a.querySelector('[role="status"]')?.textContent).toContain("cloud copy saved");
    await click(b, "Make synthetic edit"); await click(b, "Save cloud copy");
    expect(b.querySelector('[role="status"]')?.textContent).toContain("conflict");
    await click(b, "Restore separate copy");
    expect(b.querySelector(".lab-local")?.textContent).toContain("Synthetic survey 1");
    expect(b.querySelector(".lab-restored")?.textContent).toContain("Synthetic survey 0");
    expect(b.querySelector('[role="status"]')?.textContent).toContain("active local copy and cloud head are unchanged");
    expect(read).not.toHaveBeenCalled(); expect(write).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  } finally { await close(); }
});
it("shows armed failure, retries a lost acknowledgement once and resets only the demo", async () => {
  const { host, a, close } = await renderLab();
  try {
    await select(host, "Device 1 account", "synthetic-alice"); await select(host, "Device 1 failure", "after-publish");
    expect(a.textContent).toContain("Armed: Lose publication acknowledgement");
    await click(a, "Save cloud copy"); expect(a.querySelector('[role="status"]')?.textContent).toContain("interrupted");
    expect(host.querySelectorAll(".lab-metrics strong")[1].textContent).toBe("1");
    await click(a, "Retry pending cloud copy"); expect(a.querySelector('[role="status"]')?.textContent).toContain("cloud copy saved");
    expect(host.querySelectorAll(".lab-metrics strong")[1].textContent).toBe("1");
    await click(host, "Reset synthetic demo"); expect(host.querySelectorAll(".lab-metrics strong")[1].textContent).toBe("0");
    expect(a.querySelector('[role="status"]')?.textContent).toContain("local only");
  } finally { await close(); }
});
it("keeps Bob isolated, distinguishes expiry and resumes after reauthentication", async () => {
  const { host, a, close } = await renderLab();
  try {
    await select(host, "Device 1 account", "synthetic-alice"); await click(a, "Save cloud copy");
    await select(host, "Device 1 account", "synthetic-bob"); await click(a, "Restore separate copy");
    expect(a.querySelector('[role="status"]')?.textContent).toContain("No cloud copy exists");
    await click(host, "Expire simulated sessions"); await click(a, "Save cloud copy");
    expect(a.querySelector('[role="status"]')?.textContent).toContain("sign in required");
    await select(host, "Device 1 account", "synthetic-bob"); await click(a, "Save cloud copy");
    expect(a.querySelector('[role="status"]')?.textContent).toContain("cloud copy saved");
  } finally { await close(); }
});
