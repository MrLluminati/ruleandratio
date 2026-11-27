# RR-015H.3 — MSMED statutory publication pilot

Status: blocked on original-document acquisition and genuine review. On 27 November 2026 the historical India Code PDF printed pages 9–11 were visually inspected at https://www.indiacode.nic.in/bitstream/123456789/19412/1/msme_act_2006.pdf. Direct file download failed; no local original PDF, checksum, extracted statutory record or approved statutory content is claimed. The earlier CI retrieval failed for all candidates. The workflow is now manual-only to avoid automatic repeat retries. Do not use a privately edited consolidation as a substitute for the official original.

## Local historical extraction

Obtain the PDF using the official link above. Save locally as .rr-sources/msmed.pdf. With Python, Node and Poppler pdftotext available, run from repository root:

    python scripts/extract_msmed.py .rr-sources/msmed.pdf --source-url "https://www.indiacode.nic.in/bitstream/123456789/19412/1/msme_act_2006.pdf"

The parser validates the expected layout and preserves an original PDF copy, its SHA-256, extracted pages, line mappings, main source pinpoint and original commentary. It stops if the layout differs. Existing output is never overwritten. The result is a historical draft under .rr-import/msmed-act-2006, not a current consolidated text. No effective dates are inferred. Open npm run editorial:cms and compare the draft with its source. A copied PDF or source hash does not establish authenticity by itself.

## Version review

See msmed-version-plan.json for Act 16 of 2026 and the commencement research. Obtain official Gazette originals for CG-DL-E-13082026-275448 and CG-DL-E-12102026-277080 and the Mediation Act 2023. Verify all subsequent notifications, applicable rules and savings. Build a second manifest or reviewed revision of the original manifest with precise text line selections for revised and inserted provisions; use the existing importer, preserve original provenance, and archive earlier draft outputs before reimporting. The general importer supports independent textual versions and dated intervals, but do not assign a date without verified evidence. A future or not-yet-commenced provision must not be represented as present law. Uncommenced/enacted-only versions require separate editorial treatment; omit uncertain versions from the current text rather than guessing their dates. Review amendment links and full copy before publication. The pilot is selected provisions only, not all of Chapter V or the Act.

## Linking and publishing

The version plan records commentary and judgment link candidates. Only use statuteRefs when a target exists as an approved published record. Do not approve or publish a draft until the actual reviewer has checked the source, amendment chain, application dates, relevant later authorities and reproduction rights. Use the CMS to prepare a candidate; run the existing build and publishing tests, then manually commit if approved. No public content is changed by this research phase.

## Supplied Gazette documents — follow-up
The user supplied 275448.pdf and 277080.pdf. Their hashes and signature validation results are recorded in msmed-version-plan.json. Four inserted/substituted versions with appointed dates (15A, 20, 21, 22A) are staged in src/content/statutes/msmed-act-2006.json with draft:true. The future section 21 version is dated 15 December 2026. Enacted-only sections 18A and 19 are separately transcribed in msmed-2026-enacted-only.json, not eligible for current-law publication; section 18 requires the Mediation Act base text. Paragraph wrapping and outer Gazette quotation marks were normalized; full human comparison pending. The official Gazette URLs are source candidates corresponding to the supplied document IDs; download and certificate-chain authentication have not been independently confirmed. The original PDFs are retained by the editor, not committed. Obtain the principal Act and Mediation Act originals, verify subsequent notifications and complete historical versions before publication. Do not run an import with the same slug without reconciling the staged record.
