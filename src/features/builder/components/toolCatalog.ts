import type { StudioCommand } from './StudioTools';

export type ToolInfo = { category: string; description: string; opens: string; aliases: string; limitation?: string };
const entries: Record<string, ToolInfo> = Object.assign(Object.create(null), {
  'data-preparation': { category: 'Prepare data', description: 'Review, clean and recode a copy of an imported study.', opens: 'Opens data preparation; saving a prepared copy is a separate step.', aliases: 'recode values clean transform missing' , limitation: 'Requires a supported imported study.' },
  data: { category: 'Prepare data', description: 'Find imported studies, filters and segments.', opens: 'Opens the Studies panel.', aliases: 'import dataset data source' },
  'response-coding': { category: 'Prepare data', description: 'Review and code open-ended responses.', opens: 'Opens response coding.', aliases: 'text verbatim qualitative' },
  'linear-model': { category: 'Analyze evidence', description: 'Explore relationships between numeric fields.', opens: 'Opens the numeric relationships workflow.', aliases: 'regression linear model predictors numeric' , limitation: 'Requires eligible numeric data; workflow explains its limits.' },
  'wave-review': { category: 'Analyze evidence', description: 'Review a comparison across study years.', opens: 'Opens year comparison review.', aliases: 'compare years waves trend' },
  analysis: { category: 'Analyze evidence', description: 'Build a table or chart from selected data.', opens: 'Opens the analysis builder.', aliases: 'analyze query chart table' },
  'linked-views': { category: 'Analyze evidence', description: 'Explore related analyses together.', opens: 'Opens linked views.', aliases: 'filter explore' },
  'multiple-response': { category: 'Analyze evidence', description: 'Examine overlaps in multiple-response questions.', opens: 'Opens overlap analysis.', aliases: 'multiple select overlap' },
  'comparison-review': { category: 'Analyze evidence', description: 'Review supported event-rate comparisons.', opens: 'Opens the comparison review.', aliases: 'significance test group' },
  'audience-discovery': { category: 'Analyze evidence', description: 'Explore audience segments.', opens: 'Opens audience discovery.', aliases: 'segment groups' },
  'versioned-result': { category: 'Analyze evidence', description: 'Trace a number to its recorded source.', opens: 'Opens source evidence review.', aliases: 'explain provenance number' },
  'calculated-metrics': { category: 'Analyze evidence', description: 'Create a calculated metric from supported results.', opens: 'Opens the metric builder.', aliases: 'formula derived calculation' },
  analysisLibrary: { category: 'Analyze evidence', description: 'Find saved analyses and related settings.', opens: 'Opens the Studies library.', aliases: 'saved weights banners' },
  'report-insights': { category: 'Analyze evidence', description: 'Review insights collected from the report.', opens: 'Opens reviewed report insights.', aliases: 'findings evidence' },
  'report-refresh': { category: 'Build a report', description: 'Review refreshing a report for a new study wave.', opens: 'Opens new-wave report review.', aliases: 'update new year wave' },
  'question-journey': { category: 'Build a report', description: 'Start from a business question.', opens: 'Opens the question workflow.', aliases: 'business question' },
  'guided-story': { category: 'Build a report', description: 'Plan an evidence-linked story.', opens: 'Opens the story builder.', aliases: 'story narrative' },
  pages: { category: 'Build a report', description: 'Organize pages and templates.', opens: 'Opens the Pages panel.', aliases: 'arrange reorder page outline' },
  text: { category: 'Build a report', description: 'Place editable text on the current page.', opens: 'Adds a text object immediately.', aliases: 'heading paragraph' },
  image: { category: 'Build a report', description: 'Add images and shapes to the page.', opens: 'Opens the Insert panel.', aliases: 'picture shape insert' },
  new: { category: 'Build a report', description: 'Start a new report.', opens: 'Starts the new-report action.', aliases: 'create document' },
  duplicate: { category: 'Build a report', description: 'Make a copy of this report.', opens: 'Starts the duplicate-report action.', aliases: 'copy' },
  home: { category: 'Build a report', description: 'Return to your reports.', opens: 'Starts navigation to the workspace.', aliases: 'workspace' },
  brand: { category: 'Design pages', description: 'Work with themes, typography and sections.', opens: 'Opens the Styles panel.', aliases: 'design colors fonts' },
  layers: { category: 'Design pages', description: 'Arrange, lock and show page objects.', opens: 'Opens the Layers panel.', aliases: 'stack order arrange' },
  page: { category: 'Design pages', description: 'Adjust page background, grid and master.', opens: 'Opens page design controls.', aliases: 'canvas background' },
  properties: { category: 'Design pages', description: 'Inspect the selected object.', opens: 'Opens object properties.', aliases: 'inspector edit' },
  share: { category: 'Export and deliver', description: 'Save a snapshot in this browser.', opens: 'Starts the browser snapshot action.', aliases: 'publish save snapshot', limitation: 'A browser snapshot is not an online share link.' },
  dashboard: { category: 'Export and deliver', description: 'Preview the dashboard view.', opens: 'Switches to dashboard preview.', aliases: 'preview' },
  report: { category: 'Export and deliver', description: 'Preview the report view.', opens: 'Switches to report preview.', aliases: 'preview' },
  present: { category: 'Export and deliver', description: 'Preview as a presentation.', opens: 'Switches to presentation preview.', aliases: 'slides preview' },
  pptx: { category: 'Export and deliver', description: 'Export a PowerPoint presentation.', opens: 'Starts the PowerPoint export.', aliases: 'ppt powerpoint slides download' },
  pdf: { category: 'Export and deliver', description: 'Export a PDF.', opens: 'Starts the PDF export.', aliases: 'download print' },
  xlsx: { category: 'Export and deliver', description: 'Export Excel tables.', opens: 'Starts the Excel export.', aliases: 'spreadsheet download' },
  json: { category: 'Export and deliver', description: 'Export the report as JSON.', opens: 'Starts the JSON export.', aliases: 'download' },
  help: { category: 'Help', description: 'Find studio guidance and shortcuts.', opens: 'Opens the studio guide.', aliases: 'help keyboard' },
});
export const categories = ['All tools', 'Prepare data', 'Analyze evidence', 'Build a report', 'Design pages', 'Export and deliver', 'Help', 'Other tools'];
export function toolInfo(command: StudioCommand): ToolInfo {
  return Object.hasOwn(entries, command.id) ? entries[command.id] : { category: 'Other tools', description: `A tool in ${command.group}.`, opens: 'Runs the supplied tool action.', aliases: command.group };
}
const normalize = (s: string) => s.normalize('NFKC').toLowerCase().trim();
export function searchTools(commands: StudioCommand[], query: string, category: string) {
  const q = normalize(query), words = q.split(/\s+/).filter(Boolean);
  return commands.map((command, index) => {
    const info = toolInfo(command), name = normalize(command.label);
    const text = normalize(`${command.label} ${info.description} ${info.aliases} ${info.category} ${command.group} ${command.shortcut ?? ""}`);
    const rank = !q ? 3 : name === q ? 0 : name.startsWith(q) ? 1 : 2;
    return { command, info, index, rank, matches: (category === 'All tools' || info.category === category) && words.every(word => text.includes(word)) };
  }).filter(item => item.matches).sort((a, b) => a.rank - b.rank || a.index - b.index);
}
