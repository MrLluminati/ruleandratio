import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:https';
import {DatabaseSync} from 'node:sqlite';
import {chromium} from 'playwright';
import {makeWorker} from '../studio/auth-worker.mjs';

if(process.env.RR_TEST_BROWSER!=='1'&&!process.argv.includes('--run')){
 console.log('Studio browser tests skipped (opt in with npm run test:studio:browser).');
 process.exit(0);
}
const tmp=mkdtempSync(join(tmpdir(),'rr-browser-'));
const sql=new DatabaseSync(':memory:');
const servers=[];
let browser;
const now=1700000000;
const token='a'.repeat(64);
const hash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))).toString('hex');
let site,issuer,workspace='false',providerCalls=0,postOrigin,providerReferrer;
try{
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(tmp,'key.pem'),'-out',join(tmp,'cert.pem'),'-days','1','-subj','/CN=localhost'],{stdio:'ignore'});
 const tls={key:readFileSync(join(tmp,'key.pem')),cert:readFileSync(join(tmp,'cert.pem'))};
 const listen=async handler=>{
  const server=createServer(tls,handler);servers.push(server);
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
  return 'https://127.0.0.1:'+server.address().port;
 };
 for(const name of ['0001_identity_and_editorial.sql','0002_authentication.sql','0003_editorial_workspace.sql','0004_editorial_generation.sql','0005_member_workspace.sql','0006_billing_sandbox.sql','0007_current_review.sql'])sql.exec(readFileSync(new URL('../studio/migrations/'+name,import.meta.url),'utf8'));
 const DB={prepare(query){return {bind(...args){return {first:async()=>sql.prepare(query).get(...args)??null,all:async()=>({results:sql.prepare(query).all(...args)}),run:async()=>sql.prepare(query).run(...args)}}}}};
 sql.prepare('INSERT INTO member_profiles(id,issuer,subject,created_at) VALUES (?,?,?,?)').run('m','synthetic','synthetic',now);
 const createSession=()=>sql.prepare('INSERT INTO member_sessions(token_hash,member_id,created_at,expires_at) VALUES (?,?,?,?)').run(hash,'m',now,now+600);
 const worker=makeWorker({clock:()=>now,diagnostic:()=>{}});
 // Both HTTPS origins are loopback-only, with a disposable certificate and synthetic data.
 issuer=await listen((req,res)=>{
  const u=new URL(req.url,issuer);
  if(u.pathname!=='/oidc/logout'||u.searchParams.get('post_logout_redirect_uri')!==site+'/'){res.writeHead(400).end();return}
  providerCalls++;providerReferrer=req.headers.referer;
  res.writeHead(303,{location:site+'/','referrer-policy':'no-referrer'}).end();
 });
 site=await listen(async(req,res)=>{
  try{
   const chunks=[];for await(const chunk of req)chunks.push(chunk);
   if(req.method==='POST')postOrigin=req.headers.origin;
   const request=new Request(new URL(req.url,site),{method:req.method,headers:req.headers,...(req.method==='POST'?{body:Buffer.concat(chunks)}:{})});
   const result=await worker.fetch(request,{DB,APP_MODE:'member',APP_ORIGIN:site,MEMBER_ISSUER:issuer+'/',MEMBER_CLIENT_ID:'synthetic',MEMBER_CLIENT_SECRET:'synthetic',PUBLIC_SITE_ORIGIN:'https://public.example.invalid',MEMBER_WORKSPACE_ENABLED:workspace,BILLING_MODE:'disabled'});
   const headers=Object.fromEntries(result.headers);delete headers['set-cookie'];
   const cookies=result.headers.getSetCookie();if(cookies.length)headers['set-cookie']=cookies;
   res.writeHead(result.status,headers).end(Buffer.from(await result.arrayBuffer()));
  }catch{res.writeHead(500).end()}
 });
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({ignoreHTTPSErrors:true});
 const page=await context.newPage();
 page.setDefaultTimeout(15000);
 for(const mode of ['false','true']){
  workspace=mode;createSession();
  await context.addCookies([{name:'__Host-rr-member',value:token,url:site+'/',secure:true,httpOnly:true,sameSite:'Lax'}]);
  await page.goto(site+'/');
  if(mode==='true'){
   await page.getByRole('link',{name:'Edit profile'}).click();
   await page.getByLabel('Display name').fill('Browser fixture');
   await page.getByRole('button',{name:'Save profile'}).click();
   await page.waitForLoadState();
   assert.equal(postOrigin,site);
   assert.equal(sql.prepare("SELECT display_name FROM member_profiles WHERE id='m'").get().display_name,'Browser fixture');
   await page.goto(site+'/account');
  }
  const before=providerCalls;
  await Promise.all([page.waitForResponse(r=>r.url().startsWith(issuer+'/oidc/logout')&&r.status()===303),page.getByRole('button',{name:'Sign out'}).click()]);
  await page.getByRole('heading',{name:'Member account',exact:true}).waitFor();
  assert.equal(postOrigin,site);
  assert.equal(providerCalls,before+1);
  assert.equal(providerReferrer,undefined);
  assert.equal(sql.prepare('SELECT COUNT(*) n FROM member_sessions').get().n,0);
  assert.equal((await context.request.get(site+'/api/session')).status(),401);
 }
 await context.close();
 console.log('Studio Chromium tests passed: native same-origin profile/logout POST, OIDC redirect, referrer suppression and session revocation.');
}finally{
 if(browser)await browser.close();
 for(const server of servers)await new Promise(resolve=>server.close(resolve));
 sql.close();rmSync(tmp,{recursive:true,force:true});
}
