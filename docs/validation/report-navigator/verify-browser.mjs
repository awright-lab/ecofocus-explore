/** Local-only actual-App acceptance runner. See README.md alongside this file. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

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
  fixture.draft.pages = reportNavigatorPages();
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
  const worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker", { timeout: 10000 });
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
  const sidebarPreviews = await page.locator(".report-page-thumbnail").count(); assert.equal(sidebarPreviews, 12);
  const open = async () => {
    const start = performance.now();
    await page.locator(".report-browse-button").click();
    await page.getByRole("dialog").waitFor();
    await page.locator(".navigator-page-preview").first().waitFor();
    return Math.round(performance.now() - start);
  };
  const openMs = await open();
  const desktopPreviews = await page.locator(".document-preview").count(); assert.equal(desktopPreviews, 24);
  await page.screenshot({ path: join(out, "desktop.png") });
  const overviewLast = page.getByRole("button", { name: "Page overview pagination: last", exact: true });
  await overviewLast.focus(); await page.keyboard.press("Enter");
  assert.equal(await overviewLast.evaluate(node => node === document.activeElement), true);
  assert.equal(await overviewLast.getAttribute("aria-disabled"), "true");
  await page.keyboard.press("Enter"); assert.match(await page.locator(".navigator-count").innerText(), /97–100 of 100/);
  const overviewFirst = page.getByRole("button", { name: "Page overview pagination: first", exact: true });
  await overviewFirst.focus(); await page.keyboard.press("Enter");
  assert.equal(await overviewFirst.evaluate(node => node === document.activeElement), true);
  await page.keyboard.press("Shift+Tab"); assert.equal(await page.getByRole("dialog").evaluate(node => node.contains(document.activeElement)), true);
  await page.keyboard.press("Tab"); assert.equal(await page.getByRole("dialog").evaluate(node => node.contains(document.activeElement)), true);
  await page.keyboard.press("Escape"); assert.equal(await page.locator(".report-browse-button").evaluate(node => node === document.activeElement), true);
  const warmOpenMs = await open();
  await page.getByRole("button", { name: "Find objects", exact: true }).click();
  const search = page.getByLabel("Search object names and written text", { exact: true });
  const searchStart = performance.now(); await search.fill("Research note");
  await page.locator(".navigator-count").filter({ hasText: "of 2000" }).waitFor();
  const searchMs = Math.round(performance.now() - searchStart);
  assert.equal(await page.locator(".navigator-object").count(), 25);
  await page.locator(".navigator-object").nth(20).click();
  assert.match(await page.locator(".report-page-node[aria-current='page']").getAttribute("aria-label"), /page 2:/);
  assert.match(await page.locator(".canvas-element.selected").innerText(), /Synthetic insight 21:/);
  await open(); await page.getByRole("button", { name: "Find objects", exact: true }).click(); await search.fill("Research note");
  const lastStart = performance.now();
  const objectLast = page.getByRole("button", { name: "Object results pagination: last", exact: true });
  await objectLast.focus(); await page.keyboard.press("Enter");
  assert.equal(await objectLast.evaluate(node => node === document.activeElement), true);
  assert.equal(await objectLast.getAttribute("aria-disabled"), "true");
  const lastLabel = await page.locator(".navigator-object").last().getAttribute("aria-label"); assert.match(lastLabel, /object 2000 of 2000/);
  const lastPageMs = Math.round(performance.now() - lastStart);
  await page.screenshot({ path: join(out, "objects-desktop.png") });
  await page.locator(".navigator-object").last().click();
  assert.match(await page.locator(".report-page-node[aria-current='page']").getAttribute("aria-label"), /page 100:/);
  assert.match(await page.locator(".canvas-element.selected").innerText(), /Synthetic insight 2000:/);
  await open(); await page.getByRole("button", { name: "Find objects", exact: true }).click();
  await page.getByLabel("Visibility", { exact: true }).selectOption("hidden"); assert.match(await page.locator(".navigator-count").innerText(), /of 100/);
  await page.getByLabel("Object type", { exact: true }).selectOption("text"); assert.equal(await page.locator(".navigator-object").count(), 0);
  await page.getByLabel("Object type", { exact: true }).selectOption("shape"); assert.equal(await page.locator(".navigator-object").count(), 25);
  await page.locator(".navigator-object").first().click();
  await page.locator('.report-page-group.active button[aria-label^="Show objects on page"]').click();
  const hiddenSelection = await page.locator('.report-page-object-select[aria-pressed="true"]').getAttribute("aria-label");
  assert.match(hiddenSelection, /object 20 on page 1:/); assert.match(hiddenSelection, /Hidden/);
  // The original quick-search handoff must also reach results beyond its first 20.
  const quickSearch = page.getByLabel("Search pages", { exact: true });
  await quickSearch.fill("Research note");
  assert.equal(await page.locator(".report-object-match").count(), 20);
  await page.getByRole("button", { name: "Browse all 2000 matching objects", exact: true }).click();
  assert.equal(await page.locator(".navigator-object").count(), 25);
  await page.locator(".navigator-object").nth(20).click();
  assert.match(await page.locator(".canvas-element.selected").innerText(), /Synthetic insight 21:/);
  await quickSearch.fill("");
  await open(); await page.getByRole("button", { name: "Find objects", exact: true }).click();
  await search.focus(); for (const key of ["Delete", "Backspace", "ArrowRight", "Control+d", "Control+z"]) await page.keyboard.press(key);
  await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: join(out, "narrow.png") });
  const narrowOverflow = await page.getByRole("dialog").evaluate(node => ({ scroll: node.scrollWidth, client: node.clientWidth })); assert.ok(narrowOverflow.scroll <= narrowOverflow.client + 1);
  await page.getByRole("button", { name: "Object results pagination: last", exact: true }).click(); await page.screenshot({ path: join(out, "narrow-results.png") });
  await page.setViewportSize({ width: 1280, height: 900 });
  const zoomBefore = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio }));
  const zoom = await worker.evaluate(async () => {
    const tabs = await chrome.tabs.query({ url: "http://127.0.0.1/*" });
    await chrome.tabs.setZoom(tabs[0].id, 2); return chrome.tabs.getZoom(tabs[0].id);
  }); assert.equal(zoom, 2);
  await page.waitForFunction(() => innerWidth === 640 && innerHeight === 450 && devicePixelRatio === 2);
  const zoomAfter = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio }));
  assert.deepEqual(zoomAfter, { width: 640, height: 450, dpr: 2 });
  await page.getByRole("button", { name: "Object results pagination: first", exact: true }).click();
  await page.getByRole("dialog").evaluate(node => { node.scrollTop = 0; });
  await page.screenshot({ path: join(out, "native-zoom-200.png") });
  await page.getByRole("button", { name: "Object results pagination: last", exact: true }).click();
  await page.screenshot({ path: join(out, "native-zoom-200-results.png") });
  const zoomOverflow = await page.getByRole("dialog").evaluate(node => ({ scroll: node.scrollWidth, client: node.clientWidth })); assert.ok(zoomOverflow.scroll <= zoomOverflow.client + 1);
  const ax = await (await context.newCDPSession(page)).send("Accessibility.getFullAXTree");
  const unnamed = ax.nodes.filter(node => !node.ignored && ["button", "combobox", "searchbox"].includes(node.role?.value) && !node.name?.value);
  assert.equal(unnamed.length, 0);
  await writeFile(join(out, "accessibility-tree.txt"), await page.getByRole("dialog").ariaSnapshot());
  await page.keyboard.press("Escape"); assert.equal(await page.locator(".report-browse-button").evaluate(node => node === document.activeElement), true);
  assert.deepEqual(await readState(), before); assert.deepEqual(errors, []); assert.deepEqual(apiRequests, []); assert.deepEqual(externalRequests, []);
  const results = { browser: context.browser().version(), fixture: { pages: 100, objects: 2001, searchMatches: 2000 }, sidebarPreviews, desktopPreviews, maxObjectResults: 25, quickSearchHandoffBeyond20: true, keyboardPaginationRetainsBoundaryFocus: true, openMs, warmOpenMs, searchMs, lastPageMs, lastLabel, hiddenSelection, narrowOverflow, zoom, zoomBefore, zoomAfter, zoomOverflow, unnamedAccessibleControls: unnamed.length, unchanged: { draft: true, datasets: true, snapshots: true }, errors, apiRequests, externalRequests };
  await writeFile(join(out, "browser-results.json"), JSON.stringify(results, null, 2) + "\n");
  console.log(JSON.stringify(results, null, 2));
} catch (error) {
  if (page) await page.screenshot({ path: join(out, "failure.png") }).catch(() => {});
  throw error;
} finally {
  await context?.close(); await server.close(); await rm(temporary, { recursive: true, force: true });
}
