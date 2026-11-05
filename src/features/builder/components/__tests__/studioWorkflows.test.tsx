// @vitest-environment jsdom
import { act, useRef, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BuilderHeader } from "../BuilderChrome";
import { StudioCommandMenu, StudioHelp } from "../StudioTools";
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

  it("filters tool categories and executes the keyboard-selected result", async () => {
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value() { this.open = true; } });
    const create = vi.fn(), exportFile = vi.fn(), close = vi.fn();
    await act(async () => root.render(<StudioCommandMenu onClose={close} commands={[
      { id: "table", label: "Create table", group: "Analyze", run: create },
      { id: "export", label: "Export report", group: "Deliver", run: exportFile }
    ]} />));
    await act(async () => button("Deliver").click());
    const input = host.querySelector<HTMLInputElement>('[aria-label="Search commands"]')!;
    expect(input.getAttribute("aria-activedescendant")).toBe("command-export");
    expect(host.querySelectorAll('[role="option"]')).toHaveLength(1);
    await act(async () => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(exportFile).toHaveBeenCalledOnce(); expect(create).not.toHaveBeenCalled(); expect(close).toHaveBeenCalledOnce();
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
