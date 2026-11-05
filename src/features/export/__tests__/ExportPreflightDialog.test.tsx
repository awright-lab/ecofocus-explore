// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ExportPreflightDialog } from "../ExportPreflightDialog";
import { BuilderHeader } from "../../builder/components/BuilderChrome";
import { editorModalOwnsKeyboard } from "../../builder/editorModalGuard";
import { initialDashboard } from "../../document/documentSeeds";
import { createReportRecord } from "../../document/workspacePersistence";
beforeEach(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)); afterEach(() => vi.unstubAllGlobals());
function document() { const value = structuredClone(initialDashboard); value.pages = [value.pages[0]]; value.pages[0].elements = []; value.pages[0].tiles = []; return value; }
async function mount(element: React.ReactNode) { const host = window.document.createElement("div"); window.document.body.append(host); const root = createRoot(host); await act(async () => root.render(element)); return { host, close: async () => { await act(async () => root.unmount()); host.remove(); } }; }
it("owns modal keys, closes with Escape and restores trigger focus", async () => {
 function Harness() { const [open, setOpen] = useState(false); return <><button onClick={() => setOpen(true)}>Review trigger</button>{open && <ExportPreflightDialog dashboard={document()} onClose={() => setOpen(false)} />}</>; }
 const panel = await mount(<Harness />); try { const trigger = panel.host.querySelector("button")!; trigger.focus(); await act(async () => trigger.click()); const dialog = panel.host.querySelector('[role="dialog"]')!; expect(window.document.activeElement).toBe(dialog); expect(editorModalOwnsKeyboard(new KeyboardEvent("keydown", { key: "Delete" }))).toBe(true); await act(async () => window.document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))); expect(panel.host.querySelector('[role="dialog"]')).toBeNull(); expect(window.document.activeElement).toBe(trigger); } finally { await panel.close(); }
});
it("lets users switch pages between a reported issue and a valid PDF preview", async () => {
 const value = document(); value.pages[0].backgroundMode = "image"; value.pages[0].backgroundImage = ""; value.pages.push({ ...structuredClone(value.pages[0]), id: "valid", title: "Valid page", order: 2, backgroundMode: "solid" });
 const panel = await mount(<ExportPreflightDialog dashboard={value} onClose={() => undefined} />); try { expect(panel.host.textContent).toContain("background image is missing"); expect(panel.host.querySelector("option")?.textContent).toContain("1 check to review"); const select = panel.host.querySelector("select")!; await act(async () => { select.value = "valid"; select.dispatchEvent(new Event("change", { bubbles: true })); }); expect(panel.host.textContent).toContain("No issues found in these checks"); expect(panel.host.querySelector("img")?.alt).toBe("PDF layout preview of Valid page"); expect(panel.host.querySelector("img")?.src).toMatch(/^data:image\/svg\+xml/); } finally { await panel.close(); }
});
it("opens from the export menu without starting a download and preserves existing format actions", async () => {
 const dashboard = document(), onExport = vi.fn(); const noop = () => undefined;
 const panel = await mount(<BuilderHeader dashboard={dashboard} activeProductMode="design" setActiveProductMode={noop} reports={[createReportRecord(dashboard)]} activeReportId={dashboard.id} onOpenReport={noop} onCreateReport={noop} onDuplicateReport={noop} canUndo={false} canRedo={false} onUndo={noop} onRedo={noop} onExport={onExport} onOpenPublished={noop} onPublish={noop} onUnpublish={noop} onHome={noop} onSearch={noop} onHelp={noop} />);
 try { const menu = panel.host.querySelector('details.export-menu')!; menu.setAttribute("open", ""); const review = Array.from(menu.querySelectorAll("button")).find(button => button.textContent === "Review before exporting")!; review.focus(); await act(async () => review.click()); expect(panel.host.querySelector('[role="dialog"]')).not.toBeNull(); expect(onExport).not.toHaveBeenCalled(); await act(async () => window.document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))); expect(window.document.activeElement).toBe(review); const excel = Array.from(menu.querySelectorAll("button")).find(button => button.textContent?.includes("Excel tables"))!; await act(async () => excel.click()); expect(onExport).toHaveBeenCalledExactlyOnceWith("xlsx"); } finally { await panel.close(); }
});
