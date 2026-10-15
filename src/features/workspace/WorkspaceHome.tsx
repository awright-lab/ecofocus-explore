import {
  ArrowRight,
  Atom,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Database,
  FileText,
  FolderOpen,
  Leaf,
  Plus,
  Search,
  Upload,
  X,
} from "lucide-react";
import { DocumentPreview } from "../document/DocumentPreview";
import { StudioHelp } from "../builder/components/StudioTools";
import { useRef, useState, type ReactNode } from "react";
import type {
  DashboardReportRecord,
  DashboardWorkspace,
  PublishedDashboardSnapshot,
} from "../../../shared/types/dashboard";
import type {
  DatasetConnectionProfile,
  DatasetConnectionVerificationReport,
  LiveDatasetFieldDescriptor,
  LiveDatasetQueryExecutionReport,
  LiveDatasetSourceDescriptor,
  LiveDatasetSourceInspectionReport,
} from "../../../shared/types/dataSource";
import {
  importedDatasetImportFeedback,
  importDatasetForWorkspace,
} from "../data/importDatasetWorkspaceService";
import {
  buildImportedDatasetStructureSummary,
  importedFieldTypeLabel,
} from "../data/datasetModelingModel";
import {
  buildDatasetConnectionProfiles,
  buildLiveDatasetSourceDescriptorForConnection,
  datasetConnectionOption,
  datasetConnectionOptions,
} from "../data/datasetConnectionModel";
import {
  applySuggestedLiveDatasetFieldModeling,
  buildLiveDatasetFieldModelingView,
  buildLiveDatasetSourceFieldModelingSummary,
  liveDatasetFieldRoleOptions,
  updateLiveDatasetFieldModeling,
  type LiveDatasetFieldModelingUpdate,
} from "../data/liveDatasetFieldModel";
import {
  buildLiveDatasetQueryDefinitionDraft,
  buildLiveDatasetQueryDefinitionReadiness,
  createLiveDatasetQueryDefinition,
  liveDatasetQueryDefinitionSummary,
} from "../data/liveDatasetQueryDefinitionModel";
import { buildLiveDatasetSourceReadinessView } from "../data/liveDatasetSourceModel";
import {
  createNewReportFromSeed,
  createExampleReport,
  duplicateReportRecord,
  findPublishedSnapshot,
  makeBuilderReportPath,
  makePublishedViewerPath,
  markReportOpened,
  removeWorkspaceDatasetConnection,
  removeWorkspaceLiveDatasetSource,
  saveDashboardWorkspace,
  updateWorkspaceDatasetConnectionVerification,
  updateWorkspaceLiveDatasetSourceInspection,
  updateWorkspaceLiveDatasetSourceFields,
  removeWorkspaceLiveDatasetQueryDefinition,
  upsertWorkspaceLiveDatasetQueryDefinition,
  upsertWorkspaceLiveDatasetSource,
  upsertWorkspaceDatasetConnection,
  upsertWorkspaceImportedDataset,
} from "../document/workspacePersistence";

type ReportLibraryState = "draft" | "published" | "changed";
type HomeIconName =
  | "brand"
  | "plus"
  | "copy"
  | "open"
  | "published"
  | "draft"
  | "clock"
  | "deck"
  | "dataset"
  | "field"
  | "insight"
  | "story"
  | "deliverable"
  | "spark";

interface ReportLibraryItem {
  report: DashboardReportRecord;
  latestSnapshot: PublishedDashboardSnapshot | null;
  state: ReportLibraryState;
  stateLabel: string;
  stateHelper: string;
  updatedLabel: string;
  openedLabel: string;
  pageCount: number;
  tileCount: number;
  versionLabel: string;
}

function HomeIcon({ icon }: { icon: HomeIconName }) {
  const paths: Record<HomeIconName, ReactNode> = {
    brand: (
      <>
        <path d="M8.5 6.5 4.8 17a2.2 2.2 0 0 0 3.4 2.4l3.8-3.1" />
        <path d="m15.5 6.5 3.7 10.5a2.2 2.2 0 0 1-3.4 2.4L12 16.3" />
        <circle cx="12" cy="8" r="3.2" />
        <path d="M9.8 10.4 7.2 17.2M14.2 10.4l2.6 6.8" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14M5 12h14" />
      </>
    ),
    copy: (
      <>
        <rect x="8" y="8" width="10" height="10" rx="2" />
        <path d="M6 14H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1" />
      </>
    ),
    open: (
      <>
        <path d="M7 17 17 7M10 7h7v7" />
        <rect x="4" y="4" width="16" height="16" rx="3" />
      </>
    ),
    published: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="m8.8 12.3 2.1 2.2 4.4-5" />
      </>
    ),
    draft: (
      <>
        <path d="M7 4h7l4 4v12H7z" />
        <path d="M14 4v5h5M9 14h6" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v4l3 2" />
      </>
    ),
    deck: (
      <>
        <rect x="4" y="5" width="16" height="12" rx="2" />
        <path d="M8 9h8M8 13h5M12 17v3" />
      </>
    ),
    dataset: (
      <>
        <ellipse cx="12" cy="6" rx="7" ry="3" />
        <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
        <path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
      </>
    ),
    field: (
      <>
        <path d="M5 19V9" />
        <path d="M12 19V5" />
        <path d="M19 19v-7" />
        <path d="M3.5 19h17" />
      </>
    ),
    insight: (
      <>
        <path d="M9 18h6" />
        <path d="M10 22h4" />
        <path d="M8.8 14.5a6 6 0 1 1 6.4 0c-.8.5-1.2 1.4-1.2 2.5h-4c0-1.1-.4-2-1.2-2.5Z" />
      </>
    ),
    story: (
      <>
        <path d="M5 5h14v14H5z" />
        <path d="M8 9h8M8 13h5M8 17h7" />
      </>
    ),
    deliverable: (
      <>
        <path d="M7 4h7l4 4v12H7z" />
        <path d="M14 4v5h5" />
        <path d="M10 14h5M10 17h4" />
      </>
    ),
    spark: (
      <>
        <path d="M12 3l1.8 5.1L19 10l-5.2 1.9L12 17l-1.8-5.1L5 10l5.2-1.9z" />
        <path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" />
      </>
    ),
  };

  return (
    <svg className="workspace-home-icon" viewBox="0 0 24 24" aria-hidden="true">
      <g
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      >
        {paths[icon]}
      </g>
    </svg>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function buildReportLibraryItem(
  workspace: DashboardWorkspace,
  report: DashboardReportRecord,
): ReportLibraryItem {
  const latestSnapshot = findPublishedSnapshot(
    workspace,
    report.id,
    report.draft.publishMetadata.publishedSnapshotId,
  );
  const hasPublishedVersion = Boolean(
    latestSnapshot || report.draft.publishMetadata.publishCount,
  );
  const state: ReportLibraryState = !hasPublishedVersion
    ? "draft"
    : report.draft.status === "published"
      ? "published"
      : "changed";
  const pageCount = report.draft.pages.length;
  const tileCount = report.draft.pages.reduce(
    (count, page) => count + page.tiles.length,
    0,
  );

  return {
    report,
    latestSnapshot,
    state,
    stateLabel:
      state === "draft"
        ? "Draft only"
        : state === "published"
          ? "Published"
          : "Draft changes",
    stateHelper:
      state === "draft"
        ? "No published snapshot yet."
        : state === "published"
          ? "Latest draft matches the current published build."
          : "Published snapshot exists, with newer local draft edits.",
    updatedLabel: formatDateTime(report.updatedAt),
    openedLabel: formatDateTime(report.lastOpenedAt),
    pageCount,
    tileCount,
    versionLabel:
      latestSnapshot?.versionLabel ??
      report.draft.publishMetadata.versionLabel ??
      "Draft",
  };
}

function isConnectionVerificationError(
  payload:
    | DatasetConnectionVerificationReport
    | { error?: string; details?: string[] },
): payload is { error?: string; details?: string[] } {
  return "error" in payload || !("status" in payload);
}

function isSourceInspectionError(
  payload:
    LiveDatasetSourceInspectionReport | { error?: string; details?: string[] },
): payload is { error?: string; details?: string[] } {
  return "error" in payload || !("status" in payload);
}

function isLiveQueryExecutionError(
  payload:
    LiveDatasetQueryExecutionReport | { error?: string; details?: string[] },
): payload is { error?: string; details?: string[] } {
  return "error" in payload || !("status" in payload);
}

export function WorkspaceHome({
  workspace,
  onWorkspaceChange,
}: {
  workspace: DashboardWorkspace;
  onWorkspaceChange: (workspace: DashboardWorkspace) => void;
}) {
  const [introductionExpanded, setIntroductionExpanded] = useState(false);
  const [homeSection, setHomeSection] = useState<"reports" | "data">("reports");
  const [search, setSearch] = useState("");
  const [reportFilter, setReportFilter] = useState<"all" | "published">("all");
  const [showHelp, setShowHelp] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importFeedback, setImportFeedback] = useState<{
    tone: "success" | "error";
    label: string;
  } | null>(null);
  const [showConnectionOptions, setShowConnectionOptions] = useState(false);
  const [selectedConnectionProvider, setSelectedConnectionProvider] =
    useState<DatasetConnectionProfile["provider"]>("snowflake");
  const [connectionVerification, setConnectionVerification] =
    useState<DatasetConnectionVerificationReport | null>(null);
  const [isVerifyingConnection, setIsVerifyingConnection] = useState(false);
  const [inspectingLiveSourceId, setInspectingLiveSourceId] = useState<
    string | null
  >(null);
  const [runningLiveDefinitionId, setRunningLiveDefinitionId] = useState<
    string | null
  >(null);
  const [liveDefinitionPreview, setLiveDefinitionPreview] =
    useState<LiveDatasetQueryExecutionReport | null>(null);
  const [editingLiveSourceId, setEditingLiveSourceId] = useState<string | null>(
    null,
  );
  const [liveSourceDraft, setLiveSourceDraft] = useState({
    label: "",
    objectPath: "",
    objectType: "table" as LiveDatasetSourceDescriptor["objectType"],
    syncMode: "live_query" as LiveDatasetSourceDescriptor["syncMode"],
    rowCountEstimate: "",
    fieldCount: "",
  });
  const reports = workspace.reports
    .filter((report) => !report.archived)
    .map((report) => buildReportLibraryItem(workspace, report))
    .sort(
      (a, b) =>
        new Date(b.report.updatedAt).getTime() -
        new Date(a.report.updatedAt).getTime(),
    );
  const publishedCount = reports.filter(
    (item) => item.state === "published" || item.state === "changed",
  ).length;
  const draftOnlyCount = reports.filter(
    (item) => item.state === "draft",
  ).length;
  const recentReports = reports.slice(0, 3);
  const importedDatasets = [...(workspace.importedDatasets ?? [])].sort(
    (a, b) =>
      new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime(),
  );
  const latestReport = reports[0] ?? null;
  const hasWorkspaceActivity =
    importedDatasets.length > 0 ||
    reports.some(
      (item) =>
        item.report.id !== "internal_mvp" ||
        item.report.lastOpenedAt !== item.report.createdAt ||
        item.report.draft.publishMetadata.publishCount > 0,
    );
  const compactHome =
    homeSection === "data" || (hasWorkspaceActivity && !introductionExpanded);
  const usableDatasets = importedDatasets.filter(
    (dataset) => dataset.rowCount > 0,
  );
  const metadataRichDatasets = importedDatasets.filter(
    (dataset) => dataset.importMetadata?.metadataQuality === "metadata_rich",
  );
  const savedDatasetConnections = workspace.datasetConnections ?? [];
  const liveDatasetSources = workspace.liveDatasetSources ?? [];
  const connectionProfileOptions = buildDatasetConnectionProfiles();
  const selectedConnectionOption = datasetConnectionOption(
    selectedConnectionProvider,
  );
  const selectedConnectionProfile = savedDatasetConnections.find(
    (item) => item.provider === selectedConnectionProvider,
  );
  const availableConnectionCount =
    datasetConnectionOptions.length - savedDatasetConnections.length;
  const visibleReports = reports.filter(
    (item) =>
      item.report.title.toLowerCase().includes(search.toLowerCase()) &&
      (reportFilter === "all" || item.latestSnapshot),
  );
  function openExample() {
    const example = reports.find((item) =>
      item.report.draft.pages.some((page) =>
        page.tiles.some((tile) => tile.id === "sample_priorities"),
      ),
    );
    if (example) {
      openReport(example.report.id);
      return;
    }
    const next = createExampleReport(workspace);
    onWorkspaceChange(next.workspace);
    saveDashboardWorkspace(next.workspace);
    navigate(makeBuilderReportPath(next.report.id));
  }

  function navigate(path: string) {
    window.location.hash = path.replace(/^#/, "");
  }

  function openReport(reportId: string) {
    const nextWorkspace = markReportOpened(workspace, reportId);
    onWorkspaceChange(nextWorkspace);
    saveDashboardWorkspace(nextWorkspace);
    navigate(makeBuilderReportPath(reportId));
  }

  function createReport() {
    const next = createNewReportFromSeed(workspace);
    onWorkspaceChange(next.workspace);
    saveDashboardWorkspace(next.workspace);
    navigate(makeBuilderReportPath(next.report.id));
  }

  function duplicateReport(report: DashboardReportRecord) {
    const next = duplicateReportRecord(workspace, report);
    onWorkspaceChange(next.workspace);
    saveDashboardWorkspace(next.workspace);
    navigate(makeBuilderReportPath(next.report.id));
  }

  function openPublished(item: ReportLibraryItem) {
    const snapshot = item.latestSnapshot;
    if (!snapshot) return;
    navigate(makePublishedViewerPath(snapshot.reportId, snapshot.id));
  }

  async function handleImportFile(file: File | undefined) {
    if (!file) return;
    setIsImporting(true);
    setImportFeedback(null);
    try {
      const result = await importDatasetForWorkspace(file);
      if (result.error || !result.dataset) {
        setImportFeedback({
          tone: "error",
          label: result.error ?? "Dataset import failed.",
        });
        return;
      }
      const nextWorkspace = upsertWorkspaceImportedDataset(
        workspace,
        result.dataset,
      );
      onWorkspaceChange(nextWorkspace);
      saveDashboardWorkspace(nextWorkspace);
      setImportFeedback({
        tone: "success",
        label: importedDatasetImportFeedback(
          result.dataset,
          result.storage.warning,
        ),
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function planConnection(
    provider: (typeof datasetConnectionOptions)[number]["provider"],
  ) {
    const profile = connectionProfileOptions.find(
      (item) => item.provider === provider,
    );
    if (!profile) return;
    const nextWorkspace = upsertWorkspaceDatasetConnection(workspace, {
      ...profile,
      updatedAt: new Date().toISOString(),
    });
    onWorkspaceChange(nextWorkspace);
    saveDashboardWorkspace(nextWorkspace);
    setShowConnectionOptions(true);
    setSelectedConnectionProvider(provider);
    setImportFeedback({
      tone: "success",
      label: `${profile.label} setup is saved as a planned source. Credentials and live sync come in the next connection pass.`,
    });
  }

  async function verifySelectedConnection() {
    setIsVerifyingConnection(true);
    setConnectionVerification(null);
    try {
      const response = await fetch(
        "/.netlify/functions/dataset-connection-verify",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: selectedConnectionProvider,
            connectionId: selectedConnectionProfile?.id,
          }),
        },
      );
      const payload = (await response.json()) as
        | DatasetConnectionVerificationReport
        | { error?: string; details?: string[] };
      if (!response.ok) {
        const errorPayload = isConnectionVerificationError(payload)
          ? payload
          : {};
        const failureReport: DatasetConnectionVerificationReport = {
          provider: selectedConnectionProvider,
          connectionId: selectedConnectionProfile?.id,
          status: "failed",
          statusLabel: errorPayload.error ?? "Verification failed",
          checkedAt: new Date().toISOString(),
          diagnostics: errorPayload.details ?? [
            "The server readiness check failed.",
          ],
          nextStep:
            "Check Netlify function logs and server environment variables.",
        };
        setConnectionVerification(failureReport);
        if (selectedConnectionProfile) {
          const nextWorkspace = updateWorkspaceDatasetConnectionVerification(
            workspace,
            failureReport,
          );
          onWorkspaceChange(nextWorkspace);
          saveDashboardWorkspace(nextWorkspace);
        }
        return;
      }
      if (isConnectionVerificationError(payload)) return;
      setConnectionVerification(payload);
      if (selectedConnectionProfile) {
        const nextWorkspace = updateWorkspaceDatasetConnectionVerification(
          workspace,
          payload,
        );
        onWorkspaceChange(nextWorkspace);
        saveDashboardWorkspace(nextWorkspace);
      }
    } catch (error) {
      const failureReport: DatasetConnectionVerificationReport = {
        provider: selectedConnectionProvider,
        connectionId: selectedConnectionProfile?.id,
        status: "failed",
        statusLabel: "Verification unavailable",
        checkedAt: new Date().toISOString(),
        diagnostics: [
          error instanceof Error
            ? error.message
            : "The server readiness check could not be reached.",
        ],
        nextStep:
          "Run the app through Netlify Dev or deploy the verification function before checking readiness.",
      };
      setConnectionVerification(failureReport);
      if (selectedConnectionProfile) {
        const nextWorkspace = updateWorkspaceDatasetConnectionVerification(
          workspace,
          failureReport,
        );
        onWorkspaceChange(nextWorkspace);
        saveDashboardWorkspace(nextWorkspace);
      }
    } finally {
      setIsVerifyingConnection(false);
    }
  }

  function removeConnectionPlan(connection: DatasetConnectionProfile) {
    const shouldRemove = window.confirm(
      `Remove the planned ${connection.label} connection? This only removes the setup plan; no data or credentials will be affected.`,
    );
    if (!shouldRemove) return;
    const nextWorkspace = removeWorkspaceDatasetConnection(
      workspace,
      connection.id,
    );
    onWorkspaceChange(nextWorkspace);
    saveDashboardWorkspace(nextWorkspace);
    setImportFeedback({
      tone: "success",
      label: `${connection.label} setup plan removed.`,
    });
  }

  function registerLiveSource(connection: DatasetConnectionProfile) {
    const source = buildLiveDatasetSourceDescriptorForConnection(connection);
    const nextWorkspace = upsertWorkspaceLiveDatasetSource(workspace, source);
    onWorkspaceChange(nextWorkspace);
    saveDashboardWorkspace(nextWorkspace);
    setImportFeedback({
      tone:
        source.status === "available" || source.status === "needs_verification"
          ? "success"
          : "error",
      label:
        source.status === "available"
          ? `${source.label} is registered as a live dataset source.`
          : `${source.label} is registered, but ${source.statusLabel.toLowerCase()}.`,
    });
  }

  function removeLiveSource(source: LiveDatasetSourceDescriptor) {
    const shouldRemove = window.confirm(
      `Remove "${source.label}" from managed sources? This only removes the source descriptor; the connection setup plan stays saved.`,
    );
    if (!shouldRemove) return;
    const nextWorkspace = removeWorkspaceLiveDatasetSource(
      workspace,
      source.sourceRef.id,
    );
    onWorkspaceChange(nextWorkspace);
    saveDashboardWorkspace(nextWorkspace);
    setImportFeedback({
      tone: "success",
      label: `${source.label} removed from managed sources.`,
    });
  }

  async function inspectLiveSource(source: LiveDatasetSourceDescriptor) {
    setInspectingLiveSourceId(source.sourceRef.id);
    setImportFeedback(null);
    try {
      const response = await fetch(
        "/.netlify/functions/dataset-source-inspect",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: source.sourceRef.provider,
            connectionId: source.connectionId,
            sourceRefId: source.sourceRef.id,
            objectPath: source.objectPath,
            objectType: source.objectType,
            limit: 200,
          }),
        },
      );
      const payload = (await response.json()) as
        | LiveDatasetSourceInspectionReport
        | { error?: string; details?: string[] };
      const report: LiveDatasetSourceInspectionReport =
        !response.ok || isSourceInspectionError(payload)
          ? {
              provider: source.sourceRef
                .provider as DatasetConnectionProfile["provider"],
              connectionId: source.connectionId,
              sourceRefId: source.sourceRef.id,
              objectPath: source.objectPath,
              objectType: source.objectType,
              status: "failed",
              statusLabel: isSourceInspectionError(payload)
                ? (payload.error ?? "Inspection failed")
                : "Inspection failed",
              inspectedAt: new Date().toISOString(),
              fields: [],
              diagnostics: isSourceInspectionError(payload)
                ? (payload.details ?? ["The source inspection failed."])
                : ["The source inspection failed."],
              nextStep:
                "Check Netlify function logs, server credentials, and the mapped source path.",
            }
          : payload;

      const nextWorkspace = updateWorkspaceLiveDatasetSourceInspection(
        workspace,
        report,
      );
      onWorkspaceChange(nextWorkspace);
      saveDashboardWorkspace(nextWorkspace);
      setImportFeedback({
        tone: report.status === "inspected" ? "success" : "error",
        label:
          report.status === "inspected"
            ? `${source.label} inspected with ${report.fields.length.toLocaleString()} fields.`
            : `${source.label}: ${report.statusLabel.toLowerCase()}.`,
      });
    } catch (error) {
      const failureReport: LiveDatasetSourceInspectionReport = {
        provider: source.sourceRef
          .provider as DatasetConnectionProfile["provider"],
        connectionId: source.connectionId,
        sourceRefId: source.sourceRef.id,
        objectPath: source.objectPath,
        objectType: source.objectType,
        status: "failed",
        statusLabel: "Inspection unavailable",
        inspectedAt: new Date().toISOString(),
        fields: [],
        diagnostics: [
          error instanceof Error
            ? error.message
            : "The source inspection function could not be reached.",
        ],
        nextStep:
          "Run through Netlify Dev or deploy the inspection function before checking source fields.",
      };
      const nextWorkspace = updateWorkspaceLiveDatasetSourceInspection(
        workspace,
        failureReport,
      );
      onWorkspaceChange(nextWorkspace);
      saveDashboardWorkspace(nextWorkspace);
      setImportFeedback({
        tone: "error",
        label: `${source.label}: inspection unavailable.`,
      });
    } finally {
      setInspectingLiveSourceId(null);
    }
  }

  function startEditingLiveSource(source: LiveDatasetSourceDescriptor) {
    setEditingLiveSourceId(source.sourceRef.id);
    setLiveSourceDraft({
      label: source.label,
      objectPath: source.objectPath,
      objectType: source.objectType,
      syncMode: source.syncMode,
      rowCountEstimate: source.rowCountEstimate?.toString() ?? "",
      fieldCount: source.fieldCount?.toString() ?? "",
    });
  }

  function liveSourceDraftNumber(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) && parsed >= 0
      ? Math.round(parsed)
      : undefined;
  }

  function saveLiveSourceMapping(source: LiveDatasetSourceDescriptor) {
    const label = liveSourceDraft.label.trim() || source.label;
    const objectPath = liveSourceDraft.objectPath.trim() || source.objectPath;
    const updated: LiveDatasetSourceDescriptor = {
      ...source,
      label,
      objectPath,
      objectType: liveSourceDraft.objectType,
      syncMode: liveSourceDraft.syncMode,
      rowCountEstimate: liveSourceDraftNumber(liveSourceDraft.rowCountEstimate),
      fieldCount: liveSourceDraftNumber(liveSourceDraft.fieldCount),
      sourceRef: {
        ...source.sourceRef,
        label,
        objectPath,
      },
    };
    const nextWorkspace = upsertWorkspaceLiveDatasetSource(workspace, updated);
    onWorkspaceChange(nextWorkspace);
    saveDashboardWorkspace(nextWorkspace);
    setEditingLiveSourceId(null);
    setImportFeedback({ tone: "success", label: `${label} mapping saved.` });
  }

  function updateLiveSourceFields(
    source: LiveDatasetSourceDescriptor,
    fields: LiveDatasetFieldDescriptor[] | undefined,
  ) {
    if (!fields) return;
    const nextWorkspace = updateWorkspaceLiveDatasetSourceFields(
      workspace,
      source.sourceRef.id,
      fields,
    );
    onWorkspaceChange(nextWorkspace);
    saveDashboardWorkspace(nextWorkspace);
  }

  function applyLiveSourceSuggestedRoles(source: LiveDatasetSourceDescriptor) {
    const fields = source.inspection?.fields;
    if (!fields?.length) return;
    updateLiveSourceFields(
      source,
      applySuggestedLiveDatasetFieldModeling(fields),
    );
    setImportFeedback({
      tone: "success",
      label: `${source.label}: suggested field roles applied.`,
    });
  }

  function updateLiveSourceFieldRole(
    source: LiveDatasetSourceDescriptor,
    fieldId: string,
    update: LiveDatasetFieldModelingUpdate,
  ) {
    const fields = source.inspection?.fields;
    if (!fields?.length) return;
    updateLiveSourceFields(
      source,
      updateLiveDatasetFieldModeling(fields, fieldId, update),
    );
  }

  function saveLiveSourceQueryDefinition(source: LiveDatasetSourceDescriptor) {
    const definition = createLiveDatasetQueryDefinition(source);
    if (!definition) {
      setImportFeedback({
        tone: "error",
        label: `${source.label}: model at least one group field before saving a live query definition.`,
      });
      return;
    }
    const nextWorkspace = upsertWorkspaceLiveDatasetQueryDefinition(
      workspace,
      source.sourceRef.id,
      definition,
    );
    onWorkspaceChange(nextWorkspace);
    saveDashboardWorkspace(nextWorkspace);
    setImportFeedback({
      tone: "success",
      label: `${definition.label} saved as a live query definition.`,
    });
  }

  function deleteLiveSourceQueryDefinition(
    source: LiveDatasetSourceDescriptor,
    definitionId: string,
  ) {
    const nextWorkspace = removeWorkspaceLiveDatasetQueryDefinition(
      workspace,
      source.sourceRef.id,
      definitionId,
    );
    onWorkspaceChange(nextWorkspace);
    saveDashboardWorkspace(nextWorkspace);
    setImportFeedback({
      tone: "success",
      label: `${source.label}: live query definition removed.`,
    });
  }

  async function runLiveSourceQueryDefinition(
    source: LiveDatasetSourceDescriptor,
    definitionId: string,
  ) {
    const definition = (source.queryDefinitions ?? []).find(
      (item) => item.id === definitionId,
    );
    if (!definition) return;
    setRunningLiveDefinitionId(definition.id);
    setLiveDefinitionPreview(null);
    setImportFeedback(null);
    try {
      const response = await fetch("/.netlify/functions/live-dataset-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          definition,
          limit: 50,
        }),
      });
      const payload = (await response.json()) as
        | LiveDatasetQueryExecutionReport
        | { error?: string; details?: string[] };
      const report: LiveDatasetQueryExecutionReport =
        !response.ok || isLiveQueryExecutionError(payload)
          ? {
              provider: source.sourceRef
                .provider as DatasetConnectionProfile["provider"],
              connectionId: source.connectionId,
              sourceRefId: source.sourceRef.id,
              definitionId: definition.id,
              status: "failed",
              statusLabel: isLiveQueryExecutionError(payload)
                ? (payload.error ?? "Live query failed")
                : "Live query failed",
              diagnostics: isLiveQueryExecutionError(payload)
                ? (payload.details ?? ["The live query failed."])
                : ["The live query failed."],
              nextStep:
                "Check Netlify function logs, server credentials, and the saved definition.",
              result: null,
            }
          : payload;

      setLiveDefinitionPreview(report);
      setImportFeedback({
        tone: report.status === "executed" ? "success" : "error",
        label:
          report.status === "executed"
            ? `${definition.label}: live preview returned ${report.result?.rowCount.toLocaleString() ?? "0"} groups.`
            : `${definition.label}: ${report.statusLabel.toLowerCase()}.`,
      });
    } catch (error) {
      setLiveDefinitionPreview({
        provider: source.sourceRef
          .provider as DatasetConnectionProfile["provider"],
        connectionId: source.connectionId,
        sourceRefId: source.sourceRef.id,
        definitionId: definition.id,
        status: "failed",
        statusLabel: "Live query unavailable",
        diagnostics: [
          error instanceof Error
            ? error.message
            : "The live query function could not be reached.",
        ],
        nextStep:
          "Run through Netlify Dev or deploy the live query function before previewing saved definitions.",
        result: null,
      });
      setImportFeedback({
        tone: "error",
        label: `${definition.label}: live query unavailable.`,
      });
    } finally {
      setRunningLiveDefinitionId(null);
    }
  }

  return (
    <main className="workspace-home-shell studio-home">
      <aside className="studio-home-nav" aria-label="Workspace navigation">
        <button
          type="button"
          className="studio-home-brand"
          onClick={() => setHomeSection("reports")}
        >
          <span>
            <Atom size={25} strokeWidth={1.4} />
          </span>
          <strong>
            InsightCanvas<small>Research, beautifully told.</small>
          </strong>
        </button>
        <span className="studio-nav-label">WORKSPACE</span>
        <button
          type="button"
          className={homeSection === "reports" ? "active" : ""}
          onClick={() => setHomeSection("reports")}
        >
          <FolderOpen size={18} />
          Your reports<span>{reports.length}</span>
        </button>
        <button
          type="button"
          className={homeSection === "data" ? "active" : ""}
          data-section="data"
          onClick={() => setHomeSection("data")}
        >
          <Database size={18} />
          Study library<span>{importedDatasets.length}</span>
        </button>
        <div className="studio-nav-divider" />
        <button type="button" onClick={openExample}>
          <Leaf size={18} />
          Explore an example
          <ChevronRight size={14} />
        </button>
        <button type="button" onClick={() => setShowHelp(true)}>
          <BookOpen size={18} />
          Getting started
        </button>
        <div className="studio-home-nav-note">
          <span className="studio-live-dot" />
          Local workspace<small>Saved on this browser</small>
        </div>
      </aside>
      <div className="studio-home-main">
        <header className="workspace-home-header">
          <div className="studio-breadcrumb">
            Workspace
            <ChevronRight size={14} />
            <strong>
              {homeSection === "reports" ? "Your reports" : "Study library"}
            </strong>
          </div>
          <div className="workspace-home-header__actions">
            <button
              type="button"
              className="workspace-home-secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
            >
              <Upload size={15} />
              {isImporting ? "Importing…" : "Import data"}
            </button>
            <button
              type="button"
              className={
                compactHome
                  ? "workspace-home-secondary"
                  : "workspace-home-primary"
              }
              onClick={createReport}
            >
              <Plus size={16} />
              New report
            </button>
          </div>
        </header>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.sav,text/csv"
          className="visually-hidden"
          onChange={(event) => void handleImportFile(event.target.files?.[0])}
        />
        {importFeedback && (
          <div
            className={`studio-import-toast ${importFeedback.tone}`}
            role="status"
          >
            <CheckCircle2 size={18} />
            <span>{importFeedback.label}</span>
            <button
              type="button"
              onClick={() => setImportFeedback(null)}
              aria-label="Dismiss import message"
            >
              <X size={16} />
            </button>
          </div>
        )}
        <section
          className={
            compactHome
              ? "workspace-home-hero studio-home-hero--compact"
              : "workspace-home-hero"
          }
          aria-label={
            compactHome ? "Workspace overview" : "Workspace introduction"
          }
        >
          <div>
            <p className="workspace-home-kicker">
              <span />
              THE INSIGHT WORKSPACE
            </p>
            <h1>
              {compactHome ? (
                homeSection === "reports" ? (
                  "Back to your research."
                ) : (
                  "Your study library."
                )
              ) : homeSection === "reports" ? (
                <>
                  Good research.
                  <br />
                  <em>Great stories.</em>
                </>
              ) : (
                <>
                  Your data.
                  <br />
                  <em>Ready for discovery.</em>
                </>
              )}
            </h1>
            <p>
              {compactHome
                ? homeSection === "reports" && latestReport
                  ? `Continue “${latestReport.report.title}” or start something new.`
                  : "Import a study, review your fields, and find your next insight."
                : homeSection === "reports"
                  ? "A space to explore the evidence, find the insight, and create something worth sharing."
                  : "Bring your studies together. Turn familiar fields into your next meaningful finding."}
            </p>
            <div className="studio-hero-actions">
              <button
                type="button"
                className="workspace-home-primary"
                onClick={
                  homeSection === "reports"
                    ? () =>
                        latestReport
                          ? openReport(latestReport.report.id)
                          : createReport()
                    : () => fileInputRef.current?.click()
                }
              >
                {homeSection === "reports"
                  ? latestReport
                    ? "Continue your work"
                    : "Create your first report"
                  : "Import a study"}
                <ArrowRight size={16} />
              </button>
              <button
                type="button"
                className="studio-text-button"
                onClick={openExample}
              >
                Explore an example
                <ArrowRight size={15} />
              </button>
              {hasWorkspaceActivity && homeSection === "reports" && (
                <button
                  type="button"
                  className="studio-home-view-toggle"
                  aria-expanded={introductionExpanded}
                  onClick={() => setIntroductionExpanded((current) => !current)}
                >
                  {introductionExpanded ? "Compact view" : "Show introduction"}
                </button>
              )}
            </div>
          </div>
          {compactHome ? (
            <div
              className="studio-workspace-summary"
              aria-label="Workspace summary"
            >
              <div>
                <FileText size={17} />
                <strong>{reports.length}</strong>
                <span>{reports.length === 1 ? "report" : "reports"}</span>
              </div>
              <div>
                <CheckCircle2 size={17} />
                <strong>{publishedCount}</strong>
                <span>published</span>
              </div>
              <div>
                <Database size={17} />
                <strong>{importedDatasets.length}</strong>
                <span>
                  {importedDatasets.length === 1 ? "study file" : "study files"}
                </span>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="studio-featured-example"
              onClick={openExample}
              aria-label="Explore the EcoFocus sample report"
            >
              <div className="studio-featured-label">
                <Leaf size={14} />
                MADE WITH INSIGHTCANVAS<span>SAMPLE STUDY</span>
              </div>
              <div className="studio-example-cover">
                <span>ECOFOCUS / 2025</span>
                <strong>
                  The sustainable
                  <br />
                  consumer.
                </strong>
                <div className="studio-cover-chart">
                  {[53, 50, 50, 49, 58].map((v, i) => (
                    <span key={i} style={{ height: `${v * 1.25}%` }} />
                  ))}
                </div>
                <small>From evidence to a clearer perspective.</small>
              </div>
              <div className="studio-featured-footer">
                <span>A little inspiration to get you started</span>
                <span className="studio-circle-arrow">
                  <ArrowRight size={17} />
                </span>
              </div>
            </button>
          )}
        </section>
        <section className="workspace-home-body">
          {homeSection === "reports" && (
            <section
              className="workspace-report-library"
              aria-label="Report library"
            >
              <div className="workspace-report-library__header">
                <div>
                  <h2>
                    Your reports{" "}
                    <span className="studio-count">{reports.length}</span>
                  </h2>
                  <p>Pick up where you left off.</p>
                </div>
                <label className="studio-report-search">
                  <Search size={17} />
                  <input
                    aria-label="Search reports"
                    placeholder="Search reports…"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      aria-label="Clear search"
                    >
                      <X size={14} />
                    </button>
                  )}
                </label>
              </div>
              <div
                className="studio-report-filters"
                aria-label="Filter reports"
              >
                <button
                  type="button"
                  className={reportFilter === "all" ? "active" : ""}
                  aria-pressed={reportFilter === "all"}
                  onClick={() => setReportFilter("all")}
                >
                  All reports
                </button>
                <button
                  type="button"
                  className={reportFilter === "published" ? "active" : ""}
                  aria-pressed={reportFilter === "published"}
                  onClick={() => setReportFilter("published")}
                >
                  Published<span>{publishedCount}</span>
                </button>
              </div>
              <div className="workspace-report-grid">
                {visibleReports.map((item) => (
                  <article
                    className={`workspace-report-card ${item.state}`}
                    key={item.report.id}
                  >
                    <button
                      type="button"
                      className="workspace-report-card__preview"
                      onClick={() => openReport(item.report.id)}
                      aria-label={`Open ${item.report.title}`}
                    >
                      <DocumentPreview page={item.report.draft.pages[0]} />
                      <span className="studio-preview-open">
                        Open report
                        <ArrowRight size={16} />
                      </span>
                    </button>
                    <div className="workspace-report-card__content">
                      <div className="workspace-report-card__title-row">
                        <h3>
                          <button
                            type="button"
                            onClick={() => openReport(item.report.id)}
                          >
                            {item.report.title}
                          </button>
                        </h3>
                        <span
                          className={`workspace-report-state ${item.state}`}
                        >
                          <HomeIcon
                            icon={
                              item.state === "draft" ? "draft" : "published"
                            }
                          />
                          {item.stateLabel}
                        </span>
                      </div>
                      <p>
                        {item.pageCount}{" "}
                        {item.pageCount === 1 ? "page" : "pages"} <span>·</span>{" "}
                        Updated {item.updatedLabel}
                      </p>
                      <div className="workspace-report-card__actions">
                        <button
                          type="button"
                          className="workspace-home-primary compact"
                          onClick={() => openReport(item.report.id)}
                        >
                          <HomeIcon icon="open" />
                          Open report
                        </button>
                        <button
                          type="button"
                          className="workspace-home-secondary compact"
                          onClick={() => duplicateReport(item.report)}
                        >
                          <HomeIcon icon="copy" />
                          Duplicate
                        </button>
                        <button
                          type="button"
                          className="workspace-home-secondary compact"
                          disabled={!item.latestSnapshot}
                          onClick={() => openPublished(item)}
                        >
                          <HomeIcon icon="published" />
                          Published view
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              {!visibleReports.length && (
                <div className="workspace-home-empty">
                  <HomeIcon icon="deck" />
                  <h2>
                    {search || reportFilter === "published"
                      ? "No matching reports"
                      : "A fresh canvas awaits"}
                  </h2>
                  <p>
                    Create a report, or explore the sample to see what’s
                    possible.
                  </p>
                  <button
                    type="button"
                    className="workspace-home-primary"
                    onClick={createReport}
                  >
                    Create report
                  </button>
                </div>
              )}
            </section>
          )}

          {homeSection === "data" && (
            <section
              className="workspace-dataset-library"
              aria-label="Imported dataset library"
            >
              <div className="workspace-report-library__header">
                <div>
                  <p className="workspace-home-kicker">Study Library</p>
                  <h2>Available datasets</h2>
                </div>
                <button
                  type="button"
                  className="workspace-home-secondary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <HomeIcon icon="plus" />
                  Import data
                </button>
                <button
                  type="button"
                  className="workspace-home-secondary"
                  onClick={() =>
                    setShowConnectionOptions((current) => !current)
                  }
                >
                  <HomeIcon icon="dataset" />
                  Connect database
                </button>
              </div>
              {showConnectionOptions && (
                <div
                  className="workspace-connection-grid"
                  aria-label="Database connection setup options"
                >
                  {datasetConnectionOptions.map((option) => {
                    const planned = savedDatasetConnections.find(
                      (item) => item.provider === option.provider,
                    );
                    return (
                      <article
                        className={
                          planned
                            ? "workspace-connection-card planned"
                            : "workspace-connection-card"
                        }
                        key={option.provider}
                      >
                        <div>
                          <span>
                            <HomeIcon icon="dataset" />
                          </span>
                          <strong>{option.label}</strong>
                        </div>
                        <p>{option.description}</p>
                        <small>
                          {option.bestFor} ·{" "}
                          {planned?.statusLabel ?? option.statusLabel}
                        </small>
                        <em>
                          {planned ? "Setup plan saved" : "Not planned yet"}
                        </em>
                        <button
                          type="button"
                          className="workspace-home-secondary compact"
                          onClick={() => {
                            setSelectedConnectionProvider(option.provider);
                            setConnectionVerification(null);
                            setShowConnectionOptions(true);
                          }}
                        >
                          {planned ? "View setup" : "View requirements"}
                        </button>
                      </article>
                    );
                  })}
                </div>
              )}
              {showConnectionOptions && (
                <aside
                  className="workspace-connection-detail"
                  aria-label={`${selectedConnectionOption.label} setup detail`}
                >
                  <div>
                    <p className="workspace-home-kicker">Connection Setup</p>
                    <h3>{selectedConnectionOption.label}</h3>
                    <span>
                      {selectedConnectionProfile
                        ? "Planned source"
                        : "Available connector"}
                    </span>
                  </div>
                  <p>{selectedConnectionOption.description}</p>
                  <div className="workspace-connection-readiness">
                    <strong>
                      {selectedConnectionProfile
                        ? selectedConnectionProfile.statusLabel
                        : "Not configured"}
                    </strong>
                    <span>
                      {selectedConnectionProfile
                        ? "This provider is saved as a setup plan. It is not connected until server-side credentials and verification are added."
                        : "Review the requirements, then save a setup plan when you are ready to configure this source later."}
                    </span>
                  </div>
                  <div className="workspace-connection-detail__columns">
                    <section>
                      <strong>Needed before live sync</strong>
                      <ul>
                        {selectedConnectionOption.setupRequirements.map(
                          (requirement) => (
                            <li key={requirement}>{requirement}</li>
                          ),
                        )}
                      </ul>
                    </section>
                    <section>
                      <strong>Current boundary</strong>
                      <p>{selectedConnectionOption.nextStep}</p>
                      <small>
                        No credentials are stored in the browser. Live
                        verification will run server-side when that adapter is
                        added.
                      </small>
                    </section>
                  </div>
                  <div className="workspace-connection-detail__actions">
                    <button
                      type="button"
                      className="workspace-home-primary compact"
                      onClick={() => planConnection(selectedConnectionProvider)}
                    >
                      {selectedConnectionProfile
                        ? "Setup plan saved"
                        : "Save setup plan"}
                    </button>
                    <button
                      type="button"
                      className="workspace-home-secondary compact"
                      onClick={() => void verifySelectedConnection()}
                      disabled={isVerifyingConnection}
                    >
                      {isVerifyingConnection
                        ? "Checking..."
                        : "Check server readiness"}
                    </button>
                  </div>
                  {connectionVerification && (
                    <section
                      className={`workspace-connection-verification ${connectionVerification.status}`}
                    >
                      <div>
                        <strong>{connectionVerification.statusLabel}</strong>
                        <small>
                          {formatDateTime(connectionVerification.checkedAt)}
                        </small>
                      </div>
                      <ul>
                        {connectionVerification.diagnostics.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                      <p>{connectionVerification.nextStep}</p>
                    </section>
                  )}
                </aside>
              )}
              {savedDatasetConnections.length > 0 && (
                <section
                  className="workspace-connection-plans"
                  aria-label="Planned database connections"
                >
                  <div className="workspace-connection-plans__header">
                    <div>
                      <p className="workspace-home-kicker">Planned Sources</p>
                      <h3>Database setup plans</h3>
                    </div>
                    <span>
                      {savedDatasetConnections.length} planned
                      {liveDatasetSources.length
                        ? ` · ${liveDatasetSources.length} live source${liveDatasetSources.length === 1 ? "" : "s"}`
                        : ""}
                      {availableConnectionCount > 0
                        ? ` · ${availableConnectionCount} available`
                        : ""}
                    </span>
                  </div>
                  <div className="workspace-connection-plan-list">
                    {savedDatasetConnections.map((connection) => {
                      const option = datasetConnectionOption(
                        connection.provider,
                      );
                      return (
                        <article
                          className="workspace-connection-plan-row"
                          key={connection.id}
                        >
                          <span>
                            <HomeIcon icon="dataset" />
                          </span>
                          <div>
                            <strong>{connection.label}</strong>
                            <small>
                              {connection.verification?.statusLabel ??
                                connection.statusLabel}{" "}
                              · {option.bestFor}
                            </small>
                            <em>
                              Waiting for server-side verification and
                              credential setup.
                            </em>
                          </div>
                          <button
                            type="button"
                            className="workspace-home-secondary compact"
                            onClick={() => {
                              setSelectedConnectionProvider(
                                connection.provider,
                              );
                              setConnectionVerification(null);
                              setShowConnectionOptions(true);
                            }}
                          >
                            View
                          </button>
                          <button
                            type="button"
                            className="workspace-home-secondary compact"
                            onClick={() => registerLiveSource(connection)}
                          >
                            Register source
                          </button>
                          <button
                            type="button"
                            className="workspace-home-secondary compact danger"
                            onClick={() => removeConnectionPlan(connection)}
                          >
                            Remove
                          </button>
                        </article>
                      );
                    })}
                  </div>
                </section>
              )}
              {liveDatasetSources.length > 0 && (
                <section
                  className="workspace-live-source-panel"
                  aria-label="Managed live dataset sources"
                >
                  <div className="workspace-connection-plans__header">
                    <div>
                      <p className="workspace-home-kicker">Managed Sources</p>
                      <h3>Connected source mappings</h3>
                    </div>
                    <span>{liveDatasetSources.length} registered</span>
                  </div>
                  <div className="workspace-live-source-list">
                    {liveDatasetSources.map((source) => {
                      const connection = savedDatasetConnections.find(
                        (item) => item.id === source.connectionId,
                      );
                      const isEditingSource =
                        editingLiveSourceId === source.sourceRef.id;
                      const isInspectingSource =
                        inspectingLiveSourceId === source.sourceRef.id;
                      const readiness =
                        buildLiveDatasetSourceReadinessView(source);
                      const inspectedFields = source.inspection?.fields ?? [];
                      const fieldModelingSummary =
                        buildLiveDatasetSourceFieldModelingSummary(source);
                      const queryDefinitionDraft =
                        buildLiveDatasetQueryDefinitionDraft(source);
                      const queryDefinitions = source.queryDefinitions ?? [];
                      return (
                        <article
                          className={`workspace-live-source-row ${source.status}`}
                          key={source.sourceRef.id}
                        >
                          <span>
                            <HomeIcon icon="dataset" />
                          </span>
                          <div>
                            <strong>{source.label}</strong>
                            <small>
                              {readiness.statusLabel} · {readiness.modeLabel} ·{" "}
                              {source.objectType}
                            </small>
                            <em>{source.objectPath}</em>
                            <b>{readiness.structureLabel}</b>
                            <ol
                              className="workspace-live-source-stages"
                              aria-label={`${source.label} setup stages`}
                            >
                              {readiness.stageLabels.map((stage, index) => (
                                <li key={stage}>
                                  <span>{index + 1}</span>
                                  {stage}
                                </li>
                              ))}
                            </ol>
                            <p>
                              {readiness.readinessNote}
                              {connection?.verification?.checkedAt
                                ? ` Checked ${formatDateTime(connection.verification.checkedAt)}.`
                                : ""}
                            </p>
                            {source.inspection && (
                              <section
                                className={`workspace-live-source-inspection ${source.inspection.status}`}
                              >
                                <div>
                                  <strong>
                                    {source.inspection.statusLabel}
                                  </strong>
                                  <small>
                                    {formatDateTime(
                                      source.inspection.inspectedAt,
                                    )}
                                  </small>
                                </div>
                                {inspectedFields.length > 0 && (
                                  <>
                                    <div className="workspace-live-source-modeling-summary">
                                      <strong>
                                        {fieldModelingSummary.statusLabel}
                                      </strong>
                                      <p>{fieldModelingSummary.guidance}</p>
                                      <div
                                        className="workspace-live-source-fields"
                                        aria-label={`${source.label} field modeling summary`}
                                      >
                                        {fieldModelingSummary.chips.map(
                                          (chip) => (
                                            <span key={chip}>{chip}</span>
                                          ),
                                        )}
                                      </div>
                                    </div>
                                    <div
                                      className="workspace-live-field-list"
                                      aria-label={`${source.label} inspected fields`}
                                    >
                                      {inspectedFields
                                        .slice(0, 8)
                                        .map((field) => {
                                          const fieldView =
                                            buildLiveDatasetFieldModelingView(
                                              field,
                                            );
                                          return (
                                            <div
                                              className={`workspace-live-field-row ${fieldView.readinessTone}`}
                                              key={field.id}
                                            >
                                              <div>
                                                <strong>{field.label}</strong>
                                                <small>
                                                  {field.rawName} ·{" "}
                                                  {fieldView.typeLabel}
                                                </small>
                                                <em>{fieldView.helper}</em>
                                              </div>
                                              <select
                                                value={
                                                  field.modelingRole ??
                                                  "unmodeled"
                                                }
                                                onChange={(event) =>
                                                  updateLiveSourceFieldRole(
                                                    source,
                                                    field.id,
                                                    {
                                                      modelingRole: event.target
                                                        .value as LiveDatasetFieldModelingUpdate["modelingRole"],
                                                    },
                                                  )
                                                }
                                                aria-label={`Model ${field.label}`}
                                              >
                                                {liveDatasetFieldRoleOptions.map(
                                                  (option) => (
                                                    <option
                                                      value={option.id}
                                                      key={option.id}
                                                    >
                                                      {option.label}
                                                    </option>
                                                  ),
                                                )}
                                              </select>
                                            </div>
                                          );
                                        })}
                                      {inspectedFields.length > 8 && (
                                        <p>
                                          {inspectedFields.length - 8} more
                                          inspected fields will be modeled in
                                          the full live field manager.
                                        </p>
                                      )}
                                    </div>
                                    <div
                                      className={
                                        queryDefinitionDraft.canSave
                                          ? "workspace-live-query-definition ready"
                                          : "workspace-live-query-definition"
                                      }
                                    >
                                      <div>
                                        <strong>
                                          {queryDefinitionDraft.label}
                                        </strong>
                                        <p>{queryDefinitionDraft.summary}</p>
                                        <small>
                                          {queryDefinitionDraft.reason}
                                        </small>
                                      </div>
                                      <button
                                        type="button"
                                        className="workspace-home-secondary compact"
                                        onClick={() =>
                                          saveLiveSourceQueryDefinition(source)
                                        }
                                        disabled={!queryDefinitionDraft.canSave}
                                      >
                                        Save definition
                                      </button>
                                    </div>
                                    {queryDefinitions.length > 0 && (
                                      <div
                                        className="workspace-live-query-definition-list"
                                        aria-label={`${source.label} saved live query definitions`}
                                      >
                                        {queryDefinitions.map((definition) => {
                                          const definitionReadiness =
                                            buildLiveDatasetQueryDefinitionReadiness(
                                              source,
                                              definition,
                                            );
                                          const preview =
                                            liveDefinitionPreview?.definitionId ===
                                            definition.id
                                              ? liveDefinitionPreview
                                              : null;
                                          return (
                                            <article
                                              className={`workspace-live-query-definition-row ${definitionReadiness.tone}`}
                                              key={definition.id}
                                            >
                                              <div>
                                                <strong>
                                                  {definition.label}
                                                </strong>
                                                <small>
                                                  {liveDatasetQueryDefinitionSummary(
                                                    definition,
                                                  )}
                                                </small>
                                                <em>
                                                  {definitionReadiness.reason}
                                                </em>
                                                {preview && (
                                                  <section
                                                    className={`workspace-live-definition-preview ${preview.status}`}
                                                  >
                                                    <div>
                                                      <strong>
                                                        {preview.statusLabel}
                                                      </strong>
                                                      <span>
                                                        {preview.result
                                                          ? `${preview.result.metric.label} · base ${preview.result.totalBase.toLocaleString()}`
                                                          : "No result preview"}
                                                      </span>
                                                    </div>
                                                    {preview.result &&
                                                      preview.result.rows
                                                        .length > 0 && (
                                                        <table>
                                                          <tbody>
                                                            {preview.result.rows
                                                              .slice(0, 5)
                                                              .map((row) => (
                                                                <tr
                                                                  key={row.id}
                                                                >
                                                                  <th scope="row">
                                                                    {row.label}
                                                                  </th>
                                                                  <td>
                                                                    {(
                                                                      row.values
                                                                        .summary ??
                                                                      0
                                                                    ).toLocaleString()}
                                                                  </td>
                                                                </tr>
                                                              ))}
                                                          </tbody>
                                                        </table>
                                                      )}
                                                    <p>
                                                      {preview.diagnostics[0] ??
                                                        preview.nextStep}
                                                    </p>
                                                    {preview.status !==
                                                      "executed" && (
                                                      <p>{preview.nextStep}</p>
                                                    )}
                                                  </section>
                                                )}
                                              </div>
                                              <div className="workspace-live-query-definition-actions">
                                                <button
                                                  type="button"
                                                  className="workspace-home-secondary compact"
                                                  onClick={() =>
                                                    runLiveSourceQueryDefinition(
                                                      source,
                                                      definition.id,
                                                    )
                                                  }
                                                  disabled={
                                                    runningLiveDefinitionId ===
                                                    definition.id
                                                  }
                                                >
                                                  {runningLiveDefinitionId ===
                                                  definition.id
                                                    ? "Running..."
                                                    : "Run preview"}
                                                </button>
                                                <button
                                                  type="button"
                                                  className="workspace-home-secondary compact danger"
                                                  onClick={() =>
                                                    deleteLiveSourceQueryDefinition(
                                                      source,
                                                      definition.id,
                                                    )
                                                  }
                                                >
                                                  Remove
                                                </button>
                                              </div>
                                            </article>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </>
                                )}
                                {source.inspection.diagnostics[0] && (
                                  <p>{source.inspection.diagnostics[0]}</p>
                                )}
                                <p>{source.inspection.nextStep}</p>
                              </section>
                            )}
                            {isEditingSource && (
                              <div className="workspace-live-source-editor">
                                <label>
                                  <span>Source label</span>
                                  <input
                                    value={liveSourceDraft.label}
                                    onChange={(event) =>
                                      setLiveSourceDraft((current) => ({
                                        ...current,
                                        label: event.target.value,
                                      }))
                                    }
                                  />
                                </label>
                                <label>
                                  <span>Table, view, or query path</span>
                                  <input
                                    value={liveSourceDraft.objectPath}
                                    onChange={(event) =>
                                      setLiveSourceDraft((current) => ({
                                        ...current,
                                        objectPath: event.target.value,
                                      }))
                                    }
                                    placeholder="DATABASE.SCHEMA.TABLE"
                                  />
                                </label>
                                <label>
                                  <span>Object type</span>
                                  <select
                                    value={liveSourceDraft.objectType}
                                    onChange={(event) =>
                                      setLiveSourceDraft((current) => ({
                                        ...current,
                                        objectType: event.target
                                          .value as LiveDatasetSourceDescriptor["objectType"],
                                      }))
                                    }
                                  >
                                    <option value="table">Table</option>
                                    <option value="view">View</option>
                                    <option value="query">Saved query</option>
                                  </select>
                                </label>
                                <label>
                                  <span>Mode</span>
                                  <select
                                    value={liveSourceDraft.syncMode}
                                    onChange={(event) =>
                                      setLiveSourceDraft((current) => ({
                                        ...current,
                                        syncMode: event.target
                                          .value as LiveDatasetSourceDescriptor["syncMode"],
                                      }))
                                    }
                                  >
                                    <option value="live_query">
                                      Live query
                                    </option>
                                    <option value="snapshot">Snapshot</option>
                                  </select>
                                </label>
                                <label>
                                  <span>Rows estimate</span>
                                  <input
                                    inputMode="numeric"
                                    value={liveSourceDraft.rowCountEstimate}
                                    onChange={(event) =>
                                      setLiveSourceDraft((current) => ({
                                        ...current,
                                        rowCountEstimate: event.target.value,
                                      }))
                                    }
                                    placeholder="Optional"
                                  />
                                </label>
                                <label>
                                  <span>Fields</span>
                                  <input
                                    inputMode="numeric"
                                    value={liveSourceDraft.fieldCount}
                                    onChange={(event) =>
                                      setLiveSourceDraft((current) => ({
                                        ...current,
                                        fieldCount: event.target.value,
                                      }))
                                    }
                                    placeholder="Optional"
                                  />
                                </label>
                                <div className="workspace-live-source-editor__actions">
                                  <button
                                    type="button"
                                    className="workspace-home-primary compact"
                                    onClick={() =>
                                      saveLiveSourceMapping(source)
                                    }
                                  >
                                    Save mapping
                                  </button>
                                  <button
                                    type="button"
                                    className="workspace-home-secondary compact"
                                    onClick={() => setEditingLiveSourceId(null)}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                          {connection && (
                            <button
                              type="button"
                              className="workspace-home-secondary compact"
                              onClick={() => registerLiveSource(connection)}
                            >
                              Refresh
                            </button>
                          )}
                          <button
                            type="button"
                            className="workspace-home-secondary compact"
                            onClick={() => void inspectLiveSource(source)}
                            disabled={isInspectingSource}
                          >
                            {isInspectingSource
                              ? "Inspecting..."
                              : source.inspection?.status === "inspected"
                                ? "Refresh fields"
                                : "Inspect fields"}
                          </button>
                          {inspectedFields.length > 0 && (
                            <button
                              type="button"
                              className="workspace-home-secondary compact"
                              onClick={() =>
                                applyLiveSourceSuggestedRoles(source)
                              }
                            >
                              Suggest roles
                            </button>
                          )}
                          <button
                            type="button"
                            className="workspace-home-secondary compact"
                            onClick={() => startEditingLiveSource(source)}
                          >
                            Edit mapping
                          </button>
                          <button
                            type="button"
                            className="workspace-home-secondary compact danger"
                            onClick={() => removeLiveSource(source)}
                          >
                            Remove
                          </button>
                        </article>
                      );
                    })}
                  </div>
                </section>
              )}
              <div className="workspace-dataset-grid">
                {importedDatasets.map((dataset) => {
                  const summary = buildImportedDatasetStructureSummary(dataset);
                  return (
                    <article
                      className="workspace-dataset-card"
                      key={dataset.id}
                    >
                      <div className="workspace-dataset-card__header">
                        <span>
                          <HomeIcon icon="dataset" />
                        </span>
                        <div>
                          <h3>{dataset.title}</h3>
                          <small>
                            {dataset.fileName} ·{" "}
                            {dataset.importMetadata?.formatLabel ??
                              dataset.fileType.toUpperCase()}{" "}
                            · imported {formatDateTime(dataset.importedAt)}
                          </small>
                        </div>
                      </div>
                      <div className="workspace-dataset-structures">
                        <span>
                          {dataset.rowCount > 0
                            ? "Ready for analysis"
                            : "Labels imported"}
                        </span>
                        <span>
                          {dataset.remote?.provider
                            ? "Saved for this workspace"
                            : "Local draft"}
                        </span>
                      </div>
                      <dl className="workspace-dataset-stats">
                        <div>
                          <dt>Rows</dt>
                          <dd>{dataset.rowCount.toLocaleString()}</dd>
                        </div>
                        <div>
                          <dt>Fields</dt>
                          <dd>{dataset.fieldCount}</dd>
                        </div>
                        <div>
                          <dt>Modeled</dt>
                          <dd>
                            {summary.filters.length +
                              summary.segments.length +
                              summary.banners.length}
                          </dd>
                        </div>
                      </dl>
                      <div className="workspace-dataset-structures">
                        <span>
                          {dataset.importMetadata?.metadataQuality ===
                          "metadata_rich"
                            ? "Survey labels found"
                            : dataset.importMetadata?.metadataQuality ===
                                "structured"
                              ? "Structured workbook"
                              : "Basic field list"}
                        </span>
                        {dataset.importMetadata?.sheetName && (
                          <span>Sheet: {dataset.importMetadata.sheetName}</span>
                        )}
                        <span>{summary.filterLabel}</span>
                        <span>{summary.segmentLabel}</span>
                        <span>{summary.bannerLabel}</span>
                      </div>
                      {dataset.importStatus?.detail && (
                        <p>
                          {dataset.importStatus.detail.replace(
                            /Netlify Database/g,
                            "workspace storage",
                          )}
                        </p>
                      )}
                      <div className="workspace-dataset-fields">
                        {dataset.fields.slice(0, 6).map((field) => (
                          <span key={field.id}>
                            <HomeIcon icon="field" />
                            {field.label}
                            <em>{importedFieldTypeLabel(field.type)}</em>
                          </span>
                        ))}
                      </div>
                      <p>
                        {dataset.notes[0] ??
                          "Initial variable catalog generated from imported columns."}
                      </p>
                    </article>
                  );
                })}
              </div>
              {!importedDatasets.length && (
                <div className="workspace-home-empty compact">
                  <HomeIcon icon="dataset" />
                  <h2>No imported datasets yet</h2>
                  <p>
                    Import a CSV, XLSX, or classic SPSS SAV file to create a
                    workspace dataset and initial field catalog.
                  </p>
                </div>
              )}
            </section>
          )}
        </section>
        <footer className="studio-home-footer">
          <span>From data to insight. From insight to impact.</span>
          <span>
            <Leaf size={13} />
            Built for curious minds.
          </span>
        </footer>
      </div>
      {showHelp && <StudioHelp onClose={() => setShowHelp(false)} />}
    </main>
  );
}
