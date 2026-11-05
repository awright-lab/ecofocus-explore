import { storageKey } from "../builder/builderConstants";
import { normalizeDashboard, normalizeImportedDataset, normalizeImportedDatasetField } from "./documentModel";
import { initialDashboard } from "./documentSeeds";
import { encodeImportedRows } from "./workspaceRowStorage";
import { importedStudyRemovalBlocker, draftImportedStudyReferences } from "./importedStudyUsage";
import { assertConsistentSavedStudies, assertSavedReportIdentities, assertSavedCanvasIdentities, isSavedObject, readSavedStudies, type SavedWorkspaceFormat } from "./workspaceStorageValidation";
import type {
  DatasetConnectionProfile,
  DatasetConnectionVerificationReport,
  LiveDatasetFieldDescriptor,
  LiveDatasetQueryDefinition,
  LiveDatasetSourceDescriptor,
  LiveDatasetSourceInspectionReport
} from "../../../shared/types/dataSource";
import type { DashboardDraft, DashboardReportRecord, DashboardWorkspace, ImportedDatasetField, ImportedDatasetRecord, PublishedDashboardSnapshot } from "../../../shared/types/dashboard";

export const legacyWorkspaceStorageKey = "insightcanvas_report_workspace_v1";
export const workspaceStorageKey = "insightcanvas_report_workspace_v2";

export type WorkspaceRoute =
  | { mode: "invalid"; reportId: null }
  | { mode: "home"; reportId: null }
  | { mode: "builder"; reportId: string | null; datasetId?: string }
  | { mode: "published"; reportId: string | null; snapshotId: string | null };

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function makePublishedViewerPath(reportId: string, snapshotId: string) {
  return `#/published/${encodeURIComponent(reportId)}/${encodeURIComponent(snapshotId)}`;
}

export function makeWorkspaceHomePath() {
  return "#/";
}

export function makeBuilderReportPath(reportId: string) {
  return `#/reports/${encodeURIComponent(reportId)}`;
}

export function parseWorkspaceRoute(hash = window.location.hash): WorkspaceRoute {
  const [path, query] = hash.replace(/^#\/?/, "").split("?");
  const segments = path.split("/");
  if (segments.at(-1) === "") segments.pop(); // Accept one conventional trailing slash.
  if (segments.some(part => !part)) return { mode: "invalid", reportId: null };
  let parts: string[];
  try { parts = segments.map((part) => decodeURIComponent(part)); }
  catch { return { mode: "invalid", reportId: null }; }

  if (parts[0] === "published") {
    if (parts.length !== 3) return { mode: "invalid", reportId: null };
    return {
      mode: "published",
      reportId: parts[1] ?? null,
      snapshotId: parts[2] ?? null
    };
  }

  if (parts[0] === "reports") {
    if (parts.length > 2) return { mode: "invalid", reportId: null };
    const datasetId = new URLSearchParams(query).get("study");
    return {
      mode: "builder",
      reportId: parts[1] ?? null,
      ...(datasetId ? { datasetId } : {})
    };
  }

  return parts.length ? { mode: "invalid", reportId: null } : { mode: "home", reportId: null };
}

function cloneDashboard(dashboard: DashboardDraft): DashboardDraft {
  return JSON.parse(JSON.stringify(dashboard)) as DashboardDraft;
}

function mergeImportedDatasets(...groups: Array<Array<Partial<ImportedDatasetRecord>> | undefined>) {
  const datasetMap = new Map<string, ImportedDatasetRecord>();
  groups.flatMap((group) => group ?? []).forEach((dataset, index) => {
    const normalized = normalizeImportedDataset(dataset, index);
    datasetMap.set(normalized.id, normalized);
  });
  return Array.from(datasetMap.values()).sort((a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime());
}

export function createReportRecord(dashboard: DashboardDraft, createdAt = nowIso()): DashboardReportRecord {
  const normalized = normalizeDashboard(dashboard);
  return {
    id: normalized.id,
    title: normalized.title,
    draft: normalized,
    createdAt,
    updatedAt: createdAt,
    lastOpenedAt: createdAt
  };
}

function defaultWorkspace(): DashboardWorkspace {
  const report = createReportRecord(initialDashboard);
  return {
    id: "local_workspace",
    label: "InsightCanvas Workspace",
    activeReportId: report.id,
    datasetConnections: [],
    liveDatasetSources: [],
    importedDatasets: [],
    reports: [report],
    publishedSnapshots: []
  };
}

function migrateLegacyDashboard(savedDashboard: string): DashboardWorkspace {
  const parsed: unknown = JSON.parse(savedDashboard);
  const savedDraft = readSavedDashboard(parsed, "v1");
  assertSavedReportIdentities([{ id: savedDraft.id, draft: savedDraft }], "v1");
  const dashboard = normalizeDashboard(savedDraft);
  const report = createReportRecord(dashboard);
  return normalizeDashboardWorkspace({
    id: "local_workspace",
    label: "InsightCanvas Workspace",
    activeReportId: report.id,
    datasetConnections: [],
    liveDatasetSources: [],
    importedDatasets: dashboard.importedDatasets,
    reports: [report],
    publishedSnapshots: []
  });
}

function readSavedDashboard(value: unknown, format: SavedWorkspaceFormat): DashboardDraft {
  if (!isSavedObject(value) || !Array.isArray(value.pages) || !value.pages.length ||
      !value.pages.every((page) => isSavedObject(page) && Array.isArray(page.elements) && Array.isArray(page.tiles))) {
    throw new Error("The saved report is incomplete or damaged. Your saved data has not been changed.");
  }
  assertSavedCanvasIdentities(value.pages as Array<Record<string, unknown>>);
  if (format === "v2" && (typeof value.id !== "string" || typeof value.title !== "string" ||
      !["draft", "published"].includes(value.status as string))) {
    throw new Error("The saved report is incomplete or damaged. Your saved data has not been changed.");
  }
  if (format === "v1" && ((value.title != null && typeof value.title !== "string") ||
      (value.status != null && !["draft", "published"].includes(value.status as string)))) {
    throw new Error("The saved report is incomplete or damaged. Your saved data has not been changed.");
  }
  return { ...value,
    ...(format === "v1" ? { title: value.title ?? "Untitled report", status: value.status ?? "draft" } : {}),
    importedDatasets: readSavedStudies(value.importedDatasets, format) } as unknown as DashboardDraft;
}

function parseSavedWorkspace(raw: string, format: SavedWorkspaceFormat): DashboardWorkspace {
  const parsed: unknown = JSON.parse(raw);
  if (!isSavedObject(parsed) || !Array.isArray(parsed.reports) || !parsed.reports.length) {
    throw new Error("The saved workspace is incomplete or damaged. Your saved data has not been changed.");
  }
  for (const key of ["datasetConnections", "liveDatasetSources", "publishedSnapshots"]) {
    if ((format === "v2" || parsed[key] !== undefined) && (!Array.isArray(parsed[key]) || !(parsed[key] as unknown[]).every(isSavedObject))) {
      throw new Error("The saved workspace is incomplete or damaged. Your saved data has not been changed.");
    }
  }
  if (format === "v1" && ["id", "label", "activeReportId"].some((key) => parsed[key] != null && typeof parsed[key] !== "string")) {
    throw new Error("The saved workspace is incomplete or damaged. Your saved data has not been changed.");
  }
  if (format === "v2" && !["id", "label", "activeReportId"].every((key) => typeof parsed[key] === "string")) {
    throw new Error("The saved workspace is incomplete or damaged. Your saved data has not been changed.");
  }
  const reports = parsed.reports.map((report) => {
    if (!isSavedObject(report)) throw new Error("The saved report is damaged.");
    if (format === "v1" && ["title", "createdAt", "updatedAt", "lastOpenedAt"].some((key) => report[key] != null && typeof report[key] !== "string")) {
      throw new Error("The saved report is incomplete or damaged. Your saved data has not been changed.");
    }
    if (format === "v2" && !["id", "title", "createdAt", "updatedAt", "lastOpenedAt"].every((key) => typeof report[key] === "string")) {
      throw new Error("The saved report is incomplete or damaged. Your saved data has not been changed.");
    }
    return { ...report, draft: readSavedDashboard(report.draft, format) };
  });
  assertSavedReportIdentities(reports, format);
  const publishedSnapshots = ((parsed.publishedSnapshots ?? []) as Array<Record<string, unknown>>).map((snapshot) => ({
    ...snapshot, dashboard: readSavedDashboard(snapshot.dashboard, format)
  }));
  const importedDatasets = readSavedStudies(parsed.importedDatasets, format);
  assertConsistentSavedStudies([importedDatasets, ...reports.map((report) => report.draft.importedDatasets)]);
  return normalizeDashboardWorkspace({
    ...parsed, reports, publishedSnapshots,
    importedDatasets
  } as DashboardWorkspace);
}

export type StoredWorkspaceSource = { key: typeof workspaceStorageKey | typeof legacyWorkspaceStorageKey | typeof storageKey; raw: string };

// Capture the exact winning source once. Empty or damaged newer saves must not
// fall through to an older source, and readers never repair/write storage.
export function readStoredWorkspaceSource(storage: Pick<Storage, "getItem"> = window.localStorage): StoredWorkspaceSource | null {
  for (const key of [workspaceStorageKey, legacyWorkspaceStorageKey, storageKey] as const) {
    const raw = storage.getItem(key);
    if (raw !== null) return { key, raw };
  }
  return null;
}

export function decodeStoredWorkspaceSource(source: StoredWorkspaceSource): DashboardWorkspace {
  if (source.key === workspaceStorageKey) return parseSavedWorkspace(source.raw, "v2");
  if (source.key === legacyWorkspaceStorageKey) return parseSavedWorkspace(source.raw, "v1");
  if (source.key === storageKey) return migrateLegacyDashboard(source.raw);
  throw new Error("Unknown saved workspace format. Existing storage was not changed.");
}

export function readStoredWorkspaceCopy(): string | null {
  return readStoredWorkspaceSource()?.raw ?? null;
}

export function normalizeDashboardWorkspace(workspace: Partial<DashboardWorkspace> | null | undefined): DashboardWorkspace {
  if (!workspace?.reports?.length) return defaultWorkspace();

  const reports = workspace.reports.map((report, index) => {
    const normalizedDraft = normalizeDashboard(report.draft ?? initialDashboard);
    const id = report.id || normalizedDraft.id || `report_${index + 1}`;
    const createdAt = report.createdAt ?? nowIso();
    return {
      ...report,
      id,
      title: report.title || normalizedDraft.title || "Untitled report",
      draft: { ...normalizedDraft, id },
      createdAt,
      updatedAt: report.updatedAt ?? createdAt,
      lastOpenedAt: report.lastOpenedAt ?? createdAt
    };
  });
  const activeReportId =
    workspace.activeReportId && reports.some((report) => report.id === workspace.activeReportId)
      ? workspace.activeReportId
      : reports[0].id;
  const publishedSnapshots = (workspace.publishedSnapshots ?? []).map((snapshot) => ({
    ...snapshot,
    dashboard: normalizeDashboard(snapshot.dashboard)
  }));
  const importedDatasets = mergeImportedDatasets(
    workspace.importedDatasets,
    reports.flatMap((report) => report.draft.importedDatasets ?? [])
  );

  return {
    id: workspace.id ?? "local_workspace",
    label: workspace.label ?? "InsightCanvas Workspace",
    activeReportId,
    datasetConnections: workspace.datasetConnections ?? [],
    liveDatasetSources: workspace.liveDatasetSources ?? [],
    importedDatasets,
    reports,
    publishedSnapshots
  };
}

export function loadDashboardWorkspace(): DashboardWorkspace {
  // A new key keeps older app versions from treating encoded data as a preview.
  // A malformed v2 workspace fails closed instead of autosaving a default over it.
  const source = readStoredWorkspaceSource();
  return source ? decodeStoredWorkspaceSource(source) : defaultWorkspace();
}

function compactImportedDatasetForWorkspace(dataset: ImportedDatasetRecord): ImportedDatasetRecord {
  const isRemoteNetlifyDataset = dataset.remote?.provider === "netlify";
  const fieldPreview = isRemoteNetlifyDataset ? dataset.fields.slice(0, 80) : dataset.fields;
  const remoteFieldNote = isRemoteNetlifyDataset && dataset.fields.length > fieldPreview.length
    ? "Full imported field metadata is loaded from Netlify Database as needed in the Data Library."
    : null;
  return {
    ...dataset,
    fields: fieldPreview,
    // Only Netlify imports have a server query path that can recover these rows.
    // Local and Supabase imports are queried in the browser, so their complete
    // respondent data must survive a workspace save and reload.
    rows: isRemoteNetlifyDataset ? [] : dataset.rows,
    previewRows: dataset.previewRows.slice(0, 25),
    notes: [
      ...dataset.notes,
      dataset.notes.includes("Stored compactly in report drafts; full imported rows are kept at workspace level.")
        ? null
        : "Stored compactly in report drafts; full imported rows are kept at workspace level.",
      remoteFieldNote && !dataset.notes.includes(remoteFieldNote) ? remoteFieldNote : null
    ].filter(Boolean) as string[]
  };
}

function compactDashboardForWorkspaceStorage(dashboard: DashboardDraft): DashboardDraft {
  return {
    ...dashboard,
    importedDatasets: []
  };
}

function compactWorkspaceForStorage(workspace: DashboardWorkspace): DashboardWorkspace {
  return {
    ...workspace,
    importedDatasets: workspace.importedDatasets.map((dataset) => encodeImportedRows(compactImportedDatasetForWorkspace(dataset))),
    reports: workspace.reports.map((report) => ({
      ...report,
      draft: compactDashboardForWorkspaceStorage(report.draft)
    })),
    publishedSnapshots: workspace.publishedSnapshots.map((snapshot) => ({
      ...snapshot,
      // Snapshots own historical study versions. They cannot borrow the mutable
      // workspace copy after reopening, even when dataset IDs are identical.
      dashboard: { ...snapshot.dashboard, importedDatasets: snapshot.dashboard.importedDatasets.map(encodeImportedRows) }
    }))
  };
}

function isStorageQuotaError(error: unknown) {
  return error instanceof DOMException && (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED");
}

export function writeDashboardWorkspaceVersion(workspace: DashboardWorkspace): { version: string } | false {
  const compactWorkspace = compactWorkspaceForStorage(workspace);
  try {
    const version = JSON.stringify(compactWorkspace);
    window.localStorage.setItem(workspaceStorageKey, version);
    return { version };
  } catch (error) {
    // The payload is already compact. Retrying the identical write cannot make
    // quota available and must never silently discard respondent data.
    console.warn(isStorageQuotaError(error)
      ? "Unable to save InsightCanvas workspace because local browser storage is full."
      : "Unable to save InsightCanvas workspace.", error);
    return false;
  }
}

export function saveDashboardWorkspace(workspace: DashboardWorkspace) {
  return writeDashboardWorkspaceVersion(workspace) !== false;
}

export function upsertWorkspaceImportedDataset(workspace: DashboardWorkspace, dataset: ImportedDatasetRecord): DashboardWorkspace {
  return {
    ...workspace,
    importedDatasets: mergeImportedDatasets(workspace.importedDatasets, [dataset])
  };
}

export function removeWorkspaceImportedDataset(workspace: DashboardWorkspace, datasetId: string): DashboardWorkspace {
  const blocker = importedStudyRemovalBlocker(workspace, datasetId);
  if (blocker) throw new Error(blocker);
  return {
    ...workspace,
    importedDatasets: workspace.importedDatasets.filter((dataset) => dataset.id !== datasetId),
    // Remove unused embedded draft copies too, or normalization resurrects the
    // removed library entry on save/reopen. Snapshot copies remain historical.
    reports: workspace.reports.map(report => ({ ...report, draft: { ...report.draft,
      importedDatasets: report.draft.importedDatasets.filter(dataset => dataset.id !== datasetId),
    } })),
  };
}

export function upsertWorkspaceDatasetConnection(workspace: DashboardWorkspace, connection: DatasetConnectionProfile): DashboardWorkspace {
  const connections = workspace.datasetConnections ?? [];
  return {
    ...workspace,
    datasetConnections: [
      connection,
      ...connections.filter((item) => item.id !== connection.id && item.provider !== connection.provider)
    ]
  };
}

export function removeWorkspaceDatasetConnection(workspace: DashboardWorkspace, connectionId: string): DashboardWorkspace {
  return {
    ...workspace,
    datasetConnections: (workspace.datasetConnections ?? []).filter((connection) => connection.id !== connectionId),
    liveDatasetSources: (workspace.liveDatasetSources ?? []).filter((source) => source.connectionId !== connectionId)
  };
}

export function upsertWorkspaceLiveDatasetSource(workspace: DashboardWorkspace, source: LiveDatasetSourceDescriptor): DashboardWorkspace {
  const liveDatasetSources = workspace.liveDatasetSources ?? [];
  return {
    ...workspace,
    liveDatasetSources: [
      source,
      ...liveDatasetSources.filter((item) => item.sourceRef.id !== source.sourceRef.id)
    ]
  };
}

export function removeWorkspaceLiveDatasetSource(workspace: DashboardWorkspace, sourceRefId: string): DashboardWorkspace {
  return {
    ...workspace,
    liveDatasetSources: (workspace.liveDatasetSources ?? []).filter((source) => source.sourceRef.id !== sourceRefId)
  };
}

export function updateWorkspaceLiveDatasetSourceInspection(
  workspace: DashboardWorkspace,
  report: LiveDatasetSourceInspectionReport
): DashboardWorkspace {
  return {
    ...workspace,
    liveDatasetSources: (workspace.liveDatasetSources ?? []).map((source) =>
      source.sourceRef.id === report.sourceRefId
        ? {
            ...source,
            objectPath: report.objectPath,
            objectType: report.objectType,
            fieldCount: report.fields.length || source.fieldCount,
            statusLabel: report.statusLabel,
            sourceRef: {
              ...source.sourceRef,
              objectPath: report.objectPath
            },
            inspection: {
              status: report.status,
              statusLabel: report.statusLabel,
              inspectedAt: report.inspectedAt,
              fields: report.fields,
              diagnostics: report.diagnostics,
              nextStep: report.nextStep
            }
          }
        : source
    )
  };
}

export function updateWorkspaceLiveDatasetSourceFields(
  workspace: DashboardWorkspace,
  sourceRefId: string,
  fields: LiveDatasetFieldDescriptor[]
): DashboardWorkspace {
  return {
    ...workspace,
    liveDatasetSources: (workspace.liveDatasetSources ?? []).map((source) =>
      source.sourceRef.id === sourceRefId
        ? {
            ...source,
            fieldCount: fields.length || source.fieldCount,
            inspection: source.inspection
              ? {
                  ...source.inspection,
                  fields,
                  nextStep: "Field roles are modeled. Build the live query definition contract before creating live tables or charts."
                }
              : source.inspection
          }
        : source
    )
  };
}

export function upsertWorkspaceLiveDatasetQueryDefinition(
  workspace: DashboardWorkspace,
  sourceRefId: string,
  definition: LiveDatasetQueryDefinition
): DashboardWorkspace {
  return {
    ...workspace,
    liveDatasetSources: (workspace.liveDatasetSources ?? []).map((source) => {
      if (source.sourceRef.id !== sourceRefId) return source;
      const existing = source.queryDefinitions ?? [];
      return {
        ...source,
        queryDefinitions: existing.some((item) => item.id === definition.id)
          ? existing.map((item) => item.id === definition.id ? definition : item)
          : [definition, ...existing]
      };
    })
  };
}

export function removeWorkspaceLiveDatasetQueryDefinition(
  workspace: DashboardWorkspace,
  sourceRefId: string,
  definitionId: string
): DashboardWorkspace {
  return {
    ...workspace,
    liveDatasetSources: (workspace.liveDatasetSources ?? []).map((source) =>
      source.sourceRef.id === sourceRefId
        ? {
            ...source,
            queryDefinitions: (source.queryDefinitions ?? []).filter((definition) => definition.id !== definitionId)
          }
        : source
    )
  };
}

function connectionStatusFromVerification(report: DatasetConnectionVerificationReport): DatasetConnectionProfile["status"] {
  if (report.status === "verified") return "sync_ready";
  if (report.status === "ready_to_verify") return "configured";
  return "setup_scaffold";
}

export function updateWorkspaceDatasetConnectionVerification(
  workspace: DashboardWorkspace,
  report: DatasetConnectionVerificationReport
): DashboardWorkspace {
  const connections = workspace.datasetConnections ?? [];
  return {
    ...workspace,
    datasetConnections: connections.map((connection) =>
      connection.provider === report.provider && (!report.connectionId || connection.id === report.connectionId)
        ? {
            ...connection,
            status: connectionStatusFromVerification(report),
            statusLabel: report.statusLabel,
            verification: {
              status: report.status,
              statusLabel: report.statusLabel,
              checkedAt: report.checkedAt,
              diagnostics: report.diagnostics,
              nextStep: report.nextStep
            },
            updatedAt: report.checkedAt
          }
        : connection
    )
  };
}

export function updateWorkspaceImportedDatasetField(
  workspace: DashboardWorkspace,
  datasetId: string,
  fieldId: string,
  updates: Partial<Pick<ImportedDatasetField, "label" | "type" | "modelingRole" | "eligibleForFilter" | "eligibleForSegment" | "eligibleForBanner">>
): DashboardWorkspace {
  return {
    ...workspace,
    importedDatasets: workspace.importedDatasets.map((dataset) =>
      dataset.id === datasetId
        ? {
            ...dataset,
            fields: dataset.fields.map((field, index) =>
              field.id === fieldId ? normalizeImportedDatasetField({ ...field, ...updates }, index) : field
            )
          }
        : dataset
    )
  };
}

export function findReport(workspace: DashboardWorkspace, reportId: string | null | undefined) {
  return workspace.reports.find((report) => report.id === reportId) ?? null;
}

export function findPublishedSnapshot(
  workspace: DashboardWorkspace,
  reportId: string | null | undefined,
  snapshotId: string | null | undefined
) {
  const reportSnapshots = workspace.publishedSnapshots
    .filter((snapshot) => snapshot.reportId === reportId)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  if (snapshotId) return reportSnapshots.find((snapshot) => snapshot.id === snapshotId) ?? null;
  return reportSnapshots[0] ?? null;
}

export function upsertDraftReport(workspace: DashboardWorkspace, dashboard: DashboardDraft, reportId = dashboard.id): DashboardWorkspace {
  const timestamp = nowIso();
  const normalizedDashboard = normalizeDashboard({ ...dashboard, id: reportId });
  const reports = workspace.reports.map((report) =>
    report.id === reportId
      ? {
          ...report,
          title: normalizedDashboard.title,
          draft: normalizedDashboard,
          updatedAt: timestamp
        }
      : report
  );

  if (!reports.some((report) => report.id === reportId)) {
    reports.push(createReportRecord(normalizedDashboard, timestamp));
  }

  return {
    ...workspace,
    activeReportId: reportId,
    reports
  };
}

export function markReportOpened(workspace: DashboardWorkspace, reportId: string): DashboardWorkspace {
  const timestamp = nowIso();
  return {
    ...workspace,
    activeReportId: reportId,
    reports: workspace.reports.map((report) =>
      report.id === reportId
        ? { ...report, lastOpenedAt: timestamp }
        : report
    )
  };
}

export function createNewReportFromSeed(workspace: DashboardWorkspace): { workspace: DashboardWorkspace; report: DashboardReportRecord } {
  const timestamp = nowIso();
  const id = makeId("report");
  const draft = normalizeDashboard({
    ...cloneDashboard(initialDashboard),
    id,
    title: `Untitled report ${workspace.reports.length + 1}`,
    pages: [{...cloneDashboard(initialDashboard).pages[0],id:"page_overview",title:"Untitled page",elements:[],tiles:[],background:"#ffffff"}],
    status: "draft",
    publishMetadata: {
      publishCount: 0,
      versionLabel: "Draft"
    }
  });
  const report = createReportRecord(draft, timestamp);

  return {
    report,
    workspace: {
      ...workspace,
      activeReportId: report.id,
      reports: [report, ...workspace.reports]
    }
  };
}

export function createExampleReport(workspace: DashboardWorkspace) {
  const id = makeId("example");
  const report = createReportRecord({...cloneDashboard(initialDashboard),id});
  return {report,workspace:{...workspace,activeReportId:id,reports:[report,...workspace.reports]}};
}

export function duplicateReportRecord(workspace: DashboardWorkspace, sourceReport: DashboardReportRecord): { workspace: DashboardWorkspace; report: DashboardReportRecord } {
  const timestamp = nowIso();
  const id = makeId("report");
  const draft = normalizeDashboard({
    ...cloneDashboard(sourceReport.draft),
    id,
    title: `${sourceReport.title} copy`,
    status: "draft",
    publishMetadata: {
      publishCount: 0,
      versionLabel: "Draft"
    }
  });
  const report = createReportRecord(draft, timestamp);

  return {
    report,
    workspace: {
      ...workspace,
      activeReportId: report.id,
      reports: [report, ...workspace.reports]
    }
  };
}

export function createPublishedSnapshot(
  workspace: DashboardWorkspace,
  dashboard: DashboardDraft
): { workspace: DashboardWorkspace; dashboard: DashboardDraft; snapshot: PublishedDashboardSnapshot } {
  const publishedAt = nowIso();
  const publishCount = dashboard.publishMetadata.publishCount + 1;
  const versionLabel = `v${publishCount}`;
  const snapshotId = makeId("snapshot");
  const viewerPath = makePublishedViewerPath(dashboard.id, snapshotId);
  const referencedStudies = new Set(draftImportedStudyReferences(dashboard).map(reference => reference.datasetId));
  const publishedDashboard = normalizeDashboard({
    ...cloneDashboard({
      ...dashboard,
      // Reopened drafts store their studies at workspace level. Capture the
      // same current studies used by the editor before making an immutable copy.
      importedDatasets: mergeImportedDatasets(dashboard.importedDatasets, workspace.importedDatasets.filter((study) =>
        referencedStudies.has(study.id) || dashboard.importedDatasets.some((attached) => attached.id === study.id)))
    }),
    status: "published",
    publishMetadata: {
      ...dashboard.publishMetadata,
      publishedAt,
      publishCount,
      versionLabel,
      publishedSnapshotId: snapshotId,
      viewerPath
    }
  });
  const snapshot: PublishedDashboardSnapshot = {
    id: snapshotId,
    reportId: dashboard.id,
    title: publishedDashboard.title,
    versionLabel,
    publishedAt,
    viewerPath,
    dashboard: publishedDashboard
  };
  const snapshots = [
    snapshot,
    ...workspace.publishedSnapshots.filter((item) => item.id !== snapshotId)
  ];

  return {
    dashboard: publishedDashboard,
    snapshot,
    workspace: upsertDraftReport({ ...workspace, publishedSnapshots: snapshots }, publishedDashboard, dashboard.id)
  };
}
