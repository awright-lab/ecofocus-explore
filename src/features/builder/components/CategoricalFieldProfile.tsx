import { useMemo, useState } from "react";
import type { ImportedDatasetField, ImportedDatasetRecord } from "../../../../shared/types/dashboard";
import { buildImportedCategoricalProfile } from "../../data/importedCategoricalProfile";

function CategoryCounts({ dataset, field }: { dataset: ImportedDatasetRecord; field: ImportedDatasetField }) {
  const profile = useMemo(() => buildImportedCategoricalProfile(dataset, field), [dataset, field]);
  if (profile.status === "unavailable") return <p role="status">{profile.reason}</p>;
  return <div className="category-profile-content">
    <p>{profile.rows.toLocaleString()} stored responses; unweighted. Percentages use the {profile.valid.toLocaleString()} nonblank responses.</p>
    <dl><div><dt>Nonblank responses</dt><dd>{profile.valid.toLocaleString()}</dd></div><div><dt>Blank responses</dt><dd>{profile.blank.toLocaleString()}</dd></div><div><dt>Observed categories</dt><dd>{profile.observedCategories.toLocaleString()}</dd></div></dl>
    {!profile.valid ? <p role="status">No category values were recorded. Percentages are unavailable.</p> : <table>
      <caption>Most common categories for {field.variableLabel || field.label}</caption>
      <thead><tr><th scope="col">Category</th><th scope="col">Responses</th><th scope="col">Percent</th></tr></thead>
      <tbody>{profile.categories.map(category => <tr key={category.id}><th scope="row">{category.label}</th><td>{category.count.toLocaleString()}</td><td>{new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(category.share)}%</td></tr>)}</tbody>
    </table>}
    {profile.omittedCategories > 0 && <p>{profile.omittedCategories.toLocaleString()} additional categories with {profile.omittedResponses.toLocaleString()} responses are not shown. Create a response table to see every category.</p>}
    {profile.unusedLabels > 0 && <p>{profile.unusedLabels.toLocaleString()} declared categories have no recorded responses.</p>}
    <small>Each nonblank stored value counts once. Percentages are rounded for display. This is a descriptive count, without statistical testing.</small>
  </div>;
}

export function CategoricalFieldProfile({ dataset, field }: { dataset: ImportedDatasetRecord; field: ImportedDatasetField }) {
  const [open, setOpen] = useState(false);
  return <details className="categorical-field-profile" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Inspect response categories</summary>
    {open && <CategoryCounts dataset={dataset} field={field} />}
  </details>;
}
