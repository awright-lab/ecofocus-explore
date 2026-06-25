import {
  defaultDataset,
  defaultFilterDimension,
  defaultGridSize,
  defaultQuestion,
  fontFamilies,
  palettes
} from "../builder/builderConstants";
import type { QuestionId } from "../../../shared/types/analytics";
import type {
  DashboardCanvasElement,
  DashboardCanvasElementType,
  DashboardDraft,
  DesignColorPalette,
  PageMasterPreset,
  PageTemplatePreset,
  PageThemePreset,
  SavedAnalyticalTemplate,
  SavedBanner,
  SavedCompositionBlock,
  SavedDesignAsset,
  SavedFilterSet,
  SavedVariableSet,
  SavedWeightProfile,
  TextBlockPreset,
  TextStylePreset
} from "../../../shared/types/dashboard";

function encodedSvgAsset(label: string, from: string, to: string, accent: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="1200" height="800" fill="url(#g)"/><circle cx="920" cy="180" r="180" fill="${accent}" opacity=".22"/><circle cx="240" cy="620" r="240" fill="#ffffff" opacity=".2"/><path d="M150 510c160-150 298-169 413-58s245 98 487-38v238H150z" fill="#ffffff" opacity=".24"/><text x="92" y="120" fill="#102332" font-family="Inter,Arial,sans-serif" font-size="42" font-weight="700">${label}</text></svg>`
  )}`;
}

export function seedDesignPalettes(): DesignColorPalette[] {
  return [
    ...palettes.map((palette) => ({
      id: palette.id,
      label: palette.label,
      description: `${palette.label} reporting palette`,
      colors: palette.colors
    })),
    {
      id: "aurora",
      label: "Aurora",
      description: "Bright presentation palette for highlight pages and lighter storytelling tiles.",
      colors: ["#16c9c3", "#00d17f", "#4f8ef7", "#ffd166", "#102332"]
    }
  ];
}

export function seedTextStyles(): TextStylePreset[] {
  return [
    {
      id: "display_title",
      label: "Display title",
      description: "Hero-sized page heading for lead slides and landing sections.",
      fontFamily: fontFamilies[0].value,
      fontSize: 36,
      fontWeight: "800",
      lineHeight: 1.05,
      textAlign: "left",
      textColor: "#102332"
    },
    {
      id: "section_heading",
      label: "Section heading",
      description: "Strong panel or section header for titles inside the report canvas.",
      fontFamily: fontFamilies[0].value,
      fontSize: 22,
      fontWeight: "700",
      lineHeight: 1.15,
      textAlign: "left",
      textColor: "#183528"
    },
    {
      id: "editorial_subhead",
      label: "Editorial subhead",
      description: "Supporting headline for explaining why a page or block matters.",
      fontFamily: fontFamilies[0].value,
      fontSize: 18,
      fontWeight: "650",
      lineHeight: 1.32,
      textAlign: "left",
      textColor: "#365247"
    },
    {
      id: "body_copy",
      label: "Body copy",
      description: "Default readable paragraph style for editorial and annotation blocks.",
      fontFamily: fontFamilies[0].value,
      fontSize: 16,
      fontWeight: "500",
      lineHeight: 1.45,
      textAlign: "left",
      textColor: "#33473d"
    },
    {
      id: "stat_callout",
      label: "Stat callout",
      description: "Compact numeric highlight style for short metrics and callout boxes.",
      fontFamily: fontFamilies[0].value,
      fontSize: 28,
      fontWeight: "800",
      lineHeight: 1.1,
      textAlign: "center",
      textColor: "#0e6958"
    },
    {
      id: "caption",
      label: "Caption",
      description: "Small supporting style for footnotes, sources, and chart callouts.",
      fontFamily: fontFamilies[0].value,
      fontSize: 12,
      fontWeight: "600",
      lineHeight: 1.3,
      textAlign: "left",
      textColor: "#607267"
    },
    {
      id: "methodology_note",
      label: "Methodology note",
      description: "Compact source, weighting, and sample-language style for analytical pages.",
      fontFamily: fontFamilies[0].value,
      fontSize: 11,
      fontWeight: "650",
      lineHeight: 1.28,
      textAlign: "left",
      textColor: "#6f7f77"
    }
  ];
}

export function seedTextBlocks(): TextBlockPreset[] {
  return [
    {
      id: "hero_headline",
      label: "Hero headline",
      description: "Large headline block for opening pages and section resets.",
      content: "What’s shifting in sustainable shopping behavior?",
      width: 520,
      height: 140,
      style: {
        ...defaultElementStyle("text"),
        fill: "transparent",
        textColor: "#102332",
        fontFamily: fontFamilies[0].value,
        fontSize: 38,
        fontWeight: "800",
        textAlign: "left",
        lineHeight: 1.05,
        padding: 0
      }
    },
    {
      id: "section_intro",
      label: "Section intro",
      description: "Mid-sized title and support copy for chapter openers and page framing.",
      content: "Consumers continue to reward brands that feel visibly responsible, especially when packaging and sourcing cues are easy to understand.",
      width: 420,
      height: 128,
      style: {
        ...defaultElementStyle("text"),
        fill: "rgba(255,255,255,0.72)",
        textColor: "#1f3b30",
        fontFamily: fontFamilies[0].value,
        fontSize: 20,
        fontWeight: "600",
        textAlign: "left",
        lineHeight: 1.35,
        padding: 18,
        borderColor: "#d8e7dd",
        borderWidth: 1,
        borderRadius: 18
      }
    },
    {
      id: "stat_callout_block",
      label: "Stat callout",
      description: "Compact highlighted metric for stand-alone story moments.",
      content: "58%\nprioritize responsible sourcing",
      width: 260,
      height: 180,
      style: {
        ...defaultElementStyle("text"),
        fill: "#102332",
        textColor: "#f6fffb",
        fontFamily: fontFamilies[0].value,
        fontSize: 30,
        fontWeight: "800",
        textAlign: "center",
        lineHeight: 1.1,
        padding: 22,
        borderColor: "#102332",
        borderWidth: 0,
        borderRadius: 24
      }
    },
    {
      id: "quote_pull_block",
      label: "Pull quote",
      description: "Editorial quote or respondent-language block for story pages.",
      content: "“Sustainable choices feel easier when the package explains the impact clearly.”",
      width: 420,
      height: 150,
      style: {
        ...defaultElementStyle("text"),
        fill: "#f4fbf7",
        textColor: "#153329",
        fontFamily: fontFamilies[0].value,
        fontSize: 22,
        fontWeight: "700",
        fontStyle: "italic",
        textAlign: "left",
        lineHeight: 1.28,
        padding: 22,
        borderColor: "#cfe5d9",
        borderWidth: 1,
        borderRadius: 22
      }
    },
    {
      id: "image_caption_block",
      label: "Image caption",
      description: "Small caption block designed to pair with image or asset content.",
      content: "Caption: Use this space to connect the visual cue to the analytical takeaway.",
      width: 320,
      height: 76,
      style: {
        ...defaultElementStyle("text"),
        fill: "rgba(255,255,255,0.86)",
        textColor: "#52675d",
        fontFamily: fontFamilies[0].value,
        fontSize: 12,
        fontWeight: "650",
        textAlign: "left",
        lineHeight: 1.28,
        padding: 12,
        borderColor: "#dfe8ed",
        borderWidth: 1,
        borderRadius: 14
      }
    },
    {
      id: "source_note",
      label: "Source note",
      description: "Small footer-style source block for notes, sample language, and methodology.",
      content: "Source: EcoFocus 2025 weighted respondent sample. Internal working draft.",
      width: 380,
      height: 64,
      style: {
        ...defaultElementStyle("text"),
        fill: "rgba(255,255,255,0.82)",
        textColor: "#66776d",
        fontFamily: fontFamilies[0].value,
        fontSize: 12,
        fontWeight: "600",
        textAlign: "left",
        lineHeight: 1.25,
        padding: 12,
        borderColor: "#dfe6dc",
        borderWidth: 1,
        borderRadius: 14
      }
    }
  ];
}

export function seedDesignAssets(): SavedDesignAsset[] {
  return [
    {
      id: "asset_market_moment",
      label: "Market moment",
      description: "Soft editorial image placeholder for section openers and quote pages.",
      kind: "image",
      category: "Editorial",
      url: encodedSvgAsset("Market moment", "#e9f8f4", "#bcefd6", "#0fa87a")
    },
    {
      id: "asset_packaging_detail",
      label: "Packaging detail",
      description: "Warm product-story visual for packaging, claims, and in-store context.",
      kind: "image",
      category: "Product story",
      url: encodedSvgAsset("Packaging detail", "#fff7e8", "#d8efe5", "#ffd166")
    },
    {
      id: "asset_consumer_scene",
      label: "Consumer scene",
      description: "Clean lifestyle visual placeholder for audience and behavior narratives.",
      kind: "image",
      category: "Lifestyle",
      url: encodedSvgAsset("Consumer scene", "#eef4ff", "#dff7ed", "#4f8ef7")
    }
  ];
}

export function seedPageThemes(): PageThemePreset[] {
  return [
    {
      id: "paper",
      label: "Paper",
      description: "Quiet white canvas with a subtle reporting gradient.",
      backgroundMode: "solid",
      background: "#ffffff",
      backgroundImage: "",
      backgroundImageFit: "cover",
      gradientFrom: "#ffffff",
      gradientTo: "#eef7ef",
      gradientType: "linear",
      gradientAngle: 135,
      gradientStops: [],
      showCanvasGrid: true
    },
    {
      id: "mist",
      label: "Mist",
      description: "Soft branded gradient that keeps the canvas airy but recognizable.",
      backgroundMode: "gradient",
      background: "#eff8f4",
      backgroundImage: "",
      backgroundImageFit: "cover",
      gradientFrom: "#f8fcfb",
      gradientTo: "#bcefd6",
      gradientType: "linear",
      gradientAngle: 135,
      gradientStops: [],
      showCanvasGrid: false
    },
    {
      id: "night",
      label: "Night",
      description: "Dark presentation stage for statement pages and executive storytelling.",
      backgroundMode: "gradient",
      background: "#102332",
      backgroundImage: "",
      backgroundImageFit: "cover",
      gradientFrom: "#102332",
      gradientTo: "#1a5b67",
      gradientType: "linear",
      gradientAngle: 135,
      gradientStops: [],
      showCanvasGrid: false
    }
  ];
}

export function seedPageTemplates(): PageTemplatePreset[] {
  const displayStyle = seedTextBlocks().find((block) => block.id === "hero_headline")?.style ?? defaultElementStyle("text");
  const introStyle = seedTextBlocks().find((block) => block.id === "section_intro")?.style ?? defaultElementStyle("text");
  const noteStyle = seedTextBlocks().find((block) => block.id === "source_note")?.style ?? defaultElementStyle("text");

  return [
    {
      id: "blank_page",
      label: "Blank page",
      description: "Clean page with the default canvas and no starter blocks.",
      pageThemeId: "paper",
      elements: []
    },
    {
      id: "story_intro",
      label: "Story intro",
      description: "Headline plus supporting text for a clean section opener.",
      pageThemeId: "mist",
      pageMasterId: "standard_report_master",
      elements: [
        {
          name: "Headline",
          content: "What’s shifting in eco-aware shopping decisions?",
          layout: { x: 92, y: 84, width: 720, height: 132 },
          style: displayStyle
        },
        {
          name: "Intro",
          content: "Use this page to frame the story before charts come in. It works well for a wave summary, a client brief setup, or a transition between sections.",
          layout: { x: 96, y: 248, width: 460, height: 132 },
          style: introStyle
        }
      ]
    },
    {
      id: "insight_with_note",
      label: "Insight page",
      description: "Starter structure for a chart plus narrative and methodology note.",
      pageThemeId: "paper",
      pageMasterId: "standard_report_master",
      elements: [
        {
          name: "Section title",
          content: "Brand and retailer priorities",
          layout: { x: 84, y: 70, width: 540, height: 84 },
          style: {
            ...displayStyle,
            fontSize: 30
          }
        },
        {
          name: "Insight note",
          content: "Lead with the one takeaway you want the page to carry. The chart can then support it rather than doing all the explaining by itself.",
          layout: { x: 86, y: 178, width: 360, height: 160 },
          style: introStyle
        },
        {
          name: "Source",
          content: "Source: EcoFocus weighted sample. Add chart notes or methodology here.",
          layout: { x: 84, y: 642, width: 420, height: 70 },
          style: noteStyle
        }
      ]
    }
  ];
}

export function seedPageMasters(): PageMasterPreset[] {
  const sourceStyle = seedTextBlocks().find((block) => block.id === "source_note")?.style ?? defaultElementStyle("text");
  const headerStyle = {
    ...sourceStyle,
    fontSize: 12,
    fontWeight: "800",
    textColor: "#315345"
  };
  const footerStyle = {
    ...sourceStyle,
    fontSize: 10,
    textColor: "#6f8078"
  };

  return [
    {
      id: "standard_report_master",
      label: "Standard report master",
      description: "Reusable header, source-note, and footer framing for report pages.",
      elements: [
        {
          name: "Master header",
          content: "EcoFocus Explore",
          layout: { x: 72, y: 34, width: 280, height: 34 },
          style: headerStyle
        },
        {
          name: "Master source note",
          content: "Source: EcoFocus survey data. Update notes for this page.",
          layout: { x: 72, y: 650, width: 520, height: 44 },
          style: footerStyle
        },
        {
          name: "Master footer",
          content: "Confidential reporting draft",
          layout: { x: 690, y: 650, width: 250, height: 44 },
          style: {
            ...footerStyle,
            textAlign: "right"
          }
        }
      ]
    }
  ];
}

export function defaultVariableSetRows(questionId: QuestionId) {
  const question = defaultDataset.questions.find((item) => item.id === questionId) ?? defaultQuestion;
  return question.options
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((option, index) => ({
      id: option.id,
      label: option.label,
      kind: "option" as const,
      sourceOptionIds: [option.id],
      rowOrder: index + 1,
      visible: true,
      emphasis: "detail" as const
    }));
}

export function rowKindLabel(kind: SavedVariableSet["rows"][number]["kind"]) {
  if (kind === "topbox") return "Top box";
  if (kind === "bottombox") return "Bottom box";
  if (kind === "net") return "Net";
  return "Option";
}

export function normalizeVariableSetRows(rows: SavedVariableSet["rows"], questionId: QuestionId) {
  const fallbackRows = defaultVariableSetRows(questionId);
  const fallbackById = new Map(fallbackRows.map((row) => [row.id, row]));
  return (rows.length ? rows : fallbackRows)
    .map((row, index) => {
      const fallback = fallbackById.get(row.id);
      return {
        ...fallback,
        ...row,
        kind: row.kind ?? fallback?.kind ?? "option",
        visible: row.visible ?? true,
        emphasis: row.emphasis ?? (row.kind === "option" ? "detail" : "summary"),
        rowOrder: row.rowOrder ?? index + 1
      };
    })
    .sort((a, b) => a.rowOrder - b.rowOrder)
    .map((row, index) => ({ ...row, rowOrder: index + 1 }));
}

export function defaultPageDesign() {
  return {
    showCanvasGrid: true,
    snapToGrid: false,
    gridSize: defaultGridSize,
    background: "#ffffff",
    backgroundMode: "solid" as const,
    backgroundImage: "",
    backgroundImageFit: "cover" as const,
    gradientFrom: "#ffffff",
    gradientTo: "#eef7ef",
    gradientType: "linear" as const,
    gradientAngle: 135,
    gradientStops: []
  };
}

export function seedVariableSets(): SavedVariableSet[] {
  return [
    {
      id: "vs_brand_priorities_top2",
      datasetId: defaultDataset.id,
      label: "Brand priorities Top 2",
      description: "Saved variable set for the Top 2 brand and retailer priorities question.",
      topic: "Brand Sustainability Perceptions",
      questionIds: ["Q15_TOP2_BRAND_PRIORITIES"],
      primaryQuestionId: "Q15_TOP2_BRAND_PRIORITIES",
      rowMode: "authored",
      rows: defaultVariableSetRows("Q15_TOP2_BRAND_PRIORITIES"),
      breakBy: "SUMMARY",
      metric: "percent_selected",
      chartType: "horizontal_bar",
      comparisonMode: "none",
      comparisonDatasets: [],
      weight: defaultDataset.defaultWeight,
      filterField: defaultFilterDimension?.id ?? null,
      filterValue: "all"
    },
    {
      id: "vs_packaging_trust_trend",
      datasetId: defaultDataset.id,
      label: "Packaging trust trend",
      description: "Saved trend view for packaging claim trust across prior waves.",
      topic: "Packaging",
      questionIds: ["Q_PACKAGING_TRUST"],
      primaryQuestionId: "Q_PACKAGING_TRUST",
      rowMode: "authored",
      rows: defaultVariableSetRows("Q_PACKAGING_TRUST"),
      breakBy: "SUMMARY",
      metric: "column_percent",
      chartType: "line_chart",
      comparisonMode: "wave",
      comparisonDatasets: ["ecofocus_2024", "ecofocus_2023"],
      weight: defaultDataset.defaultWeight,
      filterField: null,
      filterValue: "all"
    }
  ];
}

export function seedAnalyticalTemplates(): SavedAnalyticalTemplate[] {
  return [];
}

export function seedSavedBanners(): SavedBanner[] {
  return [
    {
      id: "banner_summary",
      datasetId: defaultDataset.id,
      label: "Summary",
      description: "Default overall summary banner.",
      breakBy: "SUMMARY"
    },
    {
      id: "banner_generation",
      datasetId: defaultDataset.id,
      label: "Generation",
      description: "Saved demographic banner for generation cuts.",
      breakBy: "GENERATION"
    }
  ];
}

export function seedSavedFilters(): SavedFilterSet[] {
  return [
    {
      id: "filter_all_shoppers",
      datasetId: defaultDataset.id,
      label: "All shopper segments",
      description: "No segment filter applied.",
      filterField: defaultFilterDimension?.id ?? null,
      filterValue: "all"
    },
    {
      id: "filter_eco_engaged",
      datasetId: defaultDataset.id,
      label: "Eco engaged",
      description: "Filter to eco engaged shoppers.",
      filterField: "SHOPPER_SEGMENT",
      filterValue: "eco_engaged"
    }
  ];
}

export function seedSavedWeights(): SavedWeightProfile[] {
  return [
    {
      id: "weight_default",
      datasetId: defaultDataset.id,
      label: "EcoFocus respondent weight",
      description: "Default weighted view for EcoFocus reporting.",
      weight: defaultDataset.defaultWeight
    },
    {
      id: "weight_unweighted",
      datasetId: defaultDataset.id,
      label: "Unweighted sample",
      description: "Raw sample without respondent weighting.",
      weight: null
    }
  ];
}

export function seedDesignLibrary() {
  return {
    palettes: seedDesignPalettes(),
    textStyles: seedTextStyles(),
    textBlocks: seedTextBlocks(),
    compositionBlocks: [] as SavedCompositionBlock[],
    assets: seedDesignAssets(),
    pageThemes: seedPageThemes(),
    pageTemplates: seedPageTemplates(),
    pageMasters: seedPageMasters()
  };
}

export const initialDashboard: DashboardDraft = {
  id: "internal_mvp",
  title: "2025 EcoFocus Builder Draft",
  status: "draft",
  publishMetadata: {
    publishCount: 0,
    versionLabel: "Draft"
  },
  analysisLibrary: {
    variableSets: seedVariableSets(),
    banners: seedSavedBanners(),
    filters: seedSavedFilters(),
    segments: [],
    weights: seedSavedWeights(),
    templates: seedAnalyticalTemplates(),
    derivedDefinitions: []
  },
  designLibrary: seedDesignLibrary(),
  pages: [
    {
      id: "page_overview",
      title: "Overview",
      order: 1,
      provenance: {
        masterStatus: "none",
        status: "custom"
      },
      ...defaultPageDesign(),
      elements: [],
      tiles: []
    }
  ]
};

export function defaultElementStyle(type: DashboardCanvasElementType): DashboardCanvasElement["style"] {
  return {
    fill: type === "circle" || type === "rectangle" ? "#dfeee2" : "transparent",
    fillMode: "solid",
    gradientFrom: "#dfeee2",
    gradientTo: "#9fc9a7",
    gradientType: "linear",
    gradientStops: [],
    textColor: "#17211b",
    borderColor: "#438757",
    borderWidth: type === "rectangle" || type === "circle" ? 2 : 1,
    borderStyle: "solid",
    borderRadius: type === "rectangle" ? 8 : 0,
    opacity: 100,
    shadow: false,
    shadowPreset: "soft",
    shadowColor: "#142019",
    shadowOpacity: 20,
    shadowBlur: 24,
    shadowOffsetX: 0,
    shadowOffsetY: 12,
    glow: false,
    glowColor: "#16c9c3",
    glowSize: 24,
    objectFit: "cover",
    fontFamily: fontFamilies[0].value,
    fontSize: 24,
    fontWeight: "700",
    fontStyle: "normal",
    textDecoration: "none",
    textAlign: "left",
    lineHeight: 1.2,
    padding: 10
  };
}
