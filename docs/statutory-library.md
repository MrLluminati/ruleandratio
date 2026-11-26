# RR-010/011 — Subject hubs and statutory library

29 subject hubs are generated from the existing taxonomy and linked from the homepage, directory and article tags. Each hub lists reviewed statutes and groups articles by publication type. Topic roadmaps are labeled as planned. No thin hub should be indexed before substantive coverage and launch SEO review.

## Statutory records
Store one JSON file per statute under src/content/statutes. See docs/templates/statute.json. Draft files do not generate pages. Publication requires actual reviewer, review date, official/authenticated source, status and at least one reviewed provision. The schema does not establish that the text is correct or complete.

Stable routes: /bare-acts/acts/<act>/, /bare-acts/acts/<act>/provisions/<provision>/, /bare-acts/acts/<act>/amendments/<amendment>/. The separate acts namespace avoids collisions with existing legislative commentary URLs. Chapter grouping is on the Act page. Source records support pinpoints. Provision kind and number are explicit, so Article 21, Section 34 and schedules are distinguishable.

Each provision has one or more recorded textual versions. effectiveFrom and effectiveUntil are optional; the end is exclusive. Unknown dates are displayed as unknown; no automatic claim of current applicability. Dated intervals cannot overlap. Store exact verified text, not an AI paraphrase, and distinguish editorial notes. Each version has its own source. Amendment links must resolve to an amendment that identifies the affected provision; amendment records must link to actual provision IDs. Status and coverage are editor-declared, not calculated. Do not mark complete unless the entire relevant text has been reviewed. Do not use these records alone to determine commencement, repeal, savings, transitional rules or applicability to individual matters.

Article front matter supports statuteRefs: [{act: statute-slug, provision: provision-slug}] (provision optional). Published references must resolve to reviewed public records. This yields reciprocal links to judgments, guides and research without duplicating the article. Subject tags alone do not establish interpretation of an individual provision.

Verify official sources (e.g. India Code or official gazettes), applicable copyright and reporting restrictions, statutory versions, amendments and commencement before publishing. Do not commit private material to the public repository. No real statutory records are approved in this milestone.

## Acquisition
Use the draft-only local importer and review workflow documented in docs/content-acquisition.md before populating this collection.

Published provision records must now include independently written, legally reviewed `commentary`, displayed separately from verbatim statutory versions. The importer can carry draft commentary but cannot approve it. This supports the project reproduction-rights policy; the presence of commentary alone does not establish that all rights or legal review requirements have been met.
