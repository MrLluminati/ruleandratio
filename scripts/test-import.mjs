import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {importStatute} from './import-statute.mjs';
const template={"slug":"synthetic-example","title":"Synthetic example — not legislation","jurisdiction":"TEST ONLY","areas":["general"],"mainSourceId":"sample","sources":[{"id":"sample","title":"Synthetic example source","url":"https://example.invalid/synthetic","file":"source.txt","capturedAt":"2020-01-01"}],"chapters":[{"slug":"chapter-one","label":"Chapter I","title":"Example"}],"provisions":[{"slug":"section-1","number":"1","kind":"section","heading":"Example","chapter":"chapter-one","versions":[{"id":"recorded","sourceId":"sample","startLine":1,"endLine":2,"pinpoint":"Synthetic lines 1–2"}]}],"amendments":[]};
function setup(fn){const d=mkdtempSync(join(tmpdir(),'rr-import-'));try{const m=structuredClone(template);const path=join(d,'manifest.json'),out=join(d,'output');writeFileSync(join(d,'source.txt'),'Synthetic text.\r\n  (1) Exact spacing.\r\nThird line.');const run=()=>{writeFileSync(path,JSON.stringify(m));return importStatute(path,out)};fn(m,run,out)}finally{rmSync(d,{recursive:true,force:true})}}
test('preserves extracted wording, records checksums, forces draft, refuses overwrite',()=>setup((m,run,out)=>{const r=run();assert.equal(r.draft.draft,true);assert.equal(r.draft.reviewer,undefined);assert.equal(r.draft.coverage,'selected-provisions');assert.equal(r.draft.provisions[0].versions[0].text,'Synthetic text.\n  (1) Exact spacing.');assert.match(r.report.sourceDocuments[0].sha256,/^[a-f0-9]{64}$/);assert.equal(r.report.extractions[0].startLine,1);assert.equal(JSON.parse(readFileSync(join(r.out,'review.json'))).state,'awaiting-human-review');assert.throws(run,/refusing to overwrite/)}));
test('rejects invalid boundaries without creating output',()=>setup((m,run,out)=>{m.provisions[0].versions[0].endLine=100;assert.throws(run,/Invalid source line range/);assert.equal(existsSync(out),false)}));
test('rejects attempted automatic publication',()=>setup((m,run)=>{m.draft=false;assert.throws(run,/drafts only/)}));
test('rejects fabricated reviewer metadata',()=>setup((m,run)=>{m.reviewer='Fake';assert.throws(run,/Editorial field/)}));
test('rejects unknown legal subjects and missing chapters',()=>setup((m,run)=>{m.areas=['unknown'];assert.throws(run,/Unknown area/);m.areas=['general'];m.provisions[0].chapter='missing';assert.throws(run,/Unknown chapter/)}));
test('rejects duplicate source ranges',()=>setup((m,run)=>{const p=structuredClone(m.provisions[0]);p.slug='section-2';p.number='2';m.provisions.push(p);assert.throws(run,/Overlapping extraction/)}));
test('rejects unknown amendment references',()=>setup((m,run)=>{m.provisions[0].versions[0].amendmentIds=['missing'];assert.throws(run,/Unresolved amendment/)}));
