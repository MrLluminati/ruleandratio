# RR-008/009 — Publishing workflow

## Content
Each Markdown file in src/content/articles is one article or case analysis. Files are public in GitHub even if draft:true, so never store sensitive/unpublished confidential material. Drafts are excluded from generated pages and lists. Do not publish raw AI output.

Required to publish: title, description, stable lower-case hyphenated slug, type, recognized area slugs (src/data/areas.ts), jurisdiction, author, named human reviewer, actual publishedAt/reviewedAt dates (not future), at least one verified primary source, and draft:false. Sources contain title, url (HTTP/S), kind (primary/secondary) and optional pinpoint. The schema checks metadata presence, not legal accuracy or genuine review. The editor must verify all claims and links before changing draft to false.

Types map to canonical route families: news -> /news/, judgment -> /judgments/, legislation -> /bare-acts/, procedure -> /procedures/, research -> /research/, education -> /education/, institution -> /institutions/. Stable article path is /section/slug/. Do not change the slug/type of a published entry without a redirect plan. Duplicate published paths fail the build. Related reading is based on shared subject tags (excluding general); no links to drafts.

## Judgment articles
Use type: judgment and judgment: {caseName, court, decisionDate, citation or caseNumber, judgmentUrl, optional bench array and disposition}. judgmentUrl must also be an explicit primary source. Use an official or reliably authenticated judgment text; verify case details, reporting restrictions, precedential status and subsequent treatment. No invented citations or decisions. Suggested Markdown H2 headings: Background and facts; Issues; Arguments (if relevant); Decision and reasoning; Ratio decidendi; Practical implications. Distinguish holding, obiter and editorial commentary.

## Article structure
Use H2 and H3 headings (page H1 comes from title). Link important propositions to primary sources with paragraph/section references in text and source pinpoint fields. Sources appear at the end, with kind clearly marked. The layout shows author, reviewer, dates, subject labels, contents and related articles. Include corrections and changes in the article and update the review date truthfully; formal corrections register is still pending.

## Workflow
1. Prepare Markdown from verified sources.
2. Set draft:true until reviewed. Complete author/reviewer and dates only when accurate.
3. Human legal reviewer checks legal accuracy, current law, jurisdiction, privacy and reporting restrictions.
4. Set draft:false; run npm run build and npm run test:publishing. Review the built article, index and references.
5. Commit and push; CI repeats the build and tests. Production launch remains gated by noindex.

Use docs/templates/article.md and docs/templates/judgment.md as non-content examples. No actual articles have been approved or published by this task. The public site is still a preview. Statutory provision versioning, author profile pages, taxonomy hubs, search, SEO/canonical metadata, corrections register and journal editorial infrastructure are later work.

## Statutory references
Optional front matter statuteRefs links to the statutory library, with act and optional provision slugs. Published references must resolve; see docs/statutory-library.md. The source list remains mandatory and separate.
