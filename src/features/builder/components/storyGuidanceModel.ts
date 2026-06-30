import type { DashboardCanvasElement, DashboardPage, DashboardTile } from "../../../../shared/types/dashboard";

export type StoryRole = "evidence" | "takeaway" | "implication" | "opportunity" | "methodology" | "comparison" | "narrative";

export type StoryGuidanceView = {
  pageRole: StoryRole;
  pageRoleLabel: string;
  pagePurpose: string;
  arcLabel: string;
  nextStepLabel: string;
  nextStepHelper: string;
  roleCounts: Record<StoryRole, number>;
  selectedRoleLabel: string;
  selectedRoleHelper: string;
};

const roleLabels: Record<StoryRole, string> = {
  evidence: "Evidence",
  takeaway: "Takeaway",
  implication: "Implication",
  opportunity: "Opportunity",
  methodology: "Methodology",
  comparison: "Comparison",
  narrative: "Narrative"
};

function elementRole(element: DashboardCanvasElement): StoryRole {
  const text = `${element.name} ${element.content} ${element.compositionBlock?.label ?? ""}`.toLowerCase();
  if (text.includes("method") || text.includes("source") || text.includes("base")) return "methodology";
  if (text.includes("opportunity") || text.includes("section 2")) return "opportunity";
  if (text.includes("implication") || text.includes("action")) return "implication";
  if (text.includes("insight") || text.includes("takeaway")) return "takeaway";
  if (text.includes("kpi") || text.includes("%") || text.includes("2x")) return "takeaway";
  return "narrative";
}

function tileRole(tile: DashboardTile): StoryRole {
  if ((tile.query.comparisonMode ?? "none") !== "none" || tile.result.columns.length > 1 || tile.query.breakBy !== "SUMMARY") {
    return "comparison";
  }
  return tile.visualization === "table" ? "evidence" : "evidence";
}

function incrementRole(counts: Record<StoryRole, number>, role: StoryRole) {
  counts[role] += 1;
}

function dominantRole(counts: Record<StoryRole, number>): StoryRole {
  const priority: StoryRole[] = ["comparison", "evidence", "takeaway", "implication", "opportunity", "methodology", "narrative"];
  return priority.reduce((best, role) => (counts[role] > counts[best] ? role : best), "narrative" as StoryRole);
}

function arcFromCounts(counts: Record<StoryRole, number>) {
  const arc = [
    counts.takeaway > 0 ? "Takeaway" : null,
    counts.evidence + counts.comparison > 0 ? "Evidence" : null,
    counts.opportunity + counts.implication > 0 ? "Opportunity" : null,
    counts.methodology > 0 ? "Method" : null
  ].filter(Boolean);

  return arc.length >= 2 ? arc.join(" -> ") : "Evidence -> Takeaway -> Implication";
}

function nextStepFromCounts(counts: Record<StoryRole, number>) {
  if (counts.evidence + counts.comparison === 0) {
    return {
      label: "Add analytical evidence",
      helper: "Start with a chart or table so the page has a measured foundation."
    };
  }
  if (counts.takeaway === 0) {
    return {
      label: "Add a takeaway block",
      helper: "Pair the lead chart with an insight callout or KPI strip so the audience sees the point quickly."
    };
  }
  if (counts.implication + counts.opportunity === 0) {
    return {
      label: "Add implication framing",
      helper: "Use an opportunity card or short implication note to turn the evidence into action."
    };
  }
  if (counts.methodology === 0) {
    return {
      label: "Add a compact method note",
      helper: "A short base, filter, weight, or confidence note will make the page easier to trust."
    };
  }
  return {
    label: "Tighten the story rhythm",
    helper: "Review whether the page moves cleanly from takeaway to evidence to implication."
  };
}

function selectedRole(
  selectedTile: DashboardTile | null,
  selectedElement: DashboardCanvasElement | null,
  pageRole: StoryRole
) {
  if (selectedTile) {
    const role = tileRole(selectedTile);
    return {
      label: `${roleLabels[role]} object`,
      helper:
        role === "comparison"
          ? "This tile is carrying comparison evidence. Add commentary that names the difference and why it matters."
          : selectedTile.visualization === "table"
            ? "This table is grounding the page in plain numbers. Use it before designing a more visual version."
            : "This chart is evidence. Pair it with a nearby takeaway or implication block."
    };
  }

  if (selectedElement) {
    const role = elementRole(selectedElement);
    return {
      label: `${roleLabels[role]} block`,
      helper:
        role === "takeaway"
          ? "This block frames the point. Keep it close to the chart or table it explains."
          : role === "methodology"
            ? "This block supports trust. Keep it compact and near the evidence it qualifies."
            : role === "opportunity" || role === "implication"
              ? "This block moves the audience from evidence toward action."
              : "This object supports the page narrative. Anchor it near the evidence or section it belongs to."
    };
  }

  return {
    label: `${roleLabels[pageRole]} page`,
    helper: "Select a chart, table, or story block to see how that object contributes to the page arc."
  };
}

export function buildStoryGuidanceView(
  page: DashboardPage,
  selectedTile: DashboardTile | null,
  selectedElement: DashboardCanvasElement | null
): StoryGuidanceView {
  const roleCounts: Record<StoryRole, number> = {
    evidence: 0,
    takeaway: 0,
    implication: 0,
    opportunity: 0,
    methodology: 0,
    comparison: 0,
    narrative: 0
  };

  page.tiles.filter((tile) => !tile.hidden).forEach((tile) => incrementRole(roleCounts, tileRole(tile)));
  page.elements.filter((element) => !element.hidden).forEach((element) => incrementRole(roleCounts, elementRole(element)));

  const pageRole = dominantRole(roleCounts);
  const nextStep = nextStepFromCounts(roleCounts);
  const selected = selectedRole(selectedTile, selectedElement, pageRole);

  return {
    pageRole,
    pageRoleLabel: roleLabels[pageRole],
    pagePurpose:
      roleCounts.evidence + roleCounts.comparison > 0
        ? "This page is assembling analytical evidence into a story section."
        : "This page is ready for a first analytical object or story starter.",
    arcLabel: arcFromCounts(roleCounts),
    nextStepLabel: nextStep.label,
    nextStepHelper: nextStep.helper,
    roleCounts,
    selectedRoleLabel: selected.label,
    selectedRoleHelper: selected.helper
  };
}
