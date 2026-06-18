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
