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
  { id: "data", label: "Data", icon: Database },
  { id: "insert", label: "Elements", icon: Plus },
  { id: "brand", label: "Design", icon: Palette },
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
        <span>Create</span>
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
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const matches = commands.filter((command) =>
    `${command.label} ${command.group}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  useEffect(() => {
    ref.current?.showModal();
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
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((index) => Math.min(index + 1, matches.length - 1));
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
      <div className="studio-command-results">
        {matches.length ? (
          matches.map((command, index) => {
            const Icon = command.icon ?? ArrowUpRight;
            return (
              <button
                type="button"
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

export function StudioHelp({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
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
            "Use Create to build a table or chart. Import a study in Data, or explore the included EcoFocus sample.",
          ],
          [
            LayoutTemplate,
            "02",
            "Make it your own",
            "Select any object to reveal its controls. Use Design for themes, type styles, and reusable story sections.",
          ],
          [
            ArrowUpRight,
            "03",
            "Deliver the story",
            "Preview as a report, dashboard, or presentation. Share a snapshot or export to PowerPoint, PDF, or Excel.",
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
      <div className="studio-help-note">
        <Check size={16} />
        <span>
          Your changes save in this browser. Built-in studies contain sample
          data.
        </span>
      </div>
      <div className="studio-help-shortcut">
        <Command size={16} />
        <strong>Ctrl / ⌘ K</strong>
        <span>Find any tool instantly</span>
        <SlidersHorizontal size={16} />
      </div>
    </dialog>
  );
}
