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

function starterElement(args: {
  id: string;
  name: string;
  type?: DashboardCanvasElementType;
  content: string;
  layout: DashboardCanvasElement["layout"];
  style?: Partial<DashboardCanvasElement["style"]>;
}): DashboardCanvasElement {
  const type = args.type ?? "text";
  return {
    id: args.id,
    name: args.name,
    type,
    locked: false,
    hidden: false,
    layout: args.layout,
    content: args.content,
    style: {
      ...defaultElementStyle(type),
      ...args.style,
      gradientType: args.style?.gradientType ?? "linear",
      gradientStops: args.style?.gradientStops ?? []
    }
  };
}

function starterItem(element: DashboardCanvasElement): SavedCompositionBlock["items"][number] {
  return {
    kind: "element",
    element,
    relativeLayout: element.layout
  };
}

function seedCompositionStarter(args: {
  id: string;
  label: string;
  description: string;
  category: SavedCompositionBlock["category"];
  width: number;
  height: number;
  items: DashboardCanvasElement[];
}): SavedCompositionBlock {
  return {
    id: args.id,
    label: args.label,
    description: args.description,
    category: args.category,
    createdAt: 0,
    summary: {
      objectCount: args.items.length,
      tileCount: 0,
      elementCount: args.items.length,
      width: args.width,
      height: args.height
    },
    items: args.items.map(starterItem)
  };
}

export function seedCompositionStarters(): SavedCompositionBlock[] {
  const assets = seedDesignAssets();
  const displayStyle = seedTextStyles().find((style) => style.id === "display_title");
  const subheadStyle = seedTextStyles().find((style) => style.id === "editorial_subhead");
  const captionStyle = seedTextStyles().find((style) => style.id === "caption");
  const noteStyle = seedTextStyles().find((style) => style.id === "methodology_note");

  return [
    seedCompositionStarter({
      id: "starter_title_intro_section",
      label: "Title and intro section",
      description: "A clean opener for framing the page story before charts or details enter.",
      category: "title_section",
      width: 760,
      height: 230,
      items: [
        starterElement({
          id: "starter_title_intro_accent",
          name: "Intro accent",
          type: "rectangle",
          content: "",
          layout: { x: 0, y: 8, width: 8, height: 172, zIndex: 1 },
          style: { fill: "#0fa87a", borderWidth: 0, borderRadius: 10 }
        }),
        starterElement({
          id: "starter_title_intro_title",
          name: "Section headline",
          content: "What matters most in the next shopper decision?",
          layout: { x: 32, y: 0, width: 680, height: 106, zIndex: 2 },
          style: {
            fill: "transparent",
            textColor: displayStyle?.textColor ?? "#102332",
            fontSize: displayStyle?.fontSize ?? 36,
            fontWeight: displayStyle?.fontWeight ?? "800",
            lineHeight: displayStyle?.lineHeight ?? 1.05,
            padding: 0,
            borderStyle: "none",
            borderWidth: 0
          }
        }),
        starterElement({
          id: "starter_title_intro_support",
          name: "Section support copy",
          content: "Use this section to establish the narrative frame, audience, and decision context before moving into analysis.",
          layout: { x: 34, y: 122, width: 520, height: 92, zIndex: 3 },
          style: {
            fill: "transparent",
            textColor: subheadStyle?.textColor ?? "#365247",
            fontSize: subheadStyle?.fontSize ?? 18,
            fontWeight: subheadStyle?.fontWeight ?? "650",
            lineHeight: subheadStyle?.lineHeight ?? 1.32,
            padding: 0,
            borderStyle: "none",
            borderWidth: 0
          }
        })
      ]
    }),
    seedCompositionStarter({
      id: "starter_chart_commentary_section",
      label: "Chart and commentary",
      description: "A two-part analytical story section with a chart placeholder and explanatory narrative.",
      category: "chart_commentary",
      width: 780,
      height: 360,
      items: [
        starterElement({
          id: "starter_chart_commentary_chart",
          name: "Chart placeholder",
          type: "rectangle",
          content: "",
          layout: { x: 0, y: 0, width: 470, height: 320, zIndex: 1 },
          style: {
            fill: "#f7fbf9",
            borderColor: "#d4e6dc",
            borderWidth: 1,
            borderRadius: 22,
            shadow: true,
            shadowOpacity: 10,
            shadowBlur: 20
          }
        }),
        starterElement({
          id: "starter_chart_commentary_title",
          name: "Commentary heading",
          content: "The chart should support one clear takeaway",
          layout: { x: 510, y: 18, width: 250, height: 76, zIndex: 2 },
          style: {
            fill: "transparent",
            textColor: "#17352a",
            fontSize: 22,
            fontWeight: "800",
            lineHeight: 1.15,
            padding: 0,
            borderStyle: "none",
            borderWidth: 0
          }
        }),
        starterElement({
          id: "starter_chart_commentary_body",
          name: "Commentary copy",
          content: "Describe the shift, segment, or contrast that matters. Keep the supporting text focused enough that the chart remains the evidence.",
          layout: { x: 512, y: 112, width: 250, height: 148, zIndex: 3 },
          style: {
            fill: "transparent",
            textColor: "#40584e",
            fontSize: 15,
            fontWeight: "600",
            lineHeight: 1.42,
            padding: 0,
            borderStyle: "none",
            borderWidth: 0
          }
        }),
        starterElement({
          id: "starter_chart_commentary_note",
          name: "Source note",
          content: "Source: EcoFocus 2025. Update base, filter, and weighting note.",
          layout: { x: 512, y: 285, width: 240, height: 48, zIndex: 4 },
          style: {
            fill: "#f5faf7",
            textColor: noteStyle?.textColor ?? "#6f7f77",
            fontSize: noteStyle?.fontSize ?? 11,
            fontWeight: noteStyle?.fontWeight ?? "650",
            lineHeight: noteStyle?.lineHeight ?? 1.28,
            padding: 10,
            borderColor: "#e0ece6",
            borderWidth: 1,
            borderRadius: 12
          }
        })
      ]
    }),
    seedCompositionStarter({
      id: "starter_kpi_highlight_section",
      label: "Insight highlight KPI",
      description: "A focused proof-point block for a headline number and concise interpretation.",
      category: "quote_stat",
      width: 540,
      height: 220,
      items: [
        starterElement({
          id: "starter_kpi_highlight_backdrop",
          name: "KPI backdrop",
          type: "rectangle",
          content: "",
          layout: { x: 0, y: 0, width: 540, height: 210, zIndex: 1 },
          style: { fill: "#102332", borderWidth: 0, borderRadius: 28, shadow: true, shadowOpacity: 18, shadowBlur: 26 }
        }),
        starterElement({
          id: "starter_kpi_highlight_value",
          name: "KPI value",
          content: "58%",
          layout: { x: 34, y: 28, width: 180, height: 86, zIndex: 2 },
          style: {
            fill: "transparent",
            textColor: "#f6fffb",
            fontSize: 54,
            fontWeight: "900",
            lineHeight: 1,
            textAlign: "left",
            padding: 0,
            borderStyle: "none",
            borderWidth: 0
          }
        }),
        starterElement({
          id: "starter_kpi_highlight_copy",
          name: "KPI interpretation",
          content: "prioritize responsible sourcing when choosing brands and retailers.",
          layout: { x: 230, y: 38, width: 250, height: 96, zIndex: 3 },
          style: {
            fill: "transparent",
            textColor: "#e9fff7",
            fontSize: 20,
            fontWeight: "750",
            lineHeight: 1.28,
            padding: 0,
            borderStyle: "none",
            borderWidth: 0
          }
        }),
        starterElement({
          id: "starter_kpi_highlight_note",
          name: "KPI note",
          content: "Replace with a measured value or derived metric from the current analysis.",
          layout: { x: 36, y: 150, width: 440, height: 42, zIndex: 4 },
          style: {
            fill: "rgba(255,255,255,0.08)",
            textColor: "#bfe8dc",
            fontSize: 12,
            fontWeight: "700",
            lineHeight: 1.25,
            padding: 10,
            borderColor: "rgba(255,255,255,0.16)",
            borderWidth: 1,
            borderRadius: 13
          }
        })
      ]
    }),
    seedCompositionStarter({
      id: "starter_image_caption_section",
      label: "Image and caption",
      description: "An editorial image block with caption and narrative context for visual storytelling.",
      category: "image_caption",
      width: 620,
      height: 390,
      items: [
        starterElement({
          id: "starter_image_caption_image",
          name: "Editorial image",
          type: "image",
          content: assets[1]?.url ?? "",
          layout: { x: 0, y: 0, width: 360, height: 270, zIndex: 1 },
          style: { fill: "transparent", borderStyle: "none", borderWidth: 0, borderRadius: 26, objectFit: "cover", shadow: true, shadowOpacity: 12 }
        }),
        starterElement({
          id: "starter_image_caption_title",
          name: "Image story title",
          content: "Packaging cues shape the moment of choice",
          layout: { x: 392, y: 28, width: 210, height: 96, zIndex: 2 },
          style: {
            fill: "transparent",
            textColor: "#17352a",
            fontSize: 22,
            fontWeight: "800",
            lineHeight: 1.18,
            padding: 0,
            borderStyle: "none",
            borderWidth: 0
          }
        }),
        starterElement({
          id: "starter_image_caption_copy",
          name: "Image caption",
          content: "Use the caption to connect the visual moment to the analytical claim on the page.",
          layout: { x: 392, y: 148, width: 210, height: 92, zIndex: 3 },
          style: {
            fill: "#ffffff",
            textColor: captionStyle?.textColor ?? "#607267",
            fontSize: captionStyle?.fontSize ?? 12,
            fontWeight: captionStyle?.fontWeight ?? "600",
            lineHeight: captionStyle?.lineHeight ?? 1.3,
            padding: 14,
            borderColor: "#dfe8ed",
            borderWidth: 1,
            borderRadius: 16
          }
        })
      ]
    }),
    seedCompositionStarter({
      id: "starter_methodology_note_section",
      label: "Methodology note",
      description: "A compact source and caveat strip for analytical pages that need interpretation guardrails.",
      category: "methodology",
      width: 720,
      height: 92,
      items: [
        starterElement({
          id: "starter_methodology_note_strip",
          name: "Methodology strip",
          type: "rectangle",
          content: "",
          layout: { x: 0, y: 0, width: 720, height: 86, zIndex: 1 },
          style: { fill: "#f8fbfa", borderColor: "#dfe9e4", borderWidth: 1, borderRadius: 18 }
        }),
        starterElement({
          id: "starter_methodology_note_copy",
          name: "Methodology copy",
          content: "Method note: Weighted respondent base. Interpret low-base segments directionally and update this note for each page.",
          layout: { x: 22, y: 18, width: 650, height: 48, zIndex: 2 },
          style: {
            fill: "transparent",
            textColor: noteStyle?.textColor ?? "#6f7f77",
            fontSize: noteStyle?.fontSize ?? 11,
            fontWeight: noteStyle?.fontWeight ?? "650",
            lineHeight: noteStyle?.lineHeight ?? 1.28,
            padding: 0,
            borderStyle: "none",
            borderWidth: 0
          }
        })
      ]
    }),
    seedCompositionStarter({
      id: "starter_section_divider",
      label: "Section divider",
      description: "A chapter-style divider for resetting the narrative between analytical sections.",
      category: "title_section",
      width: 760,
      height: 260,
      items: [
        starterElement({
          id: "starter_section_divider_number",
          name: "Section number",
          content: "02",
          layout: { x: 0, y: 0, width: 132, height: 84, zIndex: 1 },
          style: {
            fill: "transparent",
            textColor: "#0fa87a",
            fontSize: 54,
            fontWeight: "900",
            lineHeight: 1,
            padding: 0,
            borderStyle: "none",
            borderWidth: 0
          }
        }),
        starterElement({
          id: "starter_section_divider_title",
          name: "Divider title",
          content: "Where the opportunity is moving next",
          layout: { x: 0, y: 96, width: 620, height: 104, zIndex: 2 },
          style: {
            fill: "transparent",
            textColor: "#102332",
            fontSize: 36,
            fontWeight: "850",
            lineHeight: 1.08,
            padding: 0,
            borderStyle: "none",
            borderWidth: 0
          }
        }),
        starterElement({
          id: "starter_section_divider_line",
          name: "Divider rule",
          type: "rectangle",
          content: "",
          layout: { x: 0, y: 224, width: 760, height: 4, zIndex: 3 },
          style: { fill: "#0fa87a", borderWidth: 0, borderRadius: 4 }
        })
      ]
    })
  ];
}

export function seedPageThemes(): PageThemePreset[] {
  return [
    {
      id: "paper",
      label: "Paper",
      description: "Quiet white canvas with a subtle reporting gradient.",
      backgroundMode: "solid",
      backgroundPattern: "none",
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
      backgroundPattern: "none",
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
      backgroundPattern: "none",
      background: "#102332",
      backgroundImage: "",
      backgroundImageFit: "cover",
      gradientFrom: "#102332",
      gradientTo: "#1a5b67",
      gradientType: "linear",
      gradientAngle: 135,
      gradientStops: [],
      showCanvasGrid: false
    },
    {
      id: "teal_grid",
      label: "Teal grid",
      description: "Dark teal stage background with the checker treatment applied.",
      backgroundMode: "gradient",
      backgroundPattern: "teal_grid",
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
    backgroundPattern: "none" as const,
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
    compositionStarters: seedCompositionStarters(),
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
      elements: [
        {
          id: "mockup_accent_rule",
          name: "Accent rule",
          type: "rectangle",
          locked: false,
          hidden: false,
          layout: { x: 52, y: 34, width: 48, height: 5, zIndex: 1 },
          content: "",
          style: { ...defaultElementStyle("rectangle"), fill: "#0e8f78", borderWidth: 0, borderRadius: 5 }
        },
        {
          id: "mockup_story_title",
          name: "Story title",
          type: "text",
          locked: false,
          hidden: false,
          layout: { x: 64, y: 72, width: 440, height: 62, zIndex: 2 },
          content: "Workplace Trends 2026",
          style: {
            ...defaultElementStyle("text"),
            fill: "transparent",
            textColor: "#101833",
            fontFamily: "Georgia, serif",
            fontSize: 36,
            fontWeight: "800",
            padding: 0
          }
        },
        {
          id: "mockup_story_subtitle",
          name: "Story subtitle",
          type: "text",
          locked: false,
          hidden: false,
          layout: { x: 66, y: 138, width: 420, height: 50, zIndex: 2 },
          content: "What matters most to today’s workforce—and what it means for business",
          style: {
            ...defaultElementStyle("text"),
            fill: "transparent",
            textColor: "#536078",
            fontSize: 16,
            fontWeight: "500",
            lineHeight: 1.32,
            padding: 0
          }
        },
        {
          id: "mockup_kpi_card_1",
          name: "KPI card",
          type: "rectangle",
          locked: false,
          hidden: false,
          layout: { x: 558, y: 56, width: 126, height: 146, zIndex: 1 },
          content: "",
          style: { ...defaultElementStyle("rectangle"), fill: "#ffffff", borderColor: "#e2e7ec", borderWidth: 1, borderRadius: 8, shadow: true }
        },
        {
          id: "mockup_kpi_1",
          name: "KPI text",
          type: "text",
          locked: false,
          hidden: false,
          layout: { x: 574, y: 82, width: 96, height: 100, zIndex: 2 },
          content: "84%\nCare About\nWorkplace Culture\nvs. 78% in 2024 ↑",
          style: { ...defaultElementStyle("text"), fill: "transparent", textColor: "#11182f", fontSize: 15, fontWeight: "800", lineHeight: 1.18, padding: 0 }
        },
        {
          id: "mockup_kpi_card_2",
          name: "KPI card",
          type: "rectangle",
          locked: false,
          hidden: false,
          layout: { x: 696, y: 56, width: 126, height: 146, zIndex: 1 },
          content: "",
          style: { ...defaultElementStyle("rectangle"), fill: "#ffffff", borderColor: "#e2e7ec", borderWidth: 1, borderRadius: 8, shadow: true }
        },
        {
          id: "mockup_kpi_2",
          name: "KPI text",
          type: "text",
          locked: false,
          hidden: false,
          layout: { x: 712, y: 82, width: 96, height: 100, zIndex: 2 },
          content: "41%\nFeel Supported\nat Work\nvs. 35% in 2024 ↑",
          style: { ...defaultElementStyle("text"), fill: "transparent", textColor: "#11182f", fontSize: 15, fontWeight: "800", lineHeight: 1.18, padding: 0 }
        },
        {
          id: "mockup_kpi_card_3",
          name: "KPI card",
          type: "rectangle",
          locked: false,
          hidden: false,
          layout: { x: 834, y: 56, width: 126, height: 146, zIndex: 1 },
          content: "",
          style: { ...defaultElementStyle("rectangle"), fill: "#ffffff", borderColor: "#e2e7ec", borderWidth: 1, borderRadius: 8, shadow: true }
        },
        {
          id: "mockup_kpi_3",
          name: "KPI text",
          type: "text",
          locked: false,
          hidden: false,
          layout: { x: 850, y: 82, width: 96, height: 100, zIndex: 2 },
          content: "2x\nGrowth in\nJob-Seeker Influence\nvs. 2024 ↑",
          style: { ...defaultElementStyle("text"), fill: "transparent", textColor: "#11182f", fontSize: 15, fontWeight: "800", lineHeight: 1.18, padding: 0 }
        },
        {
          id: "mockup_chart_placeholder",
          name: "Chart placeholder",
          type: "rectangle",
          locked: false,
          hidden: false,
          layout: { x: 64, y: 244, width: 516, height: 292, zIndex: 1 },
          content: "",
          style: { ...defaultElementStyle("rectangle"), fill: "#ffffff", borderColor: "#dfe6ec", borderWidth: 1, borderRadius: 8, shadow: true }
        },
        {
          id: "mockup_chart_title",
          name: "Chart title",
          type: "text",
          locked: false,
          hidden: false,
          layout: { x: 86, y: 264, width: 280, height: 38, zIndex: 2 },
          content: "Top Drivers of Workplace Choice\n% selecting as a top 3 driver",
          style: { ...defaultElementStyle("text"), fill: "transparent", textColor: "#172033", fontSize: 14, fontWeight: "800", lineHeight: 1.25, padding: 0 }
        },
        {
          id: "mockup_donut_placeholder",
          name: "Donut placeholder",
          type: "rectangle",
          locked: false,
          hidden: false,
          layout: { x: 608, y: 244, width: 352, height: 292, zIndex: 1 },
          content: "",
          style: { ...defaultElementStyle("rectangle"), fill: "#ffffff", borderColor: "#dfe6ec", borderWidth: 1, borderRadius: 8, shadow: true }
        },
        {
          id: "mockup_donut_title",
          name: "Donut title",
          type: "text",
          locked: false,
          hidden: false,
          layout: { x: 628, y: 264, width: 250, height: 36, zIndex: 2 },
          content: "Preferred Work Arrangement\n% of respondents",
          style: { ...defaultElementStyle("text"), fill: "transparent", textColor: "#172033", fontSize: 14, fontWeight: "800", lineHeight: 1.25, padding: 0 }
        },
        {
          id: "mockup_insight_band",
          name: "Insight band",
          type: "rectangle",
          locked: false,
          hidden: false,
          layout: { x: 64, y: 572, width: 392, height: 86, zIndex: 1 },
          content: "",
          style: { ...defaultElementStyle("rectangle"), fill: "#edf9f6", borderColor: "#def0eb", borderWidth: 1, borderRadius: 8, shadow: false }
        },
        {
          id: "mockup_insight_text",
          name: "Insight text",
          type: "text",
          locked: false,
          hidden: false,
          layout: { x: 114, y: 590, width: 314, height: 52, zIndex: 2 },
          content: "INSIGHT\nCulture leads the decision hierarchy, outranking compensation and growth.",
          style: { ...defaultElementStyle("text"), fill: "transparent", textColor: "#101833", fontSize: 14, fontWeight: "800", lineHeight: 1.28, padding: 0 }
        },
        {
          id: "mockup_next_section",
          name: "Next section card",
          type: "rectangle",
          locked: false,
          hidden: false,
          layout: { x: 484, y: 572, width: 476, height: 86, zIndex: 1 },
          content: "",
          style: { ...defaultElementStyle("rectangle"), fill: "#f5f3fb", borderColor: "#ece9f7", borderWidth: 1, borderRadius: 8, shadow: false }
        },
        {
          id: "mockup_next_section_text",
          name: "Next section text",
          type: "text",
          locked: false,
          hidden: false,
          layout: { x: 558, y: 590, width: 260, height: 52, zIndex: 2 },
          content: "SECTION 2\nOpportunity\nWhere organizations can take action",
          style: { ...defaultElementStyle("text"), fill: "transparent", textColor: "#101833", fontFamily: "Georgia, serif", fontSize: 22, fontWeight: "800", lineHeight: 1.12, padding: 0 }
        }
      ],
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
