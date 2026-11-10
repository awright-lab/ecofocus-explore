import { assertJsonSize } from '../../../shared/jsonSizeBudget';
import type { ImportedDatasetQueryConfig } from './importedDatasetAnalytics';
import { importedRawFieldValue } from './importedRawValue';
import { guidedPreviewLimits, previewMetadataText } from './guidedPreviewModel';
import { normalizeDatasetSourceRefForImportedDataset } from './datasetSourceRegistry';

/** Exact selected-input identity, recomputed on render even if source objects were
 * mutated in place. Never serialize raw rows or unselected columns. No hash can
 * accidentally equate distinct inputs. This is ephemeral, never persisted. */
export function immediateGuidedPreviewKey(config: ImportedDatasetQueryConfig): string {
  const { dataset } = config;
  const sourceRows = dataset.rows?.length ? dataset.rows : dataset.previewRows;
  if (sourceRows.length >= guidedPreviewLimits.threshold) throw Error('Use background preview for this study.');
  const fields = [config.field, config.measureField ?? null, config.bannerField ?? null, config.filter?.field ?? null];
  const metadata = previewMetadataText({
    source: { id: dataset.id, title: dataset.title, importedAt: dataset.importedAt, rowCount: dataset.rowCount, fieldCount: dataset.fieldCount,
      sourceRef: normalizeDatasetSourceRefForImportedDataset(dataset), rowsOrigin: dataset.rows?.length ? 'rows' : 'previewRows' },
    fields, groupingScope: config.groupingScope ?? null, filter: config.filter?.value ?? null,
    metric: config.metric, chartType: config.chartType
  });
  const values = sourceRows.map(row => fields.map((field, index) =>
    index === 0 && config.groupingScope === 'all_respondents' ? '' : importedRawFieldValue(row, field)));
  // Check before constructing an expanded JSON string. Creation remains a fresh
  // original-source operation when an oversized preview cannot be inspected.
  try { assertJsonSize(values, { maxChars: 20 * 1024 * 1024, maxNodes: 30000, maxDepth: 4 }); }
  catch { throw Error('Selected values exceed the small-preview identity budget. No preview was calculated; your source and report were kept.'); }
  return metadata + '\n' + JSON.stringify(values);
}
