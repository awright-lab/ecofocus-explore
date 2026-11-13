// @vitest-environment jsdom
import { act, useRef, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BuilderHeader } from "../BuilderChrome";
import { StudioCommandMenu, StudioHelp, StudioRail } from "../StudioTools";
import { initialDashboard } from "../../../document/documentSeeds";
import { createReportRecord } from "../../../document/workspacePersistence";
import { useModalAccessibility } from "../../hooks/useModalAccessibility";

describe("studio delivery and tool discovery", () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  function button(text: string) { const value = Array.from(host.querySelectorAll("button")).find((node) => node.textContent?.trim() === text); expect(value, text).toBeTruthy(); return value!; }
  function props(onExport: ComponentProps<typeof BuilderHeader>["onExport"]): ComponentProps<typeof BuilderHeader> {
    const noop = () => {};
    return { dashboard: initialDashboard, activeProductMode: "story", setActiveProductMode: noop,
      reports: [createReportRecord(initialDashboard)], activeReportId: initialDashboard.id,
      onOpenReport: noop, onCreateReport: noop, onDuplicateReport: noop, canUndo: false, canRedo: false,
      onUndo: noop, onRedo: noop, onExport, onOpenPublished: noop, onPublish: noop, onUnpublish: noop,
      onHome: noop, onSearch: noop, onHelp: noop };
  }

  it("labels snapshots honestly and makes export errors recoverable without duplicate exports", async () => {
    let reject!: (error: Error) => void;
    const onExport = vi.fn(() => new Promise<void>((_, fail) => { reject = fail; }));
    await act(async () => root.render(<BuilderHeader {...props(onExport)} />));
    expect(button("Save snapshot").title).toContain("does not publish an online link");
    await act(async () => { button("PowerPoint (.pptx)").click(); button("PowerPoint (.pptx)").click(); });
    expect(onExport).toHaveBeenCalledOnce();
    expect(host.textContent).toContain("Preparing PPTX");
    expect(button("Excel tables (.xlsx)").disabled).toBe(true);
    await act(async () => reject(new Error("Synthetic render failure")));
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Synthetic render failure");
    expect(button("PowerPoint (.pptx)").disabled).toBe(false);
    expect(host.textContent).not.toContain("Preparing PPTX");
  });

  it("preserves Analyze, Studies, Pages and Styles rail callbacks", async () => {
    const change = vi.fn(), analyze = vi.fn();
    await act(async () => root.render(<StudioRail active={null} onChange={change} onSearch={() => {}} onAnalyze={analyze} />));
    await act(async () => { button("Analyze").click(); button("Studies").click(); button("Pages").click(); button("Styles").click(); });
    expect(analyze).toHaveBeenCalledOnce();
    expect(change.mock.calls).toEqual([["data"], ["pages"], ["brand"]]);
  });

  it("inspects a result before running it exactly once", async () => {
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value() { this.open = true; } });
    const run = vi.fn(), close = vi.fn();
    await act(async () => root.render(<StudioCommandMenu onClose={close} commands={[{id: "pptx", label: "Export PowerPoint", group: "Deliver", run}]} />));
    const result = host.querySelector<HTMLButtonElement>('.tool-library-result')!;
    await act(async () => result.click());
    expect(run).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Starts the PowerPoint export');
    const open = Array.from(host.querySelectorAll('button')).find(b => b.textContent?.includes('Open tool'))!;
    await act(async () => { open.click(); open.click(); });
    expect(run).toHaveBeenCalledOnce(); expect(close).toHaveBeenCalledOnce();
  });

  it("fails closed when commands change or identities are duplicated", async () => {
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value() { this.open = true; } });
    const run = vi.fn(), close = vi.fn();
    const command = {id: "__proto__", label: "Custom", group: "Other", run};
    const render = (commands: typeof command[]) => root.render(<StudioCommandMenu onClose={close} commands={commands} />);
    await act(async () => render([command]));
    await act(async () => host.querySelector<HTMLButtonElement>('.tool-library-result')!.click());
    await act(async () => render([{...command, label: 'Changed'}]));
    expect(host.textContent).toContain('no longer available'); expect(run).not.toHaveBeenCalled();
    await act(async () => render([command, {...command}]));
    expect(host.textContent).toContain('ambiguous'); expect(run).not.toHaveBeenCalled();
    await act(async () => render([]));
    expect(host.textContent).toContain('no longer available');
  });

  it("invalidates a replaced callback and isolates keyboard input including composition", async () => {
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value() { this.open = true; } });
    const first = vi.fn(), replacement = vi.fn(), windowKey = vi.fn();
    const firstAction = () => first();
    const changedAction = () => replacement();
    window.addEventListener('keydown', windowKey);
    const make = (run: () => void) => [{ id: 'pages', label: 'Pages', group: 'Workspace', run }];
    try {
      await act(async () => root.render(<StudioCommandMenu onClose={() => {}} commands={make(firstAction)} />));
      const input = host.querySelector<HTMLInputElement>('input')!;
      await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowDown', bubbles:true, isComposing:true})));
      expect(host.querySelector('.tool-library-detail')?.textContent).toContain('Choose a tool');
      expect(windowKey).not.toHaveBeenCalled();
      await act(async () => host.querySelector<HTMLButtonElement>('.tool-library-result')!.click());
      await act(async () => root.render(<StudioCommandMenu onClose={() => {}} commands={make(changedAction)} />));
      expect(host.textContent).toContain('no longer available');
      expect(first).not.toHaveBeenCalled(); expect(replacement).not.toHaveBeenCalled();
    } finally { window.removeEventListener('keydown', windowKey); }
  });

  it.each(["commands", "help"])("restores the opener after closing %s", async (kind) => {
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value() { this.open = true; } });
    const opener = document.createElement("button"); document.body.append(opener); opener.focus();
    try {
      await act(async () => root.render(kind === "commands"
        ? <StudioCommandMenu commands={[]} onClose={() => {}} />
        : <StudioHelp onClose={() => {}} />));
      host.querySelector<HTMLElement>(kind === "commands" ? "input" : "button")!.focus();
      await act(async () => root.render(null));
      expect(document.activeElement).toBe(opener);
    } finally { opener.remove(); }
  });

  it("keeps focus through parent rerenders and traps Tab among visible dialog controls", async () => {
    const firstClose = vi.fn(), latestClose = vi.fn();
    function Modal({ close }: { close: () => void }) {
      const ref = useRef<HTMLDivElement>(null);
      useModalAccessibility(ref, close);
      return <div role="dialog" ref={ref} tabIndex={-1}>
        <button>First</button><details><summary>Details</summary><input aria-label="Collapsed input" /></details>
        <button>Last</button><button style={{ display: "none" }}>Hidden</button>
      </div>;
    }
    const trigger = document.createElement("button"); document.body.append(trigger); trigger.focus();
    await act(async () => root.render(<Modal close={firstClose} />));
    const first = button("First"), last = button("Last");
    first.focus();
    await act(async () => root.render(<Modal close={latestClose} />));
    expect(document.activeElement).toBe(first);
    last.focus();
    await act(async () => last.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true })));
    expect(document.activeElement).toBe(first);
    await act(async () => first.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true })));
    expect(document.activeElement).toBe(last);
    await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
    expect(latestClose).toHaveBeenCalledOnce(); expect(firstClose).not.toHaveBeenCalled();
    await act(async () => root.render(null));
    expect(document.activeElement).toBe(trigger); trigger.remove();
  });
});
