// @vitest-environment jsdom
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ReportPageTree } from "../ReportPageTree";
import { initialDashboard } from "../../../document/documentSeeds";

let host: HTMLDivElement, root: Root;
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
async function setup(secondId = 'page two/#') {
  const first = structuredClone(initialDashboard.pages[0]); first.id = 'first'; first.title = 'First'; first.order = 1;
  first.tiles = first.tiles.slice(0, 1); first.elements = first.elements.slice(0, 1);
  first.tiles[0].title = 'Repeated'; first.tiles[0].name = 'Searchable internal name'; first.tiles[0].layout.zIndex = 1;
  first.elements[0].name = 'Repeated'; first.elements[0].layout.zIndex = 2;
  const second = structuredClone(first); second.id = secondId; second.title = 'Second'; second.order = 2;
  const props: ComponentProps<typeof ReportPageTree> = {
    sortedPages: [first, second], activePage: first, selectedTileId: first.tiles[0].id, selectedElementId: null,
    multiSelectedObjects: [{ type: 'tile', id: first.tiles[0].id }], toggleMultiSelectedObject: vi.fn(), clearMultiSelection: vi.fn(),
    pageTemplates: [], pageThemes: [], setActivePageId: vi.fn(), selectPage: vi.fn(), selectTile: vi.fn(), selectElement: vi.fn(),
    recordReportTreeSelectionCue: vi.fn(), updateTile: vi.fn(), updateElement: vi.fn(), renamePage: vi.fn(), addPage: vi.fn(),
    duplicateActivePage: vi.fn(), duplicatePageById: vi.fn(), deleteActivePage: vi.fn(), deletePageById: vi.fn(), movePage: vi.fn(),
  };
  const render = () => root.render(<ReportPageTree {...props} />);
  await act(async () => render()); return { props, render };
}
function button(label: string) { const node = Array.from(host.querySelectorAll('button')).find(node => node.getAttribute('aria-label') === label || node.textContent === label); if (!node) throw Error(label); return node; }
async function click(label: string) { await act(async () => button(label).click()); }
async function input(value: string) { await act(async () => { const node = host.querySelector('input')!; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(node, value); node.dispatchEvent(new Event('input', { bubbles: true })); }); }
async function startRename() { await act(async () => { const more = host.querySelector<HTMLDetailsElement>('details')!; more.open = true; }); await click('Rename'); }

it('exposes current page, real disclosure targets and unambiguous object/selection/action names', async () => {
  await setup();
  expect(host.querySelector('nav')?.getAttribute('aria-label')).toBe('Report pages and objects');
  expect(button('Open page 1: First').getAttribute('aria-current')).toBe('page');
  expect(button('Open page 2: Second').hasAttribute('aria-current')).toBe(false);
  await click('Show objects on page 1: First'); await click('Show objects on page 2: Second');
  for (const page of ['1: First', '2: Second']) {
    const disclosure = button(`Hide objects on page ${page}`);
    expect(disclosure.getAttribute('aria-expanded')).toBe('true');
    expect(document.getElementById(disclosure.getAttribute('aria-controls')!)).not.toBeNull();
  }
  const checks = Array.from(host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
  expect(checks).toHaveLength(4); expect(new Set(checks.map(node => node.getAttribute('aria-label'))).size).toBe(4);
  expect(checks.every(node => !!node.getAttribute('aria-label'))).toBe(true);
  expect(checks[0].checked).toBe(true); expect(checks[2].checked).toBe(false); expect(checks[2].disabled).toBe(true);
  expect(host.querySelectorAll('.report-page-object-select[aria-pressed="true"]')).toHaveLength(1);
});
it('withholds inactive-page mutations and allows explicit selection/navigation plus active mutations', async () => {
  const { props } = await setup();
  await click('Show objects on page 1: First'); await click('Show objects on page 2: Second');
  const inactive = host.querySelectorAll('.report-page-group')[1];
  const actions = Array.from(inactive.querySelectorAll<HTMLButtonElement>('.report-page-object-actions button'));
  expect(actions).toHaveLength(4); expect(actions.every(node => node.disabled)).toBe(true);
  await act(async () => actions.forEach(node => node.click()));
  expect(props.updateTile).not.toHaveBeenCalled(); expect(props.updateElement).not.toHaveBeenCalled();
  await act(async () => inactive.querySelector<HTMLButtonElement>('.report-page-object-select')!.click());
  expect(props.setActivePageId).toHaveBeenCalledWith('page two/#'); expect(props.selectTile).toHaveBeenCalledWith(props.activePage.tiles[0].id);
  await act(async () => host.querySelector<HTMLButtonElement>('.report-page-object-actions button')!.click());
  expect(props.updateTile).toHaveBeenCalledWith(props.activePage.tiles[0].id, { hidden: true });
});
it('keeps disclosure targets valid for opaque source identities, including unpaired Unicode', async () => {
  await setup('\ud800'); await click('Show objects on page 2: Second');
  const id = button('Hide objects on page 2: Second').getAttribute('aria-controls')!;
  expect(document.getElementById(id)?.getAttribute('aria-label')).toBe('Objects on page 2: Second');
});
it('reports search results, finds internal analysis names and exposes an actionable empty state', async () => {
  await setup(); await input('Searchable internal name'); expect(host.querySelector('[role="status"]')?.textContent).toContain('2 of 2 pages');
  await input('missing'); expect(host.querySelector('[role="status"]')?.textContent).toContain('0 of 2 pages'); expect(host.textContent).toContain('No pages match');
  const search = host.querySelector('input')!; expect(document.getElementById(search.getAttribute('aria-describedby')!)).toBe(host.querySelector('[role="status"]'));
  await input('First'); expect(host.querySelector('[role="status"]')?.textContent).toContain('1 of 2 pages');
});
it('protects IME composition and restores focus after keyboard rename cancellation', async () => {
  const { props } = await setup(); await startRename();
  const rename = host.querySelector<HTMLInputElement>('[aria-label="Rename page 1: First"]')!;
  expect(document.activeElement).toBe(rename); expect(document.getElementById(rename.getAttribute('aria-describedby')!)?.textContent).toContain('Enter to save');
  await act(async () => rename.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true })));
  expect(props.renamePage).not.toHaveBeenCalled(); expect(document.activeElement).toBe(rename);
  await act(async () => rename.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(props.renamePage).not.toHaveBeenCalled(); expect(document.activeElement).toBe(button('Open page 1: First'));
});
it('saves the exact rename and returns focus to search if the renamed page leaves current results', async () => {
  const { props, render } = await setup(); await input('First');
  props.renamePage = vi.fn((id, title) => { props.sortedPages = props.sortedPages.map(page => page.id === id ? { ...page, title } : page); render(); });
  await act(async () => render()); await startRename();
  const rename = host.querySelector<HTMLInputElement>('[aria-label="Rename page 1: First"]')!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(rename, 'New title'); rename.dispatchEvent(new Event('input', { bubbles: true })); });
  await act(async () => rename.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
  expect(props.renamePage).toHaveBeenCalledWith('first', 'New title');
  expect(document.activeElement).toBe(host.querySelector('input')); expect(host.querySelector('[role="status"]')?.textContent).toContain('0 of 2 pages');
});
