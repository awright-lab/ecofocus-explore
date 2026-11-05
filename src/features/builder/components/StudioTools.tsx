import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
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
}: {
  active: LeftPanelView | null;
  onChange: (view: LeftPanelView) => void;
  onSearch: () => void;
  onAnalyze: () => void;
}) {
  return (
    <nav className="studio-rail" aria-label="Studio tools">
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

export function StudioCommandMenu({
  commands,
  onClose,
}: {
  commands: StudioCommand[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // Capture before the dialog input receives React autoFocus during commit.
  const opener = useRef(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [group, setGroup] = useState("All tools");
  const groups = ["All tools", ...new Set(commands.map((command) => command.group))];
  const matches = commands.filter((command) =>
    (group === "All tools" || command.group === group) && query.toLowerCase().trim().split(/\s+/).every((word) => `${command.label} ${command.group} ${command.shortcut ?? ""}`.toLowerCase().includes(word)),
  );
  useEffect(() => {
    ref.current?.showModal();
    return () => { if (opener.current?.isConnected) opener.current.focus(); };
  }, []);
  useEffect(() => {
    ref.current
      ?.querySelectorAll(".studio-command-results > button")
      [active]?.scrollIntoView({ block: "nearest" });
  }, [active]);
  function execute(index: number) {
    const command = matches[index];
    if (command) {
      onClose();
      command.run();
    }
  }
  return (
    <dialog
      ref={ref}
      className="studio-command-dialog"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      aria-label="Find a tool or action"
    >
      <div className="studio-command-search">
        <Search size={21} />
        <input
          autoFocus
          placeholder="What would you like to do?"
          aria-label="Search commands"
          role="combobox"
          aria-expanded="true"
          aria-controls="studio-command-options"
          aria-activedescendant={matches[active] ? `command-${matches[active].id}` : undefined}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((index) => Math.max(0, Math.min(index + 1, matches.length - 1)));
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((index) => Math.max(index - 1, 0));
            }
            if (event.key === "Enter") {
              event.preventDefault();
              execute(active);
            }
          }}
        />
        <button type="button" onClick={onClose} aria-label="Close command menu">
          <X size={18} />
        </button>
      </div>
      <nav className="command-categories" aria-label="Tool categories">{groups.map((item) => <button type="button" key={item} aria-pressed={group === item} onClick={() => { setGroup(item); setActive(0); }}>{item}</button>)}</nav>
      <div className="studio-command-results" role="listbox" id="studio-command-options" aria-label="Matching tools">
        {matches.length ? (
          matches.map((command, index) => {
            const Icon = command.icon ?? ArrowUpRight;
            return (
              <button
                type="button"
                id={`command-${command.id}`}
                role="option"
                aria-selected={active === index}
                className={active === index ? "active" : ""}
                key={command.id}
                onClick={() => execute(index)}
                onMouseEnter={() => setActive(index)}
              >
                <span className="studio-command-icon">
                  <Icon size={18} />
                </span>
                <span>
                  <strong>{command.label}</strong>
                  <small>{command.group}</small>
                </span>
                {command.shortcut ? (
                  <kbd>{command.shortcut}</kbd>
                ) : (
                  <ArrowUpRight size={15} />
                )}
              </button>
            );
          })
        ) : (
          <div className="studio-command-empty">
            No matching tools. Try “chart”, “export”, or “pages”.
          </div>
        )}
      </div>
      <footer>
        <span>
          <kbd>↑</kbd>
          <kbd>↓</kbd> to navigate <kbd>↵</kbd> to select
        </span>
        <span>
          <Command size={13} /> Your whole studio, one search away
        </span>
      </footer>
    </dialog>
  );
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
