import { useMemo, useState } from 'react';
import type { ImportedDatasetField, ImportedDatasetRecord } from '../../../shared/types/dashboard';
import { waveCategories, type WaveFieldMapping } from './reportRefreshMapping';

export const mappingPageSizes = { categories: 10, choices: 25, review: 50 } as const;
function windowPage<T>(items: T[], requested: number, size: number) {
  const page = Math.max(0, Math.min(requested, Math.ceil(items.length / size) - 1));
  return { page, items: items.slice(page * size, (page + 1) * size) };
}
function Pager({ label, page, count, size, onPage }: { label: string; page: number; count: number; size: number; onPage: (page: number) => void }) {
  return <nav aria-label={label}><button type="button" disabled={page === 0} onClick={() => onPage(page - 1)}>Previous {label}</button><span role="status">{count ? page * size + 1 : 0}–{Math.min((page + 1) * size, count)} of {count}</span><button type="button" disabled={(page + 1) * size >= count} onClick={() => onPage(page + 1)}>Next {label}</button></nav>;
}

export function ReportMappingPanel({ source, target, fields, mappings, binding, busy, onEdit, onUpdate }: {
  source: ImportedDatasetRecord; target: ImportedDatasetRecord; fields: ImportedDatasetField[]; mappings?: WaveFieldMapping[];
  binding: string; busy: boolean; onEdit: () => void; onUpdate: (entry: WaveFieldMapping) => void;
}) {
  const [index, setIndex] = useState(0), active = windowPage(fields, index, 1), field = active.items[0];
  // A missing entry is an unmapped field, never a non-null assertion or an inferred match.
  const entry = field ? mappings?.find(item => item.sourceFieldId === field.id) : undefined;
  return <details className="report-refresh-mapping"><summary>Map renamed fields and categories</summary>
    <p>Map only questions used by this report. Each category mapping must be one-to-one. Numeric recoding, filters, merged, added or removed categories require separate review. Reopening retains selections; edits require a fresh preview.</p>
    <button type="button" disabled={busy} onClick={onEdit}>Edit field and category mappings</button>
    {mappings && field && <fieldset disabled={busy}><legend>{field.label} ({field.sourceColumn})</legend>
      <Pager label="referenced fields" page={active.page} count={fields.length} size={1} onPage={setIndex}/>
      <FieldMapping key={field.id} {...{source,target,field,binding,onUpdate}} entry={entry ?? {sourceFieldId:field.id,targetFieldId:'',categories:[]}}/>
    </fieldset>}
  </details>;
}
function FieldMapping({ source, target, field, entry, binding, onUpdate }: {
  source: ImportedDatasetRecord; target: ImportedDatasetRecord; field: ImportedDatasetField; entry: WaveFieldMapping; binding: string; onUpdate: (entry: WaveFieldMapping) => void;
}) {
  const [search,setSearch] = useState(''), [page,setPage] = useState(0);
  const candidates = useMemo(() => target.fields.filter(candidate => `${candidate.label} ${candidate.sourceColumn}`.toLowerCase().includes(search.toLowerCase())), [binding, target, search]);
  const choices = windowPage(candidates,page,mappingPageSizes.choices), targetField = target.fields.find(item => item.id === entry.targetFieldId);
  const visible = choices.items.some(item => item.id === targetField?.id) || !targetField ? choices.items : [targetField,...choices.items];
  return <>
    <label>Search target fields<input value={search} onChange={event=>{setSearch(event.target.value);setPage(0);}}/></label>
    <label>Target field for {field.label}<select value={targetField?.id ?? ''} onChange={event=>onUpdate({...entry,targetFieldId:event.target.value,categories:[]})}>
      <option value="">Unmapped</option>{visible.map(candidate=><option key={candidate.id} value={candidate.id}>{candidate.label} ({candidate.sourceColumn}) · {candidate.type}</option>)}
    </select></label>
    <Pager label="target fields" page={choices.page} count={candidates.length} size={mappingPageSizes.choices} onPage={setPage}/>
    {field.type !== 'numeric' && <CategoryMapping key={`${field.id}:${targetField?.id ?? ''}`} {...{source,target,field,targetField,entry,binding,onUpdate}}/>}
  </>;
}
function inspectCategories(study: ImportedDatasetRecord, field?: ImportedDatasetField): { values: string[]; error?: string } {
  try { return { values: field ? waveCategories(study,field) : [] }; }
  catch(error) { return { values: [], error: error instanceof Error ? error.message : 'Category values could not be inspected.' }; }
}
function CategoryMapping({ source, target, field, targetField, entry, binding, onUpdate }: {
  source: ImportedDatasetRecord; target: ImportedDatasetRecord; field: ImportedDatasetField; targetField?: ImportedDatasetField; entry: WaveFieldMapping; binding: string; onUpdate: (entry: WaveFieldMapping) => void;
}) {
  const [sourceSearch,setSourceSearch]=useState(''),[targetSearch,setTargetSearch]=useState(''),[sourcePage,setSourcePage]=useState(0),[targetPage,setTargetPage]=useState(0);
  // Compute categories once for the active field/context, not once per source row or edit.
  // Binding changes also catch same-reference schema and row replacements.
  const oldChoices=useMemo(()=>inspectCategories(source,field),[binding,source,field]);
  const newChoices=useMemo(()=>inspectCategories(target,targetField),[binding,target,targetField]);
  const sourceValues=oldChoices.values,targetValues=newChoices.values;
  const oldValues=useMemo(()=>sourceValues.filter(value=>`${value} ${field.valueLabels?.[value] ?? ''}`.toLowerCase().includes(sourceSearch.toLowerCase())),[sourceValues,field,sourceSearch]);
  const newValues=useMemo(()=>targetValues.filter(value=>`${value} ${targetField?.valueLabels?.[value] ?? ''}`.toLowerCase().includes(targetSearch.toLowerCase())),[targetValues,targetField,targetSearch]);
  const oldWindow=windowPage(oldValues,sourcePage,mappingPageSizes.categories), newWindow=windowPage(newValues,targetPage,mappingPageSizes.choices);
  const selectedBySource=new Map(entry.categories.map(item=>[item.source,item.target]));
  const targetSet=useMemo(()=>new Set(targetValues),[targetValues]);
  return <div>
    {(oldChoices.error || newChoices.error) && <p role="alert">Category choices are unavailable: {oldChoices.error || newChoices.error} Review the original source before mapping.</p>}
    <label>Search source categories<input value={sourceSearch} onChange={event=>{setSourceSearch(event.target.value);setSourcePage(0);}}/></label>
    <Pager label="source categories" page={oldWindow.page} count={oldValues.length} size={mappingPageSizes.categories} onPage={setSourcePage}/>
    <label>Search target categories<input value={targetSearch} onChange={event=>{setTargetSearch(event.target.value);setTargetPage(0);}}/></label>
    <Pager label="target categories" page={newWindow.page} count={newValues.length} size={mappingPageSizes.choices} onPage={setTargetPage}/>
    <p>Only the current target choices are listed. A selected value remains visible when it is outside the search or page.</p>
    {oldWindow.items.map(raw=>{
      const recorded=selectedBySource.get(raw), selected=recorded && targetSet.has(recorded) ? recorded : '';
      const choices=selected && !newWindow.items.includes(selected) ? [selected,...newWindow.items] : newWindow.items;
      return <label key={raw}>{field.valueLabels?.[raw] ?? raw} [raw: {raw}]<select aria-label={`Target category for ${field.sourceColumn}: ${raw}`} value={selected} disabled={!targetField} onChange={event=>onUpdate({...entry,categories:[...entry.categories.filter(item=>item.source!==raw),...(event.target.value ? [{source:raw,target:event.target.value}] : [])]})}>
        <option value="">Unmapped</option>{choices.map(value=><option key={value} value={value}>{targetField?.valueLabels?.[value] ?? value} [raw: {value}]</option>)}
      </select></label>;
    })}
  </div>;
}

export function MappingCategoryReview({ categories }: { categories: WaveFieldMapping['categories'] }) {
  const [search,setSearch]=useState(''),[page,setPage]=useState(0);
  const matches=useMemo(()=>categories.filter(item=>`${item.source} ${item.target}`.toLowerCase().includes(search.toLowerCase())),[categories,search]);
  const visible=windowPage(matches,page,mappingPageSizes.review);
  if(!categories.length)return null;
  return <div><label>Search reviewed categories<input value={search} onChange={event=>{setSearch(event.target.value);setPage(0);}}/></label><ul>{visible.items.map(item=><li key={item.source}>{item.source} → {item.target}</li>)}</ul><Pager label="reviewed categories" page={visible.page} count={matches.length} size={mappingPageSizes.review} onPage={setPage}/></div>;
}
