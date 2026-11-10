// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PreflightPageOverview } from "../PreflightPageOverview";
import type { PreflightIssue } from "../reportPreflight";
let host: HTMLDivElement, outside: HTMLButtonElement, root: Root;
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); host = document.createElement("div"); outside = document.createElement("button"); outside.textContent = "Outside"; document.body.append(host, outside); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); outside.remove(); vi.unstubAllGlobals(); });
const issue = (check: PreflightIssue["check"]): PreflightIssue => ({ check, message: "Synthetic finding" });
const pages = () => [{ pageId: "clean", title: "Overview", issues: [] }, { pageId: "needs/#", title: "Same name", issues: [issue("Page boundary"), issue("Image"), issue("Image")] }, { pageId: "next", title: "Same name", issues: [issue("Narrative evidence")] }];
it("shows only flagged pages with original ordinals, complete check counts and associated context", async () => {
 const value = pages(), original = structuredClone(value), select = vi.fn();
 await act(async () => root.render(<PreflightPageOverview pages={value} selectedId="next" onSelect={select}/>));
 expect(host.textContent).toContain("2 pages need attention across 4 recorded checks");
 const controls = Array.from(host.querySelectorAll("button")); expect(controls.map(n => n.getAttribute("aria-label"))).toEqual(["Review page 2: Same name", "Review page 3: Same name"]);
 expect(controls.map(n => n.getAttribute("aria-pressed"))).toEqual(["false", "true"]);
 const descriptions = controls.map(n => document.getElementById(n.getAttribute("aria-describedby")!)!);
 expect(descriptions[0].textContent).toBe("3 checks: Page boundary (1); Image (2)"); expect(descriptions[1].textContent).toBe("1 check: Narrative evidence (1)"); expect(descriptions[0].id).not.toBe(descriptions[1].id);
 await act(async () => { controls[0].focus(); controls[0].click(); }); expect(select).toHaveBeenCalledExactlyOnceWith("needs/#"); expect(document.activeElement).toBe(controls[0]); expect(value).toEqual(original);
});
it.each(["owned", "outside", "blur"])("restores removed-page focus only when the control still owned focus: %s", async owner => {
 const value = pages(), select = vi.fn(), render = () => act(async () => root.render(<PreflightPageOverview pages={value} onSelect={select}/>)); await render();
 const control = host.querySelector("button")!; control.focus(); if (owner === "outside") outside.focus(); if (owner === "blur") control.blur(); value[1].issues = []; await render();
 expect(control.isConnected).toBe(false); expect(document.activeElement).toBe(owner === "owned" ? host.querySelector("h3") : owner === "outside" ? outside : document.body); expect(select).not.toHaveBeenCalled();
});
it("keeps selected control focus through rerender and provides an honest empty overview", async () => {
 const value = pages(), select = vi.fn(); await act(async () => root.render(<PreflightPageOverview pages={value} onSelect={select}/>)); const control = host.querySelector("button")!; control.focus();
 await act(async () => root.render(<PreflightPageOverview pages={value} selectedId="needs/#" onSelect={select}/>)); expect(document.activeElement).toBe(control); expect(control.getAttribute("aria-pressed")).toBe("true");
 value[1].issues = []; value[2].issues = []; await act(async () => root.render(<PreflightPageOverview pages={value} onSelect={select}/>)); expect(host.querySelector("button")).toBeNull(); expect(document.activeElement).toBe(host.querySelector("h3")); expect(host.textContent).toContain("No pages need attention in these checks"); expect(host.textContent).toContain("not issue severity or export readiness");
});
