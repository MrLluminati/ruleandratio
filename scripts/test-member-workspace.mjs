import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {makeWorker} from '../studio/auth-worker.mjs';
import {memberRoute} from '../studio/member-workspace.mjs';
const now=1700000000,site='https://account.example.invalid',publicSite='https://www.example.invalid';
const tokenA='a'.repeat(64),tokenB='b'.repeat(64);
async function digest(s){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,'0')).join('')}
test('authenticated member workflow: profile ownership, bookmarks, collections, revocation and private premium body',async()=>{
 const sql=new DatabaseSync(':memory:');
 try{
  for(const file of ['0001_identity_and_editorial.sql','0002_authentication.sql','0003_editorial_workspace.sql','0004_editorial_generation.sql','0005_member_workspace.sql'])sql.exec(readFileSync(new URL('../studio/migrations/'+file,import.meta.url),'utf8'));
  const DB={prepare(query){return {bind(...args){return {first:async()=>sql.prepare(query).get(...args)??null,all:async()=>({results:sql.prepare(query).all(...args)}),run:async()=>sql.prepare(query).run(...args)}}}}};
  for(const [id,token] of [['a',tokenA],['b',tokenB]]){sql.prepare("INSERT INTO member_profiles(id,issuer,subject,created_at) VALUES (?,?,?,?)").run(id,'issuer',id,now);sql.prepare("INSERT INTO member_sessions(token_hash,member_id,created_at,expires_at) VALUES (?,?,?,?)").run(await digest(token),id,now,now+3600)}
  sql.exec("INSERT INTO member_content_catalog VALUES ('public-note','Public note','judgment','public','/judgments/public-note/','published'),('private-note','Premium note','research','premium',NULL,'published'),('withdrawn-note','Withdrawn','article','public','/articles/withdrawn/','withdrawn')");
  sql.exec("INSERT INTO member_premium_content VALUES ('private-note','SECRET-PREMIUM-TEXT <script>alert(1)</script>')");
  const worker=makeWorker({clock:()=>now}),env={DB,APP_MODE:'member',APP_ORIGIN:site,MEMBER_ISSUER:'https://test.auth0.com/',MEMBER_CLIENT_ID:'test',MEMBER_CLIENT_SECRET:'test',PUBLIC_SITE_ORIGIN:publicSite,MEMBER_WORKSPACE_ENABLED:'true'};
  const call=(p,token=tokenA,body,origin=site,override={})=>worker.fetch(new Request(site+p,{method:body?'POST':'GET',headers:{...(token?{cookie:'__Host-rr-member='+token}:{}),...(body?{origin,'content-type':'application/x-www-form-urlencoded'}:{})},...(body?{body:new URLSearchParams(body)}:{})}),{...env,...override});
  assert.equal((await call('/account',null)).status,401);
  assert.equal((await call('/account',tokenA,undefined,site,{MEMBER_WORKSPACE_ENABLED:'false'})).status,404);
  assert.equal((await call('/account',tokenA)).status,200);
  assert.equal((await call('/account/profile',tokenA,{displayName:'Reader A',profession:'advocate',role:'owner'})).status,400);
  assert.equal((await call('/account/profile',tokenA,{displayName:'Reader A',profession:'advocate'},'https://evil.invalid')).status,403);
  assert.equal((await call('/account/profile',tokenA,{displayName:'<script>Reader A</script>',profession:'advocate'})).status,303);
  assert.equal(sql.prepare("SELECT display_name FROM member_profiles WHERE id='b'").get().display_name,'');
  assert.ok((await (await call('/account')).text()).includes('&lt;script&gt;Reader A'));
  assert.equal((await call('/studio')).status,404);
  assert.equal((await call('/account/bookmarks',tokenA,{key:'public-note',operation:'add'})).status,303);
  await call('/account/bookmarks',tokenA,{key:'withdrawn-note',operation:'add'});
  await call('/account/bookmarks',tokenA,{key:'unknown',operation:'add'});
  await call('/account/bookmarks',tokenA,{key:'public-note',operation:'add'});
  assert.equal(sql.prepare("SELECT COUNT(*) n FROM member_bookmarks").get().n,1);
  assert.equal((await call('/account/collections',tokenA,{name:'My cases'})).status,303);
  const cid=sql.prepare('SELECT id FROM member_collections').get().id;
  assert.equal((await call('/account/collections/'+cid,tokenB)).status,404);
  assert.equal((await call('/account/collections/'+cid,tokenB,{operation:'delete',confirm:'yes'})).status,404);
  assert.equal((await call('/account/collections/'+cid,tokenA,{operation:'add',key:'public-note'})).status,303);
  assert.equal(sql.prepare('SELECT COUNT(*) n FROM member_collection_items').get().n,1);
  const free=await call('/account/research/private-note');
  assert.equal(free.status,403);assert.ok(!(await free.text()).includes('SECRET-PREMIUM-TEXT'));
  sql.prepare("INSERT INTO membership_entitlements VALUES ('g','a','premium-research',?,?,NULL,'synthetic')").run(now-1,now+60);
  const premium=await call('/account/research/private-note');assert.equal(premium.status,200);assert.match(premium.headers.get('cache-control'),/no-store/);
  const html=await premium.text();assert.ok(html.includes('SECRET-PREMIUM-TEXT'));assert.ok(!html.includes('<script>'));
  assert.equal((await call('/account/research/private-note',tokenB)).status,403);
  sql.exec("UPDATE membership_entitlements SET revoked_at=1700000000 WHERE id='g'");
  assert.equal((await call('/account/research/private-note')).status,403);
  sql.exec("UPDATE membership_entitlements SET revoked_at=NULL, valid_until=1700000000 WHERE id='g'");
  assert.equal((await call('/account/research/private-note')).status,403);
  sql.exec("UPDATE membership_entitlements SET valid_until=1700000060 WHERE id='g'; UPDATE member_content_catalog SET status='withdrawn' WHERE content_key='private-note'");
  assert.equal((await call('/account/research/private-note')).status,403);
  const library=await (await call('/account/library')).text();assert.ok(library.includes('https://www.example.invalid/judgments/public-note/'));assert.ok(!library.includes('SECRET-PREMIUM-TEXT'));
  assert.equal((await call('/account/collections/'+cid,tokenA,{operation:'delete',confirm:'yes'})).status,303);
  assert.equal(sql.prepare('SELECT COUNT(*) n FROM member_collection_items').get().n,0);
  sql.exec("UPDATE member_profiles SET status='suspended' WHERE id='a'");
  assert.equal((await call('/account')).status,401);
  assert.equal((await memberRoute(new Request(site+'/account'),DB,{id:'a',kind:'staff',role:'owner',status:'active'},await digest(tokenA),now,publicSite)).status,401);
 }finally{sql.close()}
});
