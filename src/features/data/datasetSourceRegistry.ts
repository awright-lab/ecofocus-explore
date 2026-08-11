import type { DatasetSourceRef } from "../../../shared/types/dataSource";
import type { DatasetId } from "../../../shared/types/analytics";
import type { DashboardWorkspace, ImportedDatasetRecord } from "../../../shared/types/dashboard";
import { defaultDataset } from "../builder/builderConstants";

export interface DatasetSourceRegistryEntry extends DatasetSourceRef {
  rowCount?: number;
  fieldCount?: number;
  statusLabel?: string;
  detail?: string;
}

export function datasetSourceRefForSeededDataset(datasetId: DatasetId = defaultDataset.id): DatasetSourceRef {
  return {
    id: `seeded:${datasetId}`,
    kind: "seeded_demo",
    provider: "ecofocus_demo",
    label: defaultDataset.label,
    datasetId
  };
}

export function datasetSourceRefForImportedDataset(dataset: Pick<ImportedDatasetRecord, "id" | "title" | "sourceType" | "remote">): DatasetSourceRef {
  const remote = dataset.remote;
  const provider = remote?.provider ?? dataset.sourceType;
  return {
    id: `imported:${dataset.id}`,
    kind: remote ? "workspace_database" : "imported_file",
    provider,
    label: dataset.title,
    datasetId: dataset.id,
    connectionId: remote ? `${remote.provider}:${remote.projectUrl}` : undefined,
    remoteRecordId: remote?.recordId,
    objectPath: remote?.objectPath
  };
}

export function normalizeDatasetSourceRefForImportedDataset(dataset: ImportedDatasetRecord): DatasetSourceRef {
  const fallback = datasetSourceRefForImportedDataset(dataset);
  return {
    ...fallback,
    ...dataset.sourceRef,
    id: dataset.sourceRef?.id ?? fallback.id,
    label: dataset.sourceRef?.label || dataset.title,
    datasetId: dataset.id
  };
}

export function buildWorkspaceDatasetSourceRegistry(workspace: DashboardWorkspace): DatasetSourceRegistryEntry[] {
  return [
    {
      ...datasetSourceRefForSeededDataset(),
      statusLabel: "Demo source",
      detail: "Built-in EcoFocus study metadata for templates and seeded examples."
    },
    ...workspace.importedDatasets.map((dataset) => ({
      ...normalizeDatasetSourceRefForImportedDataset(dataset),
      rowCount: dataset.rowCount,
      fieldCount: dataset.fieldCount,
      statusLabel: dataset.importStatus?.label,
      detail: dataset.importStatus?.detail ?? dataset.importMetadata?.formatLabel
    })),
    ...(workspace.liveDatasetSources ?? []).map((source) => ({
      ...source.sourceRef,
      rowCount: source.rowCountEstimate,
      fieldCount: source.inspection?.fields.length ?? source.fieldCount,
      statusLabel: source.inspection?.statusLabel ?? source.statusLabel,
      detail: [
        source.objectType,
        source.syncMode === "live_query" ? "Live query" : "Snapshot",
        source.objectPath,
        source.inspection?.status === "inspected" ? "Fields inspected" : null
      ].filter(Boolean).join(" · ")
    }))
  ];
}
