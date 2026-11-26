import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createReadStream,statSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
const contentTypes={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json','.wasm':'application/wasm'};
export async function testSearch(){
 const root=resolve('dist');
 const server=createServer((req,res)=>{
  try{
   const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
   let file=resolve(root,'.'+path);
   if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403).end();return}
   if(statSync(file).isDirectory())file=resolve(file,'index.html');
   const stat=statSync(file);
   res.writeHead(200,{'Content-Type':contentTypes[extname(file)]||'application/octet-stream','Content-Length':stat.size});
   createReadStream(file).pipe(res);
  }catch{res.writeHead(404).end('Not found')}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const host='http://127.0.0.1:'+server.address().port;
  await page.goto(host+'/search/?q='+encodeURIComponent('RR TEST REVISED TEXT')+'&type=Provision&subject='+encodeURIComponent('MSME law'));
  await page.locator('#search-results a[href="/bare-acts/acts/rr-test-act/provisions/section-1/"]').waitFor({timeout:30000});
  assert.equal(await page.locator('#search-results a').count(),1);
  await page.goto(host+'/search/?q='+encodeURIComponent('RR TEST ARTICLE')+'&type='+encodeURIComponent('Research & analysis'));
  await page.locator('#search-results a[href="/research/rr-test-article/"]').waitFor({timeout:30000});
  await page.goto(host+'/search/?q='+encodeURIComponent('rrhiddenquartzxylophone'));
  await page.waitForFunction(()=>{const t=document.querySelector('#search-status')?.textContent??'';return t.startsWith('No matching results')||/^\d+ results?/.test(t)||t.startsWith('Unable')||t.startsWith('Search is unavailable')});
  const searchStatus=await page.locator('#search-status').innerText();
  assert.ok(!searchStatus.startsWith('Unable')&&!searchStatus.startsWith('Search is unavailable'),searchStatus);
  // Check actual index membership instead of assuming unmatched queries never yield other results.
  const indexed=await page.evaluate(async()=>{
   const pf=await import('/pagefind/pagefind.js');
   const result=await pf.search(null);
   return Promise.all(result.results.map(async hit=>{const data=await hit.data();return {url:data.url,content:data.content,excerpt:data.excerpt,title:data.meta?.title}}));
  });
  assert.ok(indexed.length>0,'The index must contain reviewed content');
  assert.ok(indexed.some(hit=>hit.url.includes('/research/rr-test-article/')),'Reviewed fixture missing from index');
  for(const hit of indexed){
   assert.ok(!hit.url.includes('rr-test-hidden'),'Draft route present in index');
   assert.doesNotMatch([hit.content,hit.excerpt,hit.title].join(' '),/rrhiddenquartzxylophone|RR TEST HIDDEN DRAFT/i);
  }
  assert.equal(await page.locator('#search-results a[href*="rr-test-hidden"]').count(),0);
  console.log('Draft query status: '+searchStatus+'; checked '+indexed.length+' indexed pages for draft leakage.');
  const missing=await page.goto(host+'/research/rr-test-hidden/');
  assert.equal(missing.status(),404);
  for(const width of [390,768,1024,1180]){
   await page.setViewportSize({width,height:844});
   await page.goto(host+'/');
   const toggle=page.locator('.mobile-menu-toggle');
   const drawer=page.locator('#rr-mobile-menu');
   await toggle.waitFor({state:'visible'});
   assert.ok(!(await page.locator('.editorial-nav').isVisible()),'Desktop nav visible at '+width);
   assert.ok(await page.locator('.mobile-search-link').isVisible());
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Homepage overflow at '+width);
   await toggle.click();
   await drawer.waitFor({state:'visible'});
   assert.equal(await toggle.getAttribute('aria-expanded'),'true');
   assert.ok(await drawer.locator('a[href="/judgments/"]').isVisible());
   assert.ok(await drawer.locator('a[href="/journal/"]').isVisible());
   assert.ok(await page.evaluate(()=>document.documentElement.classList.contains('rr-menu-open')));
   await page.keyboard.press('Escape');
   await drawer.waitFor({state:'hidden'});
   await page.waitForFunction(()=>document.querySelector('.mobile-menu-toggle')?.getAttribute('aria-expanded')==='false'&&!document.documentElement.classList.contains('rr-menu-open'));
   assert.equal(await toggle.getAttribute('aria-expanded'),'false');
   assert.ok(await toggle.evaluate(el=>document.activeElement===el));
   await toggle.click();
   await drawer.locator('.mobile-menu-close').click();
   await drawer.waitFor({state:'hidden'});
   await page.waitForFunction(()=>document.querySelector('.mobile-menu-toggle')?.getAttribute('aria-expanded')==='false');
   await toggle.click();
   await drawer.locator('a[href="/judgments/"]').click();
   await page.waitForURL('**/judgments/');
   await page.locator('.mobile-menu-toggle').click();
   assert.equal(await page.locator('#rr-mobile-menu a[href="/judgments/"]').getAttribute('aria-current'),'page');
   await page.setViewportSize({width:1366,height:900});
   await page.locator('#rr-mobile-menu').waitFor({state:'hidden'});
   assert.ok(await page.locator('.editorial-nav').isVisible());
   assert.ok(!(await page.locator('.mobile-menu-toggle').isVisible()));
   await page.waitForFunction(()=>!document.documentElement.classList.contains('rr-menu-open'));
  }
  await page.setViewportSize({width:390,height:844});
  await page.goto(host+'/');
  await page.locator('.mobile-menu-toggle').click();
  await page.locator('#rr-mobile-menu').waitFor({state:'visible'});
  await page.mouse.click(385,400);
  await page.locator('#rr-mobile-menu').waitFor({state:'hidden'});
  console.log('Responsive navigation tests passed: phone, tablets, desktop, menu links, Escape, close, backdrop and resizing.');

  await page.goto(host+'/tools/');
  await page.locator('a[href="/tools/interest-calculator/"]').click();
  await page.locator('#interest-form').waitFor({state:'visible'});
  await page.locator('[name="start"]').fill('2025-01-01');
  await page.locator('[name="end"]').fill('2026-01-01');
  await page.locator('#interest-form button[type="submit"]').click();
  assert.equal(await page.locator('#total-amount').innerText(),'₹1,12,000.00');
  await page.locator('[name="method"][value="compound"]').check();
  assert.ok(await page.locator('#frequency-field').isVisible());
  assert.ok(!(await page.locator('#interest-result').isVisible()));
  await page.locator('#interest-form button[type="submit"]').click();
  assert.equal(await page.locator('#total-amount').innerText(),'₹1,12,682.50');
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#download-result').click()]);
  assert.equal(download.suggestedFilename(),'rule-and-ratio-interest-estimate.txt');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile calculator overflow');
  await page.locator('[name="end"]').fill('2024-01-01');
  await page.locator('#interest-form button[type="submit"]').click();
  assert.match(await page.locator('#interest-status').innerText(),/must not precede/);
  assert.ok(!(await page.locator('#interest-result').isVisible()));
  console.log('Interest calculator browser checks passed.');
  await page.goto(host+'/tools/msme-interest-calculator/');
  await page.locator('#msme-form').waitFor({state:'visible'});
  await page.locator('[name="asOf"]').fill('2025-01-27');
  await page.locator('#invoice-list [data-field="amount"]').fill('100000');
  await page.locator('#invoice-list [data-field="acceptance"]').fill('2025-01-01');
  await page.locator('#rate-list [data-field="from"]').fill('2025-01-01');
  await page.locator('#rate-list [data-field="to"]').fill('2026-01-01');
  await page.locator('#rate-list [data-field="rate"]').fill('6');
  await page.locator('#rate-list [data-field="source"]').fill('Synthetic test rate only');
  await page.locator('#msme-form input[type="checkbox"]').check();
  await page.locator('#msme-form button[type="submit"]').click();
  assert.equal(await page.locator('#msme-interest').innerText(),'₹493.15');
  assert.equal(await page.locator('#msme-rows tr').count(),1);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'MSME calculator overflow');
  await page.locator('#rate-list [data-field="from"]').fill('2025-01-20');
  await page.locator('#msme-form button[type="submit"]').click();
  assert.match(await page.locator('#msme-status').innerText(),/Missing bank-rate coverage/);
  assert.ok(!(await page.locator('#msme-result').isVisible()));
  console.log('MSME estimator browser checks passed.');
  await page.goto(host+'/research/rr-test-article/');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile article overflow');
  console.log('Browser tests passed: provision full-text search, type/subject filters, draft exclusion, mobile layout overflow checks.');
 }finally{try{await browser?.close()}finally{await new Promise(resolve=>server.close(resolve))}}
}
