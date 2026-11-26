# RR-005 — Architecture

## Scope
Independent India-first legal publishing platform, distinct from Chambers of AK. English-first, static HTML at launch. No ads until professional-compliance and publisher approvals are resolved.

## Stack
Astro 6, Node 22, TypeScript, Markdown content collections, GitHub, Cloudflare Pages. Pagefind, RSS and SEO metadata are implemented. MDX and analytics remain deferred.

## Routes
`/news/`, `/judgments/`, `/bare-acts/`, `/procedures/`, `/areas-of-law/`, `/research/`, `/education/`, `/institutions/`, `/tools/`, `/journal/`. Section routes now list reviewed publications where available. Content routes use /section/slug/ and a central subject taxonomy. Canonical metadata is configured through a confirmed production origin. Subject hubs and a separately namespaced statutory library support reviewed provision versions and amendment links; see docs/statutory-library.md. Judgment entries require court, decision date, citation or case number and judgment text source. Do not duplicate content across hubs.

## Content lifecycle
Draft -> source verification -> human legal review -> approval -> publication -> corrections/re-review. Publication routing and metadata validation are implemented; see docs/publishing.md. Drafts are never public article routes. Public repository must not contain confidential or client-identifying material, credentials or unpublished sensitive research.

## SEO and deployment
Pre-launch noindex is deliberate. Before removing it: register production host, set canonical site URL, add canonical tags, sitemap, robots, feeds, structured data, verify working navigation and publish reviewed content. Search engine analytics and legal tools require separate implementation.

## Roadmap
- RR-005 Architecture: initial documentation.
- RR-006 Astro: static starter, layouts, route previews, content schema.
- RR-007 Homepage: approved full asset integration and refined editorial layout.
- RR-008/009 Publishing: implemented taxonomy, judgment metadata, draft filtering, article templates, primary source references, and CI publishing tests.
- RR-010/011 Subject hub routes, statute directory, chapter/provision grouping, recorded versions, amendment pages and reciprocal article references.
- RR-012/013 Pagefind search, launch-gated SEO, structured data, XML sitemap and RSS, post-build validation.
- RR-014 Deployment and launch validation.
- RR-015 Reviewed initial content.
- RR-016 Monetization (conditional).
- RR-017 Academic journal (separate governance and registration checks).

## Legal tools
General interest calculator and tools directory are implemented at /tools/. Client-side, fixed-rate arithmetic, actual/365 and fractional compounding periods. No external service, input persistence or legal entitlement inference. See docs/legal-tools.md. Statutory calculators remain separate and must receive legal review.
