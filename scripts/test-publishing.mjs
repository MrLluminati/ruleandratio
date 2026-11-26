import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {testSearch} from './test-search.mjs';
import {spawnSync} from 'node:child_process';

const root='src/content/articles';
const fixture=mkdtempSync(join(root,'rr-test-'));
const statuteFixture=join('src/content/statutes','rr-test-act.json');
assert.ok(!existsSync(statuteFixture),'Refusing to overwrite existing statute');
const statute={
  "slug": "rr-test-act",
  "title": "RR TEST STATUTE",
  "jurisdiction": "TEST ONLY",
  "areas": [
    "msme-law"
  ],
  "reviewer": "Synthetic test reviewer",
  "reviewedAt": "2020-01-02",
  "status": "uncertain",
  "source": {
    "title": "Synthetic statute source",
    "url": "https://example.invalid/act"
  },
  "coverage": "selected-provisions",
  "draft": false,
  "chapters": [
    {
      "slug": "chapter-one",
      "label": "Chapter I",
      "title": "Synthetic chapter"
    }
  ],
  "provisions": [
    {
      "slug": "section-1",
      "number": "1",
      "kind": "section",
      "heading": "Synthetic provision",
      "commentary": "RR TEST ORIGINAL COMMENTARY — fixture only.",
      "chapter": "chapter-one",
      "versions": [
        {
          "id": "original",
          "effectiveFrom": "2018-01-01",
          "effectiveUntil": "2019-01-01",
          "text": "RR TEST ORIGINAL TEXT",
          "source": {
            "title": "Original fixture",
            "url": "https://example.invalid/original"
          }
        },
        {
          "id": "revised",
          "effectiveFrom": "2019-01-01",
          "text": "RR TEST REVISED TEXT",
          "source": {
            "title": "Amendment fixture",
            "url": "https://example.invalid/amendment"
          },
          "amendmentIds": [
            "revision"
          ]
        }
      ]
    }
  ],
  "amendments": [
    {
      "slug": "revision",
      "title": "RR TEST AMENDMENT",
      "description": "Synthetic amendment, not law.",
      "effectiveDate": "2019-01-01",
      "source": {
        "title": "Amendment fixture",
        "url": "https://example.invalid/amendment"
      },
      "affectedProvisions": [
        "section-1"
      ]
    }
  ]
};
const npm=process.platform==='win32'?'npm.cmd':'npm';
const build=(launch=false)=>spawnSync(npm,['run','build'],{stdio:'inherit',shell:process.platform==='win32',env:{...process.env,PUBLIC_RR_INDEXING:launch?'true':'false',PUBLIC_RR_SITE_URL:launch?'https://example.invalid':''}});
function expectBuild(success,launch=false){
 const result=build(launch);
 if(result.error)throw result.error;
 if(result.status===null)throw new Error('Build terminated: '+result.signal);
 assert.equal(result.status===0,success,success?'Build must succeed':'Invalid publication must fail validation');
}
const html=path=>readFileSync(join('dist',path,'index.html'),'utf8');
const basic=(type,slug,title)=>`---
title: ${title}
description: Synthetic test content only
slug: ${slug}
type: ${type}
areas: [msme-law]
jurisdiction: TEST ONLY
author: Synthetic test author
reviewer: Synthetic test reviewer
publishedAt: 2020-01-02
reviewedAt: 2020-01-02
sources:
  - title: Synthetic test reference
    url: https://example.invalid/fixture
    kind: primary
    pinpoint: Test paragraph 1
draft: false
`;
try{
 writeFileSync(statuteFixture,JSON.stringify(statute));
 writeFileSync(join(fixture,'article.md'),basic('research','rr-test-article','RR TEST ARTICLE')+`statuteRefs:
  - act: rr-test-act
    provision: section-1
---
## Synthetic section

Fixture only, not legal information.

### Nested heading

Test article body.
`);
 writeFileSync(join(fixture,'judgment.md'),basic('judgment','rr-test-case','RR TEST CASE')+`judgment:
  caseName: Synthetic case, not a real judgment
  court: Synthetic court
  decisionDate: 2020-01-01
  caseNumber: TEST-ONLY
  judgmentUrl: https://example.invalid/fixture
---
## Test reasoning

Synthetic body; never publish.
`);
 writeFileSync(join(fixture,'hidden.md'),`---
title: RR TEST HIDDEN DRAFT
description: Synthetic draft
slug: rr-test-hidden
type: research
areas: [msme-law]
jurisdiction: TEST ONLY
author: Synthetic test author
draft: true
---
Not a public article. rrhiddenquartzxylophone
`);
 expectBuild(true);
 const article=html('research/rr-test-article');
 const judgment=html('judgments/rr-test-case');
 const home=html('');
 const hub=html('areas-of-law/msme-law');
 const act=html('bare-acts/acts/rr-test-act');
 const provision=html('bare-acts/acts/rr-test-act/provisions/section-1');
 const amendment=html('bare-acts/acts/rr-test-act/amendments/revision');
 assert.match(hub,/RR TEST ARTICLE/);
 assert.match(hub,/RR TEST CASE/);
 assert.match(hub,/RR TEST STATUTE/);
 assert.match(html('bare-acts'),/RR TEST STATUTE/);
 assert.ok(act.includes('/bare-acts/acts/rr-test-act/provisions/section-1/'));
 assert.ok(act.includes('/bare-acts/acts/rr-test-act/amendments/revision/'));
 assert.match(provision,/RR TEST ORIGINAL TEXT/);
 assert.match(provision,/RR TEST REVISED TEXT/);
 assert.match(provision,/RR TEST ORIGINAL COMMENTARY/);
 assert.ok(provision.includes('/research/rr-test-article/'));
 assert.ok(provision.includes('/bare-acts/acts/rr-test-act/amendments/revision/'));
 assert.ok(amendment.includes('/bare-acts/acts/rr-test-act/provisions/section-1/'));
 assert.ok(article.includes('/bare-acts/acts/rr-test-act/provisions/section-1/'));
 assert.ok(article.includes('/areas-of-law/msme-law/'));
 assert.ok(!existsSync('dist/bare-acts/acts/example-draft/index.html'));
 assert.match(article,/Synthetic test reviewer/);
 assert.match(article,/Synthetic test reference/);
 assert.match(article,/href="#synthetic-section"/);
 assert.match(article,/href="\/judgments\/rr-test-case\/"/);
 assert.match(judgment,/Synthetic court/);
 assert.match(judgment,/TEST-ONLY/);
 assert.match(judgment,/Read the judgment text/);
 assert.match(judgment,/href="\/research\/rr-test-article\/"/);
 assert.match(html('research'),/RR TEST ARTICLE/);
 assert.match(html('judgments'),/RR TEST CASE/);
 // Homepage shows at most six latest entries; fixture dates are intentionally historical.
 if(home.includes('RR TEST ARTICLE'))assert.match(home,/href="\/research\/rr-test-article\/"/);
 for(const page of [article,judgment,home,html('research')])assert.doesNotMatch(page,/RR TEST HIDDEN DRAFT/);
 assert.ok(!existsSync('dist/research/rr-test-hidden/index.html'));
 assert.ok(existsSync('dist/pagefind/pagefind.js'));
 assert.match(article,/noindex, follow/);
 assert.ok(!existsSync('dist/sitemap.xml'));
 assert.ok(!existsSync('dist/rss.xml'));
 if(process.env.RR_TEST_BROWSER==='1')await testSearch();
 expectBuild(true,true);
 const sitemap=readFileSync('dist/sitemap.xml','utf8');
 const rss=readFileSync('dist/rss.xml','utf8');
 const prodArticle=html('research/rr-test-article');
 assert.ok(sitemap.includes('https://example.invalid/research/rr-test-article/'));
 assert.ok(sitemap.includes('https://example.invalid/bare-acts/acts/rr-test-act/provisions/section-1/'));
 assert.ok(sitemap.includes('https://example.invalid/areas-of-law/msme-law/'));
 assert.ok(!sitemap.includes('/areas-of-law/legal-ethics/'));
 assert.ok(!sitemap.includes('/search/'));
 assert.ok(!sitemap.includes('rr-test-hidden'));
 assert.ok(rss.includes('https://example.invalid/research/rr-test-article/'));
 assert.ok(!rss.includes('rr-test-hidden'));
 assert.ok(!rss.includes('/bare-acts/acts/rr-test-act/'));
 assert.match(prodArticle,/https:\/\/example\.invalid\/research\/rr-test-article\//);
 assert.match(prodArticle,/application\/ld\+json/);
 assert.match(html('search'),/noindex, follow/);
 assert.match(html('areas-of-law/legal-ethics'),/noindex, follow/);
 assert.match(readFileSync('dist/robots.txt','utf8'),/Sitemap: https:\/\/example\.invalid\/sitemap\.xml/);
 // An unresolved reference must fail even if the article metadata is otherwise valid.
 writeFileSync(join(fixture,'broken-ref.md'),basic('research','rr-broken-ref','Broken reference fixture')+`statuteRefs:
  - act: rr-test-act
    provision: missing
---
Test only.
`);
 expectBuild(false);
 rmSync(join(fixture,'broken-ref.md'));
 // Overlapping effective intervals must fail.
 const invalidStatute=structuredClone(statute);
 invalidStatute.provisions[0].versions[0].effectiveUntil='2020-01-01';
 writeFileSync(statuteFixture,JSON.stringify(invalidStatute));
 expectBuild(false);
 writeFileSync(statuteFixture,JSON.stringify(statute));
 writeFileSync(join(fixture,'invalid.md'),`---
title: Invalid fixture
description: Missing required publication metadata
type: research
areas: [general]
jurisdiction: TEST ONLY
author: Synthetic test author
draft: false
---
Invalid publication.
`);
 expectBuild(false);
 console.log('Publication tests passed (routing, review metadata, citations, contents, related links, draft exclusion and invalid-entry rejection).');
}finally{
 rmSync(fixture,{recursive:true,force:true});
 rmSync(statuteFixture,{force:true});
 // Always discard synthetic output and restore a clean production build.
 rmSync('dist',{recursive:true,force:true});
 expectBuild(true);
 assert.ok(!existsSync('dist/research/rr-test-article/index.html'));
 assert.ok(!existsSync('dist/judgments/rr-test-case/index.html'));
 assert.doesNotMatch(html(''),/RR TEST (ARTICLE|CASE|HIDDEN DRAFT)/);
 assert.ok(!existsSync('dist/bare-acts/acts/rr-test-act/index.html'));
 assert.ok(!existsSync('dist/sitemap.xml'));
 assert.ok(!existsSync('dist/rss.xml'));
 assert.doesNotMatch(html('areas-of-law/msme-law'),/RR TEST (ARTICLE|CASE|STATUTE)/);
}
