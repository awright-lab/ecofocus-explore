/** Local-only actual-App acceptance runner. See README.md alongside this file. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const action = process.env.REPORT_NAVIGATOR_ACTION || "new";
assert.ok(["new", "duplicate"].includes(action));
const root = process.cwd();
const require = createRequire(join(root, "package.json"));
const { createServer } = await import(pathToFileURL(require.resolve("vite")));
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const out = resolve(process.env.REPORT_NAVIGATOR_OUTPUT || "docs/validation/report-navigator");
const temporary = await mkdtemp(join(tmpdir(), "ecofocus-navigator-"));
await mkdir(out, { recursive: true });
const server = await createServer({ root, server: { host: "127.0.0.1", port: 5194, strictPort: true }, logLevel: "error" });
let context, page;
try {
  const { reportNavigatorPages } = await server.ssrLoadModule("/src/features/builder/components/__tests__/reportNavigatorFixture.ts");
  const { formulaFixture } = await server.ssrLoadModule("/src/features/metrics/__tests__/formulaFixture.ts");
  const persistence = await server.ssrLoadModule("/src/features/document/workspacePersistence.ts");
  const fixture = await formulaFixture(10, 3);
  fixture.draft.id = "synthetic-report-navigator";
  fixture.draft.pages = reportNavigatorPages(12, 26);
  ["constructor", "__proto__", "toString", "**proto**"].forEach((id, index) => { fixture.draft.pages[index].id = id; });
  fixture.draft.pages[0].tiles = [fixture.source];
  const workspace = persistence.createPublishedSnapshot(persistence.normalizeDashboardWorkspace({ reports: [persistence.createReportRecord(fixture.draft)], importedDatasets: [fixture.dataset] }), fixture.draft).workspace;
  let payload;
  globalThis.window = { localStorage: { setItem: (_key, value) => { payload = value; } } };
  try { assert.equal(persistence.saveDashboardWorkspace(workspace), true); } finally { delete globalThis.window; }
  await server.listen();
  const extension = join(temporary, "extension");
  await mkdir(extension);
  await writeFile(join(extension, "manifest.json"), JSON.stringify({ manifest_version: 3, name: "Local validation zoom", version: "1.0", permissions: ["tabs"], background: { service_worker: "background.js" } }));
  await writeFile(join(extension, "background.js"), "chrome.runtime.onInstalled.addListener(() => {});");
  context = await chromium.launchPersistentContext(join(temporary, "profile"), {
    headless: true, viewport: { width: 1680, height: 1050 },
    ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}),
    ignoreDefaultArgs: ["--disable-extensions"],
    args: ["--no-sandbox", `--disable-extensions-except=${extension}`, `--load-extension=${extension}`]
  });
  await (context.serviceWorkers()[0] ? Promise.resolve() : context.waitForEvent("serviceworker", { timeout: 10000 }));
  const errors = [], externalRequests = [], apiRequests = [];
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.hostname === "127.0.0.1" && url.port === "5194" && !url.pathname.startsWith("/.netlify/functions/")) return route.continue();
    (url.pathname.startsWith("/.netlify/functions/") ? apiRequests : externalRequests).push(url.href);
    return route.abort();
  });
  await context.addInitScript(seed => {
    if (!sessionStorage.getItem("synthetic-navigator-seed")) {
      localStorage.setItem(seed.key, seed.payload);
      sessionStorage.setItem("synthetic-navigator-seed", "1");
    }
  }, { key: persistence.workspaceStorageKey, payload });
  page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:5194/#/reports/${fixture.draft.id}`);
  await page.locator("details.export-menu").waitFor();
  const readState = () => page.evaluate(async () => {
    const { loadDashboardWorkspace } = await import("/src/features/document/workspacePersistence.ts");
    const current = loadDashboardWorkspace();
    return { draft: current.reports[0].draft, datasets: current.importedDatasets, snapshots: current.publishedSnapshots };
  });
  const before = await readState();
  await page.getByRole("button", { name: "Pages", exact: true }).click();
  await page.locator(".report-browse-button").waitFor();
  const current = () => page.locator('.report-page-node[aria-current="page"]');
  const assertCurrent = async number => {
    await page.waitForFunction(number => document.querySelector('.report-page-node[aria-current="page"]')?.getAttribute("aria-label")?.startsWith(`Open page ${number}:`), number);
    assert.match(await current().getAttribute("aria-label"), new RegExp(`^Open page ${number}:`));
  };
  const savedCount = async count => page.waitForFunction(async count => {
    const { loadDashboardWorkspace } = await import("/src/features/document/workspacePersistence.ts");
    return loadDashboardWorkspace().reports[0].draft.pages.length === count;
  }, count);
  const testedIds = ["constructor", "__proto__", "toString", "**proto**"];
  for (const [index, id] of testedIds.entries()) {
    const number = index + 1;
    await page.locator(`.report-page-node[aria-label^="Open page ${number}:"]`).click();
    await page.getByRole("button", { name: `Show objects on page ${number}: Chapter ${number} · Research findings`, exact: true }).click();
    assert.equal(await page.locator(".report-page-group.active .report-page-object-row").count(), 25);
    assert.ok(!(await page.locator(".report-page-group.active").innerText()).includes("NaN"));
    await page.getByRole("button", { name: `Objects on page ${number} pagination: next`, exact: true }).click();
    assert.equal(await page.locator(".report-page-group.active .report-page-object-row").count(), index === 0 ? 2 : 1);
    await page.locator(".report-page-group.active .report-page-object-select").last().click();
    assert.match(await page.locator('.canvas-element.selected').innerText(), new RegExp(`Synthetic insight ${index * 26 + 26}:`));
  }
  assert.deepEqual(await readState(), before);
  await page.getByRole("complementary", { name: "Report outline", exact: true }).getByRole("button", { name: action === "new" ? "New page" : "Duplicate page", exact: true }).click();
  await assertCurrent(13); await savedCount(13);
  await page.screenshot({ path: join(out, action === "new" ? "followup-new-page.png" : "followup-duplicate-page.png") });
  await page.getByRole("button", { name: "Pages outline pagination: first", exact: true }).click();
  assert.equal(await current().count(), 0);
  // Same active ID, unrelated outline update: deliberate browsing remains on the first batch.
  await page.getByRole("button", { name: "Show objects on page 5: Chapter 5 · Research findings", exact: true }).click();
  assert.equal(await current().count(), 0);
  // Changing the canvas page is independent of ReportPageTree's selection callbacks.
  await page.getByRole("button", { name: "Previous page", exact: true }).click(); await assertCurrent(12);
  await page.getByRole("button", { name: "Next page", exact: true }).click(); await assertCurrent(13);
  await page.getByRole("button", { name: "Pages outline pagination: first", exact: true }).click();
  await page.getByRole("button", { name: "Layers", exact: true }).click();
  await page.getByRole("button", { name: "Pages", exact: true }).click(); await assertCurrent(13);
  // Closing Pages keeps its tree mounted: active changes while hidden must also follow.
  await page.getByRole("button", { name: "Pages outline pagination: first", exact: true }).click();
  await page.getByRole("button", { name: "Pages", exact: true }).click();
  await page.getByRole("button", { name: "Previous page", exact: true }).click();
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await page.getByRole("button", { name: "Pages", exact: true }).click(); await assertCurrent(13);
  const after = await readState();
  assert.equal(after.draft.pages.length, 13);
  assert.deepEqual(after.draft.pages.slice(0, 12), before.draft.pages);
  assert.deepEqual(after.datasets, before.datasets); assert.deepEqual(after.snapshots, before.snapshots);
  assert.deepEqual(errors, []); assert.deepEqual(apiRequests, []); assert.deepEqual(externalRequests, []);
  const results = { browser: context.browser().version(), fixture: { pages: 12, objectsPerPage: 26, analyticTables: 1 }, testedIds, reservedIdPaginationAndSelection: true, action, activePage13Visible: true, deliberateBrowsingRetained: true, canvasPreviousNextFollowed: true, remountedPagesFollowed: true, hiddenPagesFollowedOnReopen: true, originalPagesDatasetsAndSnapshotsPreserved: true, errors, apiRequests, externalRequests };
  await writeFile(join(out, `followup-browser-${action}.json`), JSON.stringify(results, null, 2) + "\n"); console.log(JSON.stringify(results, null, 2));
} catch (error) {
  if (page) await page.screenshot({ path: join(out, "followup-failure.png") }).catch(() => {});
  throw error;
} finally {
  await context?.close(); await server.close(); await rm(temporary, { recursive: true, force: true });
}
