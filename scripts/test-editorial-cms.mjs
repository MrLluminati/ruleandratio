import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {createCMS} from './editorial-cms.mjs';
const draft='---\ntitle: Synthetic CMS fixture\ndescription: Test only\nslug: cms-test\ntype: education\nareas: [general]\njurisdiction: TEST ONLY\nauthor: Test author\ndraft: true\nsources:\n  - title: Synthetic source\n    url: https://example.invalid/source\n    kind: primary\n    pinpoint: Test paragraph\n---\n# Test\n\n<script>alert(1)</script>\n';
test('loopback CMS security, draft edits, review, bulk and publication preparation',async()=>{
 const root=mkdtempSync(join(tmpdir(),'rr-cms-')),path='src/content/articles/test.md';
 const put=(p,value)=>{const f=join(root,p);mkdirSync(dirname(f),{recursive:true});writeFileSync(f,value)};
 put(path,draft);
 const cms=createCMS(root,0),origin=await cms.start();
 try{
  const html=await (await fetch(origin)).text(),token=html.match(/name="rr-session" content="([a-f0-9]+)"/)[1];
  assert.equal((await fetch(origin+'/cms.js')).status,200);
  assert.equal((await fetch(origin+'/cms.css')).status,200);
  const request=async(action,fields={},headers={})=>{const r=await fetch(origin+'/api',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-RR-Session':token,...headers},body:JSON.stringify({action,...fields})});return {status:r.status,data:await r.json()}};
  assert.equal((await request('queue',{}, {'X-RR-Session':'bad'})).status,403);
  assert.equal((await request('queue',{}, {Origin:'https://attacker.invalid'})).status,403);
  assert.equal((await request('queue')).data.counts.queued,1);
  const id='article-cms-test',d=(await request('detail',{id})).data;
  assert.ok(d.preview.includes('&lt;script&gt;'));assert.ok(!d.preview.includes('<script>'));
  assert.equal((await request('save',{id,hash:d.item.sha256,raw:draft.replace('draft: true','draft: false')})).status,400);
  assert.equal((await request('save',{id,hash:'wrong',raw:draft})).status,409);
  assert.deepEqual((await request('bulk',{ids:[id]})).data,{created:1,skipped:0});
  assert.deepEqual((await request('bulk',{ids:[id]})).data,{created:0,skipped:1});
  let reviewed=(await request('detail',{id})).data;
  const bad={...reviewed.record,decision:'approved'};
  assert.equal((await request('review',{id,hash:d.item.sha256,record:bad,recordHash:reviewed.recordHash})).status,422);
  const updated=(await request('save',{id,hash:d.item.sha256,raw:draft+'\nEdited.\n'})).data;
  assert.equal(updated.state.status,'stale');
  const reset=(await request('reset',{id,hash:updated.item.sha256})).data;
  const rec=reset.record;rec.decision='approved';rec.reviewer='Synthetic test reviewer';rec.reviewedAt='2020-01-01';rec.note='Test only';
  for(const k of Object.keys(rec.checks))rec.checks[k]=true;
  for(const s of Object.values(rec.sources)){s.verified=true;s.note='Synthetic verification'}
  const approved=await request('review',{id,hash:updated.item.sha256,record:rec,recordHash:reset.recordHash});
  assert.equal(approved.status,200);assert.equal(approved.data.state.status,'ready');
  const candidate=await request('prepare',{id,hash:updated.item.sha256,date:'2020-01-02'});
  assert.equal(candidate.status,200);assert.ok(existsSync(join(root,candidate.data.path)));assert.match(readFileSync(join(root,path),'utf8'),/draft: true/);
  assert.equal((await request('links',{id,hash:updated.item.sha256,change:{kind:'statute',action:'add',act:'missing'}})).status,400);
  assert.equal((await request('import',{path:'../../secret'})).status,400);
 }finally{await new Promise(resolve=>cms.server.close(resolve));rmSync(root,{recursive:true,force:true})}
});
