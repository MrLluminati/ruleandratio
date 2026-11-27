# RR-015H.1 — Local editorial desk

The generated dashboard is a local HTML report, not a CMS, authentication service, website route or deployment. Run from the repository root after npm install:

    npm run editorial:queue

Open .rr-editorial/index.html in a browser. Search titles, slugs, notes and sources; filter by type and review status. queue.json is a machine-readable inventory for bulk sorting or planning. It counts actual files, excludes structural templates from substantive readiness, shows source-map status, and includes local .rr-import/<act>/draft.json imports. Source map records are research pointers only, not approved text. Existing public GitHub files remain publicly readable even when draft:true; never store confidential records in this repository.

## Review a document

1. Select its editorial ID from the dashboard. Edit the draft first, resolve internal verification placeholders, improve the analysis, confirm sources and add precise pinpoints. Check any links against published target records. For imported statutes add reviewed commentary and the actual legal status to the local draft, and compare the original source, extraction report, versions and rights. Keep draft:true.
2. Run npm run editorial:template -- <id>. It creates a new .rr-editorial/reviews/<id>.json record without overwriting an existing one.
3. The actual human reviewer fills reviewer, reviewedAt, note, checks, and each source's verified and note values. Use actual dates and evidence. The source keys correspond to exact title/URL/kind/pinpoint entries; consult queue.json. Set decision to approved only after actual approval, or blocked to record an impediment. A checklist is an attestation, not independent authentication. Do not fabricate a reviewer. Keep sensitive notes outside the repository.
4. Regenerate the dashboard. A record is ready only when all applicable checks are true, all listed sources verified with notes, primary pinpoints present, required metadata present and the SHA-256 still matches the exact draft. Editing a draft makes the review stale. Archive stale review files outside the active reviews directory and generate a new template after rechecking. This tool never transfers approval across changes.
5. For an approved item run npm run editorial:prepare -- <id> <YYYY-MM-DD> with the actual intended publication date (not future and not earlier than review). This writes a candidate in .rr-editorial/prepared, outside site content, and refuses to overwrite an existing candidate. It does not change the source file, commit, publish, validate the full Astro schema or certify legal accuracy. For statute imports the date is used only to validate the review chronology; statute records have reviewedAt rather than publishedAt.
6. Manually compare the candidate with the currently reviewed file and review record (regenerate if the draft changed). Copy it to the appropriate src/content location only after editorial approval; an imported statute goes to src/content/statutes/<slug>.json. Run npm run build and npm run test:publishing, inspect the generated pages, search and links, then commit. Existing Astro publication validation remains authoritative for schema, dates, and links. No automatic deployment or enabling indexing is added here.

Statuses: queued, in-review, blocked, stale, incomplete, invalid, ready, published, template. Published means the content flag is false, not proof of live deployment. Review records and reports are intentionally ignored by Git. Retain them privately with the original sources; CI validates the inventory and code but cannot authenticate a local human review. This is not an enforced cryptographic publication gate: direct edits to front matter are still possible under the existing schema. Use the editorial process and review the final diff.

## Statutory acquisition and internal links

The desk reads the ten acquisition source maps and associates their explicit draftArticle or articleSlug fields with actual articles. The candidate provision ID comes from the map where available; a matching reviewed provision is only a suggestion. Manually verify the real statute slug and provision slug (some maps group several sections, or use differing slug conventions). Add statuteRefs only after confirming both the substance and existing reviewed target; never link unpublished or nonexistent pages. A source map is not a bare act. Use the existing import:statute workflow documented in content-acquisition.md to obtain a draft from authenticated extracted text. The dashboard does not fetch PDFs or scrape legal publishers.

## Tests

npm run test:editorial checks missing/changed review records, explicit approval, safe candidate preparation, statute checks, duplicate IDs and escaped report rendering. CI runs these tests and builds a local report; no report artifact is uploaded. Existing publishing tests continue to exercise public draft exclusion and invalid link rejection.

## Visual editorial CMS
See [editorial-cms.md](editorial-cms.md) for the local browser-based editor and interactive review workflow. The static dashboard remains available.
