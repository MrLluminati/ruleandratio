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
  assert.match(await page.locator('#search-status').innerText(),/^No matching results/,'Unique draft-only search term must not be indexed');
  assert.equal(await page.locator('#search-results a').count(),0);
  await page.goto(host+'/research/rr-test-hidden/');
  assert.equal(await page.locator('body').innerText(),'Not found');
  await page.goto(host+'/');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile homepage overflow');
  await page.goto(host+'/research/rr-test-article/');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile article overflow');
  console.log('Browser tests passed: provision full-text search, type/subject filters, draft exclusion, mobile layout overflow checks.');
 }finally{try{await browser?.close()}finally{await new Promise(resolve=>server.close(resolve))}}
}
