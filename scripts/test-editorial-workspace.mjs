import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {editorialRoute,inspectDraft} from '../studio/editorial-workspace.mjs';
const site='https://admin.example.invalid';
const raw='---\ntitle: Synthetic note\ndescription: Test only\nslug: test-note\ntype: education\nareas: [msme-law]\nauthor: Synthetic author\njurisdiction: TEST ONLY\ndraft: true\nsources:\n  - title: Synthetic source\n    url: https://example.invalid/law\n    kind: primary\n    pinpoint: Section 1\n---\n## Test\n\n<script>alert(1)</script>\n';
test('draft source guard',async()=>{
 const d=await inspectDraft('article',raw);assert.equal(d.sources.length,1);
 await assert.rejects(()=>inspectDraft('article',raw.replace('draft: true','draft: false')));
 await assert.rejects(()=>inspectDraft('article',raw.replace('https://example.invalid/law','javascript:alert(1)')));
});
test('private workflow: assignments, immutable revisions, stale writes, review, reopening and audit',async()=>{
 const sql=new DatabaseSync(':memory:');
 for(const file of ['0001_identity_and_editorial.sql','0002_authentication.sql','0003_editorial_workspace.sql','0004_editorial_generation.sql','0007_current_review.sql'])sql.exec(readFileSync(new URL('../studio/migrations/'+file,import.meta.url),'utf8'));
 const DB={prepare(query){return {bind(...args){return {first:async()=>sql.prepare(query).get(...args)??null,all:async()=>({results:sql.prepare(query).all(...args)}),run:async()=>sql.prepare(query).run(...args)}}}},async batch(statements){sql.exec('BEGIN');try{for(const s of statements)await s.run();sql.exec('COMMIT')}catch(e){sql.exec('ROLLBACK');throw e}}};
 const actors={};for(const role of ['owner','admin','author','reviewer']){actors[role]={id:role,role,status:'active',kind:'staff'};sql.prepare("INSERT INTO staff_accounts(id,issuer,subject,role,status,created_at) VALUES (?,?,?,?,?,?)").run(role,'issuer',role,role,'active',1)}
 const call=(p,actor,body,origin=site)=>editorialRoute(new Request(site+p,body?{method:'POST',headers:{origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body)}:{}),DB,actor,1700000000);
 const doc=()=>sql.prepare('SELECT * FROM editorial_documents').get();
 const version=()=>({hash:doc().current_revision_hash,plan:doc().review_plan_hash,status:doc().status,generation:String(doc().generation)});
 try{
  assert.equal((await call('/studio',{kind:'member',id:'m',status:'active'})).status,403);
  assert.equal((await call('/studio/create',actors.author,{kind:'article',raw})).status,403);
  assert.equal((await call('/studio/create',actors.owner,{kind:'article',raw},'https://other.invalid')).status,403);
  const made=await call('/studio/create',actors.owner,{kind:'article',raw,issues:'Verify savings'});assert.equal(made.status,303);
  const p=made.headers.get('location');assert.equal((await call(p,actors.author)).status,404);
  assert.equal((await call(p+'/assign',actors.owner,{...version(),staffId:'author',operation:'grant'})).status,303);
  assert.equal((await call(p+'/assign',actors.owner,{...version(),staffId:'reviewer',operation:'grant'})).status,303);
  const preview=await (await call(p,actors.author)).text();assert.ok(preview.includes('&lt;script&gt;'));assert.ok(!preview.includes('<script>'));
  assert.equal((await call(p+'/edit',actors.reviewer,{...version(),raw:raw+'Change'})).status,403);
  const stale=version();assert.equal((await call(p+'/edit',actors.author,{...stale,raw:raw+'Change'})).status,303);
  assert.equal((await call(p+'/edit',actors.author,{...stale,raw:raw+'Other'})).status,409);
  assert.equal(sql.prepare('SELECT COUNT(*) n FROM editorial_revisions').get().n,2);
  assert.equal((await call(p+'/submit',actors.author,version())).status,303);
  const basic={...version(),reviewerName:'Synthetic reviewer',summary:'Verified for test',confirm:'yes',decision:'approved'};
  assert.equal((await call(p+'/review',actors.author,basic)).status,403);
  assert.equal((await call(p+'/review',actors.reviewer,basic)).status,422);
  const plan=JSON.parse(doc().review_plan_json),draft=await inspectDraft('article',raw+'Change');
  for(let i=0;i<plan.length;i++){basic['check-'+i]='yes';basic['check-note-'+i]='Evidence'}
  for(const s of draft.sources){basic['source-'+s.key]='yes';basic['source-note-'+s.key]='Evidence'}
  assert.equal((await call(p+'/review',actors.reviewer,basic)).status,303);assert.equal(doc().status,'approved');
  assert.equal((await call(p+'/candidate',actors.reviewer,{...version(),publicCopy:'yes'})).status,403);
  assert.equal((await call(p+'/candidate',actors.owner,version())).status,403);
  const exported=await call(p+'/candidate',actors.owner,{...version(),publicCopy:'yes'});
  assert.equal(exported.status,200);assert.match(exported.headers.get('content-disposition'),/test-note\.md/);
  const candidate=await exported.text();assert.match(candidate,/draft: false/);assert.match(candidate,/reviewer: Synthetic reviewer/);assert.ok(!candidate.includes('Verified for test'));
  assert.equal((await call(p+'/edit',actors.owner,{...version(),raw:raw+'Edit locked'})).status,403);
  assert.equal((await call(p+'/reopen',actors.owner,{...version(),reason:'Correction'})).status,303);assert.equal(doc().status,'draft');
  assert.equal((await call(p+'/candidate',actors.owner,{...version(),publicCopy:'yes'})).status,403);
  assert.equal((await call(p+'/submit',actors.author,version())).status,303);
  assert.equal((await call(p+'/review',actors.reviewer,basic)).status,409,'Earlier review form must fail after reopening and resubmission');
  sql.exec("UPDATE staff_accounts SET status='disabled' WHERE id='author'");
  assert.equal((await call(p+'/edit',actors.author,{...version(),raw:raw+'Disabled'})).status,409);
  assert.equal(sql.prepare('SELECT COUNT(*) n FROM editorial_reviews').get().n,1);
  assert.equal(sql.prepare('SELECT COUNT(*) n FROM publication_requests').get().n,0);
  assert.equal(sql.prepare('SELECT COUNT(*) n FROM studio_mutation_guards').get().n,0);
  assert.ok(sql.prepare('SELECT COUNT(*) n FROM audit_events').get().n>=7);
 }finally{sql.close()}
});
