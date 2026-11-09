// @vitest-environment jsdom
import { act } from 'react';import { createRoot,type Root } from 'react-dom/client';import { beforeEach,afterEach,expect,it,vi } from 'vitest';
import { NumericFieldProfile } from '../NumericFieldProfile';import { importDatasetBuffer } from '../../../data/datasetImportModel';
let host:HTMLDivElement,root:Root;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();});
async function study(text:string){const parsed=await importDatasetBuffer(new TextEncoder().encode(text).buffer,'synthetic.csv');if(!parsed.dataset)throw Error(parsed.error);return parsed.dataset;}
function statistic(label:string){return Array.from(host.querySelectorAll('dt')).find(node=>node.textContent===label)?.nextElementSibling?.textContent;}
it('renders actual numeric statistics and exclusion counts with plain definitions',async()=>{
 const dataset=await study('Spend,Region\n10,North\n,South\ninvalid,North\n30,South\n');await act(async()=>root.render(<NumericFieldProfile dataset={dataset} field={dataset.fields[0]}/>));
 expect(statistic('Valid numeric values')).toBe('2');expect(statistic('Blank values')).toBe('1');expect(statistic('Invalid numeric values')).toBe('1');expect(statistic('Mean')).toBe('20');expect(statistic('Median')).toBe('20');expect(host.textContent).toContain('unweighted');expect(host.textContent).toContain('midpoint');
});
it('shows unavailable statistics instead of a zero mean for an empty numeric sample',async()=>{
 const dataset=await study('Spend\ninvalid\nmissing\n');await act(async()=>root.render(<NumericFieldProfile dataset={dataset} field={dataset.fields[0]}/>));expect(statistic('Mean')).toBe('Unavailable');expect(host.querySelector('[role="status"]')?.textContent).toContain('No valid numeric values');
});
it('does not label a preview distribution as study-wide statistics',async()=>{
 const dataset=await study('Spend\n1\n2\n3\n');dataset.rows=[];dataset.previewRows=dataset.previewRows.slice(0,1);await act(async()=>root.render(<NumericFieldProfile dataset={dataset} field={dataset.fields[0]}/>));expect(host.textContent).toContain('partial preview');expect(host.querySelector('dl')).toBeNull();
});
it('refreshes the profile on a different selected field without mutating data',async()=>{
 const dataset=await study('Spend,Count\n10,1\n30,3\n');const before=structuredClone(dataset);await act(async()=>root.render(<NumericFieldProfile dataset={dataset} field={dataset.fields[0]}/>));expect(statistic('Mean')).toBe('20');await act(async()=>root.render(<NumericFieldProfile dataset={dataset} field={dataset.fields[1]}/>));expect(statistic('Mean')).toBe('2');expect(dataset).toEqual(before);
});

it('does not format small nonzero measurements as zero',async()=>{
 const dataset=await study('Spend\n0.000001\n0.000003\n');await act(async()=>root.render(<NumericFieldProfile dataset={dataset} field={dataset.fields[0]}/>));expect(statistic('Minimum')).toBe('1E-6');expect(statistic('Mean')).toBe('2E-6');expect(statistic('Median')).toBe('2E-6');expect(host.textContent).toContain('scientific notation');
});

it('offers an explicit summary action only for usable complete local values',async()=>{
 const dataset=await study('Spend\n10\n30\n'),summarize=vi.fn();await act(async()=>root.render(<NumericFieldProfile dataset={dataset} field={dataset.fields[0]} onSummarize={summarize}/>));
 const button=host.querySelector<HTMLButtonElement>('button')!;expect(button.textContent).toBe('Summarize all respondents');expect(button.disabled).toBe(false);await act(async()=>button.click());expect(summarize).toHaveBeenCalledOnce();
 dataset.remote={provider:'netlify',projectUrl:'',bucket:'',objectPath:'synthetic.csv',uploadedAt:dataset.importedAt};await act(async()=>root.render(<NumericFieldProfile dataset={{...dataset}} field={dataset.fields[0]} onSummarize={summarize}/>));expect(host.querySelector<HTMLButtonElement>('button')!.disabled).toBe(true);
});

it('shows response-count bars with an accessible exact range table and preserves source data',async()=>{
 const dataset=await study('Spend\n0\n5\n10\n'),before=structuredClone(dataset);await act(async()=>root.render(<NumericFieldProfile dataset={dataset} field={dataset.fields[0]}/>));
 const distribution=host.querySelector('.numeric-distribution')!;expect(distribution.querySelector('svg')?.getAttribute('aria-label')).toContain('unweighted response counts');
 expect(Array.from(distribution.querySelectorAll('[data-count]')).map(node=>node.getAttribute('data-count'))).toEqual(['1','2']);
 expect(distribution.querySelector('details summary')?.textContent).toBe('See range counts');expect(distribution.textContent).toContain('0 to less than 5');expect(distribution.textContent).toContain('5 to 10 (inclusive)');expect(dataset).toEqual(before);
});
it('does not invent distribution bars for invalid-only or incomplete data',async()=>{
 const dataset=await study('Spend\ninvalid\nmissing\n');await act(async()=>root.render(<NumericFieldProfile dataset={dataset} field={dataset.fields[0]}/>));expect(host.querySelector('.numeric-distribution')).toBeNull();
 const complete=await study('Spend\n1\n2\n3\n');complete.rows=[];complete.previewRows=complete.previewRows.slice(0,1);await act(async()=>root.render(<NumericFieldProfile dataset={complete} field={complete.fields[0]}/>));expect(host.querySelector('.numeric-distribution')).toBeNull();
});

it('recomputes a small summary after same-reference selected values change',async()=>{
 const dataset=await study('Spend\n10\n30\n'),field=dataset.fields[0];await act(async()=>root.render(<NumericFieldProfile dataset={dataset} field={field}/>));expect(statistic('Mean')).toBe('20');
 dataset.rows[1][field.sourceColumn]='300';const before=structuredClone(dataset);await act(async()=>root.render(<NumericFieldProfile dataset={dataset} field={field}/>));expect(statistic('Mean')).toBe('155');expect(dataset).toEqual(before);
});

it('recomputes after an in-place selected source-column mapping change',async()=>{
 const dataset=await study('Spend,Other\n10,1\n30,3\n'),field=dataset.fields[0];await act(async()=>root.render(<NumericFieldProfile dataset={dataset} field={field}/>));expect(statistic('Mean')).toBe('20');
 field.sourceColumn='Other';const before=structuredClone(dataset);await act(async()=>root.render(<NumericFieldProfile dataset={dataset} field={field}/>));expect(statistic('Mean')).toBe('2');expect(dataset).toEqual(before);
});
