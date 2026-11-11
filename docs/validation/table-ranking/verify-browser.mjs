import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const require=createRequire(join(process.cwd(),'package.json'));
const {createServer}=await import(pathToFileURL(require.resolve('vite')));
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const output=resolve('docs/validation/table-ranking'),tmp=await mkdtemp(join(tmpdir(),'table-ranking-'));
const server=await createServer({root:process.cwd(),server:{host:'127.0.0.1',port:5196,strictPort:true},logLevel:'error'});
let context,page;
try{
 const {tableExplorerFixture}=await server.ssrLoadModule('/src/features/builder/components/__tests__/tableExplorerFixture.ts');
 const persistence=await server.ssrLoadModule('/src/features/document/workspacePersistence.ts');
 const {draft,tile,dataset}=await tableExplorerFixture();
 const columns=Array.from({length:40},(_,i)=>({id:`col-${i}`,label:`Comparison ${i}`}));
 tile.result.columns=columns;tile.result.table=Array.from({length:1000},(_,i)=>({optionId:`row-${i}`,label:`Answer ${String(i).padStart(4,'0')}`,values:Object.fromEntries(columns.map((c,j)=>[c.id,i-j/10])),bases:Object.fromEntries(columns.map(c=>[c.id,1000]))}));tile.result.annotations=[];
 const workspace=persistence.normalizeDashboardWorkspace({reports:[persistence.createReportRecord(draft)],importedDatasets:[dataset]});let payload;globalThis.window={localStorage:{setItem:(_k,v)=>{payload=v;}}};try{assert.equal(persistence.saveDashboardWorkspace(workspace),true);}finally{delete globalThis.window;}
 await server.listen();const extension=join(tmp,'extension');await mkdir(extension);await writeFile(join(extension,'manifest.json'),JSON.stringify({manifest_version:3,name:'Local zoom validation',version:'1.0',permissions:['tabs'],background:{service_worker:'background.js'}}));await writeFile(join(extension,'background.js'),'chrome.runtime.onInstalled.addListener(() => {});');
 context=await chromium.launchPersistentContext(join(tmp,'profile'),{headless:true,viewport:{width:1600,height:1000},...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),ignoreDefaultArgs:['--disable-extensions'],args:['--no-sandbox',`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
 const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');const requests=[],errors=[];await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.hostname==='127.0.0.1'&&url.port==='5196'&&!url.pathname.startsWith('/.netlify/functions/'))return route.continue();requests.push(url.href);return route.abort();});
 await context.addInitScript(seed=>{if(!sessionStorage.getItem('table-seed')){localStorage.setItem(seed.key,seed.payload);sessionStorage.setItem('table-seed','1');}},{key:persistence.workspaceStorageKey,payload});page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:5196/#/reports/${draft.id}`);await page.locator('.table-browser-controls button').waitFor();
 await page.waitForTimeout(1500);const readState=()=>page.evaluate(async()=>{const {loadDashboardWorkspace}=await import('/src/features/document/workspacePersistence.ts');const w=loadDashboardWorkspace();return {draft:w.reports[0].draft,datasets:w.importedDatasets,snapshots:w.publishedSnapshots};});const original=await readState();const begin=performance.now();await page.getByRole('button',{name:'Explore complete table'}).click();const dialog=page.getByRole('dialog');await dialog.waitFor();const openMs=Math.round(performance.now()-begin);
 assert.match(await dialog.innerText(),/1,000 recorded answers × 40 columns/);assert.equal(await dialog.locator('tbody tr').count(),25);assert.equal(await dialog.locator('tbody tr:first-child td').count(),8);
 await dialog.getByLabel('Sort by').selectOption('column:col-39');await dialog.getByLabel('Sort direction').selectOption('desc');assert.match(await dialog.locator('tbody tr:first-child th').innerText(),/Answer 0999/);
 await dialog.getByLabel('Pin comparison column 1').selectOption('col-0');await dialog.getByLabel('Pin comparison column 2').selectOption('col-39');await dialog.getByRole('button',{name:'Last columns'}).click();assert.ok(await dialog.locator('tbody tr:first-child td').count()<=8);assert.match(await dialog.locator('thead').innerText(),/col-0/i);assert.match(await dialog.locator('thead').innerText(),/col-39/i);
 await dialog.getByLabel('Filter column').selectOption('col-39');await dialog.getByLabel(/^Minimum/).fill('995');await dialog.getByRole('button',{name:'Apply row filter'}).click();assert.match(await dialog.innerText(),/Active filter/);await dialog.getByLabel('Pin comparison column 1').scrollIntoViewIfNeeded();await page.screenshot({path:join(output,'ranked.png')});await dialog.getByLabel(/^Minimum/).fill('bad');await dialog.getByRole('button',{name:'Apply row filter'}).click();assert.match(await dialog.innerText(),/valid bounds/);
 await dialog.getByRole('button',{name:'Clear table searches and return to first pages'}).click();await page.screenshot({path:join(output,'desktop.png')});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:join(output,'narrow.png')});const narrow=await dialog.evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth}));assert.ok(narrow.scroll<=narrow.client+1);
 await page.setViewportSize({width:1280,height:900});await worker.evaluate(async()=>{const [tab]=await chrome.tabs.query({url:'http://127.0.0.1/*'});await chrome.tabs.setZoom(tab.id,2);});await page.waitForFunction(()=>innerWidth===640&&devicePixelRatio===2);await page.screenshot({path:join(output,'zoom-200.png')});const zoom=await dialog.evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth}));assert.ok(zoom.scroll<=zoom.client+1);
 await dialog.getByLabel('Sort by').focus();await page.keyboard.press('Tab');assert.ok(await dialog.evaluate(el=>el.contains(document.activeElement)));await page.keyboard.press('Escape');assert.equal(await dialog.count(),0);assert.equal(await page.locator('.table-browser-controls button').evaluate(el=>el===document.activeElement),true);
 assert.deepEqual(await readState(),original);assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);
 const results={browser:context.browser().version(),rows:1000,columns:40,mountedRows:25,mountedColumns:8,openMs,narrow,zoom,requests,errors};await writeFile(join(output,'results.json'),JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results));
}finally{if(context)await context.close();await server.close();await rm(tmp,{recursive:true,force:true});}
