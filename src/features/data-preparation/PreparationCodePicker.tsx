import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ComponentPropsWithoutRef, type RefObject } from "react";
import { buildPreparationCodeCatalog, preparationCodeLimits, preparationCodeWindow } from "./preparationCodeCatalog";

function OwnedInput({ fallback, ...props }: ComponentPropsWithoutRef<"input"> & { fallback: RefObject<HTMLElement | null> }) {
  const previous = useRef<HTMLInputElement | null>(null);
  const ref = useCallback((node: HTMLInputElement | null) => { if (!node && previous.current === document.activeElement && fallback.current?.isConnected) fallback.current.focus(); previous.current = node; }, [fallback]);
  return <input {...props} ref={ref}/>;
}
function RemoveCode({ fallback, ...props }: ComponentPropsWithoutRef<"button"> & { fallback: RefObject<HTMLElement | null> }) {
  const previous = useRef<HTMLButtonElement | null>(null);
  const ref = useCallback((node: HTMLButtonElement | null) => { if (!node && previous.current === document.activeElement && fallback.current?.isConnected) fallback.current.focus(); previous.current = node; }, [fallback]);
  return <button type="button" {...props} ref={ref}/>;
}
type Props = { values: readonly string[]; selected: readonly string[]; onSelected: (values: string[]) => void; fallback: RefObject<HTMLElement | null> };
export default function PreparationCodePicker({ values, selected, onSelected, fallback }: Props) {
  const container = useRef<HTMLFieldSetElement | null>(null), searchControl = useRef<HTMLInputElement | null>(null), selectedHeading = useRef<HTMLHeadingElement | null>(null), parentFallback = useRef(fallback); parentFallback.current = fallback;
  const [savedView, setSavedView] = useState<{ owner: readonly string[]; search: string; page: number; exact: boolean } | null>(null), [notice, setNotice] = useState<{ owner: readonly string[]; message: string } | null>(null);
  const issue = notice?.owner === values ? notice.message : "";
  const setIssue = (message: string) => setNotice({ owner: values, message });
  const view = savedView?.owner === values ? savedView : { owner: values, search: "", page: 0, exact: false };
  const catalog = useMemo(() => { try { return { value: buildPreparationCodeCatalog(values), issue: "" }; } catch (error) { return { value: null, issue: error instanceof Error ? error.message : "The code list is unavailable; your selections and source are kept." }; } }, [values]);
  const window = catalog.value ? preparationCodeWindow(catalog.value, view.search, view.page, view.exact) : null;
  const eligible = useMemo(() => new Set(catalog.value?.entries.map(entry => entry.value)), [catalog]);
  useLayoutEffect(() => () => { if (container.current?.contains(document.activeElement) && parentFallback.current.current?.isConnected) parentFallback.current.current.focus(); }, []);
  function toggle(value: string, checked: boolean) {
    setIssue("");
    if (!checked) { onSelected(selected.filter(item => item !== value)); return; }
    if (!eligible.has(value)) { setIssue("That code is not selectable from the current complete list. Existing selections are kept."); return; }
    if (selected.includes(value)) return;
    if (selected.length >= preparationCodeLimits.selected) { setIssue("Select at most 100 exact codes for one recode step. Remove a selected code before adding another."); return; }
    onSelected([...selected, value]);
  }
  const page = (next: number) => { if (window) setSavedView({ ...view, page: Math.max(0, Math.min(window.pages - 1, next)) }); };
  return <fieldset ref={container} className="preparation-code-picker"><legend>Codes to recode (up to 100)</legend>
    <label>Find raw codes<input ref={searchControl} maxLength={4096} value={view.search} onChange={event => setSavedView({ ...view, owner: values, search: event.target.value, page: 0 })}/></label>
    <label className="preparation-code-exact"><input type="checkbox" checked={view.exact} onChange={event => setSavedView({ ...view, exact: event.target.checked, page: 0 })}/>Match entire escaped JSON display</label>
    <p>Search the escaped JSON form literally, with case preserved. Type <code>{"\\r"}</code> for CR, <code>{"\\n"}</code> for LF or <code>{"\\\\"}</code> for a literal backslash. For one exact display, enable Match entire escaped JSON display and paste the full quoted form. Substring searches can match several codes. Blank, whitespace and line endings stay distinct. Search and paging do not change your selections or recipe.</p>
    {catalog.issue && <p role="alert">{catalog.issue}</p>}
    {catalog.value && <p role="status">{catalog.value.total.toLocaleString()} distinct codes after the applied history; {catalog.value.entries.length.toLocaleString()} selectable. Codes {window!.start}–{window!.end} of {window!.matched.toLocaleString()} matching. {catalog.value.overlong > 0 ? `${catalog.value.overlong.toLocaleString()} codes exceed the recipe’s 512-code-unit limit and are not selectable; source values are kept.` : "Every supported code is reachable; no first-500 cutoff."}</p>}
    <div className="preparation-code-pages" role="group" aria-label="Recode value pages"><button type="button" aria-disabled={!window || window.page === 0} onClick={() => page(0)}>First code page</button><button type="button" aria-disabled={!window || window.page === 0} onClick={() => page((window?.page ?? 0) - 1)}>Previous code page</button><span>Page {(window?.page ?? 0) + 1} of {window?.pages ?? 1}</span><button type="button" aria-disabled={!window || window.page === window.pages - 1} onClick={() => page((window?.page ?? 0) + 1)}>Next code page</button><button type="button" aria-disabled={!window || window.page === window.pages - 1} onClick={() => page((window?.pages ?? 1) - 1)}>Last code page</button></div>
    <div className="preparation-choices">{window?.entries.map(entry => <label key={entry.value}><OwnedInput fallback={searchControl} type="checkbox" checked={selected.includes(entry.value)} aria-label={`Select raw code ${entry.escaped}`} aria-disabled={!selected.includes(entry.value) && selected.length >= 100} onChange={event => toggle(entry.value, event.target.checked)}/><span title={entry.escaped}>{entry.label}</span></label>)}</div>
    {window?.matched === 0 && <p>No supported codes match this search. Existing selections remain below.</p>}
    <h4 ref={selectedHeading} tabIndex={-1}>Selected raw codes ({selected.length} of 100)</h4>
    <p>Selections remain active across pages and searches. Preview shows their actual effect before you apply a step.</p>
    <ul className="preparation-selected-codes">{selected.map(value => <li key={value}><code>{JSON.stringify(value)}</code>{!eligible.has(value) && <span> Not in the current selectable list; retained until you remove it.</span>}<RemoveCode fallback={selectedHeading} aria-label={`Remove selected raw code ${JSON.stringify(value)}`} onClick={() => toggle(value, false)}>Remove code</RemoveCode></li>)}</ul>
    {issue && <p role="status">{issue}</p>}
  </fieldset>;
}
