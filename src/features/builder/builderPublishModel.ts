import type { DashboardDraft } from "../../../shared/types/dashboard";

export function publishMetadataLabel(dashboard: DashboardDraft) {
  const { publishedAt, publishCount, versionLabel } = dashboard.publishMetadata;
  if (!publishCount) return "No published version yet";

  const dateLabel = publishedAt
    ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(publishedAt))
    : "publish date unknown";

  return `${versionLabel} · ${dateLabel}`;
}
