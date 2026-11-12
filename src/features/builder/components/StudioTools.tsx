import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  BookOpenText,
  Check,
  Command,
  Database,
  FileText,
  Layers,
  LayoutTemplate,
  Palette,
  Plus,
  Search,
  SlidersHorizontal,
  X,
  type LucideIcon,
} from "lucide-react";
import type { LeftPanelView } from "../builderTypes";
import { categories, searchTools } from "./toolCatalog";
import "./toolLibrary.css";

export interface StudioCommand {
  id: string;
  label: string;
  group: string;
  icon?: LucideIcon;
  shortcut?: string;
  run: () => void;
}
const tools: Array<{ id: LeftPanelView; label: string; icon: LucideIcon }> = [
  { id: "pages", label: "Pages", icon: FileText },
  { id: "data", label: "Studies", icon: Database },
  { id: "insert", label: "Insert", icon: Plus },
  { id: "brand", label: "Styles", icon: Palette },
  { id: "layers", label: "Layers", icon: Layers },
];

export function StudioRail({
  active,
  onChange,
  onSearch,
  onAnalyze,
  onStory,
  onExplore,
}: {
  active: LeftPanelView | null;
  onChange: (view: LeftPanelView) => void;
  onSearch: () => void;
  onAnalyze: () => void;
  onStory?: () => void;
  onExplore?: () => void;
}) {
  return (
    <nav className="studio-rail" aria-label="Studio tools" data-canvas-keyboard-scope="controls">
      <button
        className="studio-rail-create"
        type="button"
        onClick={onAnalyze}
        aria-label="Create analysis"
        title="Create a table or chart"
      >
        <Plus size={21} />
        <span>Analyze</span>
      </button>
      {onStory&&<button type="button" className="studio-rail-story" onClick={onStory} aria-label="Build a story" title="Turn selected findings into an editable story"><BookOpenText size={20}/><span>Story</span></button>}
      {onExplore&&<button type="button" onClick={onExplore} aria-label="Explore linked views" title="Select groups across related analyses"><SlidersHorizontal size={20}/><span>Explore</span></button>}
      <div className="studio-rail-divider" />
      {tools.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          data-tool={id}
          type="button"
          aria-pressed={active === id}
          className={active === id ? "active" : ""}
          onClick={() => onChange(id)}
          title={label}
        >
          <Icon size={20} strokeWidth={1.6} />
          <span>{label}</span>
        </button>
      ))}
      <button
        type="button"
        className="studio-rail-search"
        onClick={onSearch}
        title="Find a tool (Ctrl/⌘ K)"
      >
        <Search size={20} />
        <span>Search</span>
      </button>
    </nav>
  );
}

export function StudioCommandMenu({ commands, onClose }: { commands: StudioCommand[]; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const invoked = useRef(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All tools");
  const [selected, setSelected] = useState<{ id: string; label: string; group: string; run: () => void } | null>(null);
  const [message, setMessage] = useState("");
  const matches = searchTools(commands, query, category);
  const current = selected && commands.filter(c => c.id === selected.id);
  const chosen = current?.length === 1 && current[0].label === selected?.label && current[0].group === selected?.group && current[0].run === selected?.run
    ? matches.find(item => item.command === current[0]) : undefined;
  useEffect(() => {
    ref.current?.showModal();
    return () => { if (!invoked.current && opener.current?.isConnected) opener.current.focus(); };
  }, []);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>(".tool-library-result.selected")?.scrollIntoView({ block: "nearest" });
  }, [selected]);
  function choose(command: StudioCommand) {
    setSelected({ id: command.id, label: command.label, group: command.group, run: command.run });
    setMessage("");
  }
  function execute() {
    if (invoked.current) return;
    const found = selected && commands.filter(command => command.id === selected.id);
    if (!selected || !found || found.length !== 1 || found[0].label !== selected.label || found[0].group !== selected.group || found[0].run !== selected.run || !chosen) {
      setMessage("This tool changed or its identity is ambiguous. Select a current, uniquely identified tool and try again.");
      return;
    }
    invoked.current = true;
    onClose();
    found[0].run();
  }
  return <dialog ref={ref} className="studio-command-dialog tool-library" aria-labelledby="tool-library-title"
    data-canvas-keyboard-scope="controls" onCancel={event => { event.preventDefault(); onClose(); }}
    onKeyDown={event => { if (!event.nativeEvent.isComposing && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); onClose(); } event.stopPropagation(); }} onKeyUp={event => event.stopPropagation()}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <header className="tool-library-header"><div><span>YOUR STUDIO</span><h2 id="tool-library-title">Tool Library</h2><p>Find the right starting point for your next task.</p></div>
      <button type="button" onClick={onClose} aria-label="Close tool library"><X size={20}/></button></header>
    <div className="studio-command-search"><Search size={20}/><input autoFocus placeholder="Search tasks, tools or keywords" aria-label="Search commands" value={query}
      onChange={event => { setQuery(event.target.value); setSelected(null); setMessage(""); }}
      onKeyDown={event => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === "ArrowDown" && matches.length) { event.preventDefault(); const i = matches.findIndex(item => item.command.id === selected?.id && item.command.label === selected.label); choose(matches[Math.min(i + 1, matches.length - 1)].command); }
        if (event.key === "ArrowUp" && matches.length) { event.preventDefault(); const i = matches.findIndex(item => item.command.id === selected?.id && item.command.label === selected.label); choose(matches[Math.max(i - 1, 0)].command); }
      }}/></div>
    <nav className="tool-library-categories" aria-label="Tool categories">{categories.filter(item => item !== 'Other tools' || commands.some(c => searchTools([c], '', item).length)).map(item => <button type="button" key={item} aria-pressed={category === item} onClick={() => { setCategory(item); setSelected(null); setMessage(""); }}>{item}</button>)}</nav>
    <div className="tool-library-body"><section className="tool-library-list" aria-label="Matching tools"><p className="tool-library-count" aria-live="polite">{matches.length} {matches.length === 1 ? 'tool' : 'tools'}</p>
      {matches.length ? matches.map(({command, info, index}) => {
        const Icon = command.icon ?? ArrowUpRight;
        const isSelected = selected?.id === command.id && selected.label === command.label && selected.group === command.group;
        return <button type="button" className={isSelected ? 'tool-library-result selected' : 'tool-library-result'} key={index} aria-pressed={isSelected} onClick={() => choose(command)}><span className="tool-library-icon"><Icon size={19}/></span><span><strong>{command.label}</strong><small>{info.category} · {info.description}</small></span><ArrowUpRight size={16}/></button>;
      }) : <div className="studio-command-empty">No tools match. Try a broader search or choose All tools.</div>}</section>
      <aside className="tool-library-detail" aria-label="Tool details" aria-live="polite">{chosen ? <><span className="tool-library-kicker">{chosen.info.category}</span><h3>{chosen.command.label}</h3><p>{chosen.info.description}</p><h4>What happens</h4><p>{chosen.info.opens}</p>{chosen.info.limitation && <p className="tool-library-note">{chosen.info.limitation}</p>}
        <button type="button" className="tool-library-open" onClick={execute}>Open tool <ArrowUpRight size={16}/></button></> : <><h3>Choose a tool</h3><p>Select a result to see what it does before opening it.</p>{selected && <p role="alert">This selection is no longer available or is ambiguous. Choose a current tool.</p>}</>}{message && <p role="alert">{message}</p>}</aside></div>
    <footer>Search by task · Select a tool to inspect it · Escape to close</footer>
  </dialog>;
}

export function StudioHelp({ onClose, actions = [] }: { onClose: () => void; actions?: StudioCommand[] }) {
  const ref = useRef<HTMLDialogElement>(null);
  // Capture before the dialog input receives React autoFocus during commit.
  const opener = useRef(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  useEffect(() => {
    ref.current?.showModal();
    return () => { if (opener.current?.isConnected) opener.current.focus(); };
  }, []);
  return (
    <dialog
      className="studio-help-dialog"
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-label="Welcome to your studio"
    >
      <button
        type="button"
        className="studio-dialog-close"
        onClick={onClose}
        aria-label="Close help"
      >
        <X size={20} />
      </button>
      <span className="studio-eyebrow">A little orientation</span>
      <h2>
        From a question
        <br />
        to a story worth sharing.
      </h2>
      <p>Everything you need is here. Start small, then go deeper.</p>
      <div className="studio-help-steps">
        {[
          [
            Database,
            "01",
            "Find your evidence",
            "Choose Analyze to build a table or chart. Open Studies for your imported research and advanced analysis. Sample data is labeled separately.",
          ],
          [
            LayoutTemplate,
            "02",
            "Make it your own",
            "Use Pages to organize the story, Insert to add content, and Styles for themes, typography and reusable sections. Select an object to edit its properties.",
          ],
          [
            ArrowUpRight,
            "03",
            "Deliver the story",
            "Preview the report and save a snapshot in this browser. Export PowerPoint, PDF or Excel to deliver it to someone else; snapshots are not online sharing.",
          ],
        ].map(([Icon, number, title, body]) => {
          const StepIcon = Icon as LucideIcon;
          return (
            <div key={String(number)}>
              <span>
                <StepIcon size={20} />
              </span>
              <div>
                <small>{String(number)}</small>
                <strong>{String(title)}</strong>
                <p>{String(body)}</p>
              </div>
            </div>
          );
        })}
      </div>
      {actions.length > 0 && <div className="studio-help-actions" aria-label="Try a workflow">{actions.map((action) => <button type="button" key={action.id} onClick={() => { onClose(); action.run(); }}><span>{action.group}</span><strong>{action.label}</strong><ArrowUpRight size={18} /></button>)}</div>}
      <div className="studio-help-note">
        <Check size={16} />
        <span>
          Your changes save in this browser. Built-in studies contain sample
          data.
        </span>
      </div>
      <div className="studio-help-shortcut">
        <Command size={16} />
        <strong>Ctrl / Command + K</strong>
        <span>Find any tool instantly</span>
        <SlidersHorizontal size={16} />
      </div>
    </dialog>
  );
}
