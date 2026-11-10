// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { DataWorkbench } from '../DataWorkbench';
import type { AnalysisAuthoringPanelProps } from '../AnalysisAuthoringPanel';
vi.mock('../DataExplorerSections', () => ({ SourcePickerSection: () => <div>Selected source tools</div>, QueryEditorSection: () => <div>Selected query tools</div>, AnalysisLibrarySection: () => <div>Saved analysis tools</div> }));
let root: Root, host: HTMLDivElement;
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
it('names the imported destination and opens its setup without replacing the current source', async () => {
  const open = vi.fn(), source = { kind: 'variableSet', id: 'existing_source' }, dataset = { id: 'synthetic_import', title: 'Synthetic research study' };
  const props = { exploreView: 'source', setExploreView: vi.fn(), selectedDataSource: source, importedDatasets: [dataset], openGuidedDataQuery: open } as unknown as AnalysisAuthoringPanelProps;
  await act(async () => root.render(<DataWorkbench {...props} />));
  const button = Array.from(host.querySelectorAll('button')).find(node => node.textContent === `Analyze ${dataset.title}`); expect(button).toBeTruthy();
  await act(async () => button!.click()); expect(open).toHaveBeenCalledWith({ outputMode: 'table', importedDatasetId: dataset.id });
  expect(host.textContent).toContain('Selected source tools'); expect(props.selectedDataSource).toBe(source);
});
it('does not offer an invented imported destination when the study library is empty', async () => {
  const open = vi.fn(); const props = { exploreView: 'analyze', setExploreView: vi.fn(), importedDatasets: [], openGuidedDataQuery: open } as unknown as AnalysisAuthoringPanelProps;
  await act(async () => root.render(<DataWorkbench {...props} />));
  expect(host.textContent).toContain('Selected query tools'); expect(host.querySelector('.studio-workbench-import-handoff')).toBeNull(); expect(open).not.toHaveBeenCalled();
});
it('offers each study by its exact identity without changing the selected advanced tab', async () => {
  const open = vi.fn(), setExploreView = vi.fn();
  const importedDatasets = [{ id: 'first', title: 'First study' }, { id: 'second', title: 'Second study' }];
  const props = { exploreView: 'library', setExploreView, importedDatasets, openGuidedDataQuery: open } as unknown as AnalysisAuthoringPanelProps;
  await act(async () => root.render(<DataWorkbench {...props} />));
  const buttons = Array.from(host.querySelectorAll<HTMLButtonElement>('.studio-workbench-import-handoff button'));
  expect(buttons.map(button => button.textContent)).toEqual(['Analyze First study', 'Analyze Second study']);
  await act(async () => buttons[1].click());
  expect(open).toHaveBeenCalledWith({ outputMode: 'table', importedDatasetId: 'second' });
  expect(setExploreView).not.toHaveBeenCalled();
  expect(host.textContent).toContain('Saved analysis tools');
});
