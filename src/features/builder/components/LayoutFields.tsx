import { useId, useLayoutEffect, useRef, useState } from "react";
import type { CanvasLayout } from "../../../../shared/types/dashboard";

type Coordinate = "x" | "y" | "width" | "height";

function LayoutNumberField({ name, coordinate, value, disabled, helpId, onApply }: {
  name: string;
  coordinate: Coordinate;
  value: number;
  disabled: boolean;
  helpId: string;
  onApply: (change: Partial<CanvasLayout>) => void;
}) {
  const id = useId();
  const [text, setText] = useState(String(value));
  const [issue, setIssue] = useState("");
  const editing = useRef(false);
  const baseline = useRef(value);
  useLayoutEffect(() => {
    if (!editing.current || disabled) {
      editing.current = false;
      baseline.current = value;
      setText(String(value));
    }
  }, [value, disabled]);

  function reset(message = "") {
    editing.current = false;
    baseline.current = value;
    setText(String(value));
    setIssue(message);
  }

  function apply() {
    if (!editing.current || disabled) return;
    if (text === String(value)) { reset(); return; }
    if (!Object.is(baseline.current, value)) {
      reset(`${name} changed while you were editing. Its current value was retained; enter your change again.`);
      return;
    }
    const parsed = Number(text);
    const next = parsed === 0 ? 0 : parsed;
    const dimension = coordinate === "width" || coordinate === "height";
    if (!text.trim() || !Number.isFinite(next) || Math.abs(next) > Number.MAX_SAFE_INTEGER || (dimension && next <= 0)) {
      reset(`${name} must be ${dimension ? "greater than zero and " : ""}a finite number within the supported numeric range. Its current value was retained.`);
      return;
    }
    editing.current = false;
    baseline.current = next;
    setText(String(next));
    setIssue("");
    if (next !== value) onApply({ [coordinate]: next });
  }

  return <label htmlFor={id}>{name}
    <input id={id} type="number" step="any" value={text} disabled={disabled}
      aria-describedby={`${helpId}${issue ? ` ${id}-error` : ""}`}
      onFocus={() => { editing.current = true; baseline.current = value; }}
      onChange={event => { editing.current = true; setText(event.target.value); setIssue(""); }}
      onBlur={apply}
      onKeyDown={event => {
        if (event.key === "Enter") { event.preventDefault(); apply(); }
        if (event.key === "Escape") { event.preventDefault(); reset(); }
      }} />
    {issue && <small id={`${id}-error`} role="alert">{issue}</small>}
  </label>;
}

/** Stages each numeric entry so incomplete typing never changes the report. */
export function LayoutFields({ layout, locked = false, onApply }: {
  layout: CanvasLayout;
  locked?: boolean;
  onApply: (change: Partial<CanvasLayout>) => void;
}) {
  const helpId = useId();
  return <div data-canvas-keyboard-scope="controls"><div className="layout-grid">
    {([['x', 'X position'], ['y', 'Y position'], ['width', 'Width'], ['height', 'Height']] as const).map(([coordinate, name]) =>
      <LayoutNumberField key={coordinate} coordinate={coordinate} name={name} value={layout[coordinate]} disabled={locked} helpId={helpId} onApply={onApply} />)}
    </div><small id={helpId}>{locked ? "Unlock this item before editing its position or size." : "Changes apply on Enter or when you leave the field. Escape cancels the edit."}</small>
  </div>;
}
