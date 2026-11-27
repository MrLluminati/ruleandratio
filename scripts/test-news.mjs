import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateLead,validateNewsRegistry,validDay} from '../src/lib/news.mjs';
const registry=JSON.parse(readFileSync(new URL('../src/data/news-sources.json',import.meta.url),'utf8'));
const lead={id:'synthetic-lead',sourceId:'supreme-court',title:'Synthetic fixture',kind:'judicial-decision',eventDate:'2024-01-01',capturedOn:'2024-01-02',url:'https://example.invalid/fixture.pdf',areas:['general'],status:'unverified',notes:'Fixture only'};
test('news registry manual access only',()=>{assert.equal(validateNewsRegistry(registry).length,17);assert.throws(()=>validateNewsRegistry([...registry,registry[0]]));assert.throws(()=>validateNewsRegistry([{...registry[0],automatedAccess:true}]))});
test('news leads require valid dates, sources and document link',()=>{assert.equal(validateLead(lead,registry,'2024-01-03').sourceKind,'primary');assert.equal(validDay('2023-02-29'),false);for(const patch of [{sourceId:'unknown'},{url:'https://example.invalid/'},{eventDate:'2024-02-01'},{status:'verified'},{kind:'unknown'},{id:'../bad'}])assert.throws(()=>validateLead({...lead,...patch},registry,'2024-01-03'))});
