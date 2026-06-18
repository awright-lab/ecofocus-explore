import type { DashboardDraft } from "../../../shared/types/dashboard";

export interface PublishReadinessCheck {
  id: string;
  label: string;
  passed: boolean;
  helper: string;
}

export interface PublishReadinessView {
  status: "ready" | "needs-review";
  label: string;
  helper: string;
  passedCount: number;
  totalCount: number;
  checks: PublishReadinessCheck[];
}

export interface PublishShareContextView {
  status: "draft" | "published";
  label: string;
  helper: string;
  viewerLabel: string;
  exportLabel: string;
}

export interface ExportPackageContextView {
  status: "ready" | "needs-review";
  label: string;
  helper: string;
  packageLabel: string;
  readinessLabel: string;
}

export interface ExportPackageConfirmationView {
  status: "ready" | "needs-review";
  label: string;
  helper: string;
}

export function publishMetadataLabel(dashboard: DashboardDraft) {
  const { publishedAt, publishCount, versionLabel } = dashboard.publishMetadata;
  if (!publishCount) return "No published version yet";

  const dateLabel = publishedAt
    ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(publishedAt))
    : "publish date unknown";

  return `${versionLabel} · ${dateLabel}`;
}

export function buildPublishReadinessView(dashboard: DashboardDraft): PublishReadinessView {
  const visibleTiles = dashboard.pages.reduce((count, page) => count + page.tiles.filter((tile) => !tile.hidden).length, 0);
  const visibleElements = dashboard.pages.reduce((count, page) => count + page.elements.filter((element) => !element.hidden).length, 0);
  const visibleObjects = visibleTiles + visibleElements;
  const titledPages = dashboard.pages.filter((page) => page.title.trim()).length;
  const checks: PublishReadinessCheck[] = [
    {
      id: "pages",
      label: "At least one page",
      passed: dashboard.pages.length > 0,
      helper: dashboard.pages.length > 0 ? `${dashboard.pages.length} page${dashboard.pages.length === 1 ? "" : "s"} in this report.` : "Add a page before publishing."
    },
    {
      id: "visible-objects",
      label: "Visible report content",
      passed: visibleObjects > 0,
      helper: visibleObjects > 0 ? `${visibleObjects} visible object${visibleObjects === 1 ? "" : "s"} across pages.` : "Add or show at least one tile, chart, text block, or shape."
    },
    {
      id: "analysis",
      label: "Visible analysis",
      passed: visibleTiles > 0,
      helper: visibleTiles > 0 ? `${visibleTiles} visible analytical tile${visibleTiles === 1 ? "" : "s"} ready for review.` : "Add a visible table or chart if this report needs analytical output."
    },
    {
      id: "page-titles",
      label: "Page titles",
      passed: titledPages === dashboard.pages.length && dashboard.pages.length > 0,
      helper: titledPages === dashboard.pages.length && dashboard.pages.length > 0 ? "All pages have titles." : "Name each page so published navigation is clear."
    }
  ];
  const passedCount = checks.filter((check) => check.passed).length;
  const totalCount = checks.length;
  const ready = passedCount === totalCount;

  return {
    status: ready ? "ready" : "needs-review",
    label: ready ? "Ready to publish" : "Review before publish",
    helper: ready ? "This draft passes the lightweight publish checklist." : `${passedCount} of ${totalCount} readiness checks pass. Publishing is still available.`,
    passedCount,
    totalCount,
    checks
  };
}

export function buildPublishShareContextView(dashboard: DashboardDraft): PublishShareContextView {
  const { publishCount, versionLabel } = dashboard.publishMetadata;

  if (dashboard.status === "published") {
    return {
      status: "published",
      label: "Published viewer",
      helper: `${versionLabel} is available in the report viewer.`,
      viewerLabel: "Open report reviews the current published version.",
      exportLabel: "Export package is separate from the published viewer."
    };
  }

  if (publishCount > 0) {
    return {
      status: "draft",
      label: "Draft update",
      helper: `Publishing will create v${publishCount + 1} from this draft.`,
      viewerLabel: `${versionLabel} is the last published context.`,
      exportLabel: "Export package uses the current draft content."
    };
  }

  return {
    status: "draft",
    label: "First publish",
    helper: "Publishing will create v1 in the report viewer.",
    viewerLabel: "No viewer version exists yet.",
    exportLabel: "Export package is available before publishing."
  };
}

export function buildExportPackageContextView(dashboard: DashboardDraft, readiness = buildPublishReadinessView(dashboard)): ExportPackageContextView {
  const packageLabel =
    dashboard.status === "published"
      ? `Packages the current ${dashboard.publishMetadata.versionLabel} report state.`
      : "Packages the current draft state.";
  const ready = readiness.status === "ready";

  return {
    status: ready ? "ready" : "needs-review",
    label: ready ? "Package ready" : "Package review",
    helper: "Exports a JSON presentation package with visible pages, objects, analytics, and metadata.",
    packageLabel,
    readinessLabel: `${readiness.passedCount}/${readiness.totalCount} readiness checks pass.`
  };
}

export function buildExportPackageConfirmationView(
  dashboard: DashboardDraft,
  exportContext = buildExportPackageContextView(dashboard)
): ExportPackageConfirmationView {
  const contextLabel =
    dashboard.status === "published"
      ? `Published ${dashboard.publishMetadata.versionLabel} package downloaded`
      : "Draft package downloaded";

  return {
    status: exportContext.status,
    label: contextLabel,
    helper: `${exportContext.packageLabel} ${exportContext.readinessLabel}`
  };
}
