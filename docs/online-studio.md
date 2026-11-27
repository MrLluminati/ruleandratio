# RR-016 — Online editorial studio and member accounts

## Decision and boundaries

Public website remains static Astro on Cloudflare Pages. Private staff studio and authenticated member APIs run on separate Worker origins, with distinct identity audiences and server-side checks. The illustrative URLs are not registered or deployed. Prefer Cloudflare Access with MFA for invited staff; validate JWT issuer, audience, signature, expiry and map immutable subject to active staff record on every protected request. Disable or protect alternate workers.dev/preview origins; no identity-header trust. For members, choose a maintained managed identity provider after reviewing current free limits, password reset/verification, privacy and export support. No home-grown passwords, browser-stored service keys or automatic staff account linking by email. Staff role and billing entitlement are independent. Public registration creates member profiles only.

D1 is proposed for profiles, bookmarks, entitlement records, staff roles, private editorial revisions, assignments, review evidence, publication requests, and audit events. The foundation migration and pure policy module are inert until deployed and integrated. They are not authentication or endpoint implementations. Role changes only by owner; initially bootstrap one owner through a secure out-of-band action, never a public signup endpoint. Owner and admin may edit drafts, reviewers approve assigned drafts, authors edit assigned drafts, owner/admin authorise publication only after validated exact-revision and review-plan approval. Solo owner can review personally; require explicit acknowledgement in future online workflow. All staff accounts start disabled unless deliberately enabled. Privileged endpoints must re-read assignments and review state from the DB, validate server-derived hashes, run transactions or conditional statements, enforce CSRF/origin protection, rate limits, secure cookies, least privilege, audit logs and fail closed. Changes to content or plan invalidate approvals. No mutation from client claims. Test cross-member access, staff disablement, stale versions, token validation, direct URL bypass and concurrent publishing.

## Storage and publishing

Existing public GitHub drafts are not private. Never store new confidential drafts, profile details, payment records, review notes or premium full text in public Git history, Pages artifacts, Pagefind index, RSS, or preview builds. D1/private storage for future confidential data. Public content only is exported by a least-privilege GitHub App through a reviewed change/PR, then CI/security/build checks and deployment. Private source material or premium content served via authorised Worker routes (no-store, no shared cache). Premium access enforced per request, not via hidden HTML, JS or CSS. Private assets and downloads must be gated too. Do not create a publishing token until permissions and deployment are verified. Keep local CMS as legacy backup; no auto-import of old approvals into the online trust boundary.

## Membership and billing

Anonymous public reading; optional free member profile, bookmarks and saved research. Paid membership grants time-bounded capabilities (initially premium-research). No prices, trial, payment provider or final paywall policy chosen. Consider monthly/annual subscriptions, Razorpay for India subject to onboarding, terms, fees and recurring mandate support. Payment confirmation is server-side, signed webhook raw-body verification plus reconciliation and idempotent event IDs; replay/duplicate/out-of-order handling and expiry/revocation/refunds tested before real charges. Never accept browser-supplied payment status, store card details, or grant staff role. Privacy/retention, account export/deletion, subscription cancellation, terms and applicable Indian compliance require separate review.

## Sequence

1. RR-016.1: permissions and database foundation (schema + pure policy tests; no live endpoints).
2. RR-016.2: deploy isolated staff authentication and member authentication sandbox; secure owner bootstrap, verify access and session isolation.
3. RR-016.3: port editorial queue, draft editor, source review, plan/hash approval, private preview and audit trail. Import approved safe records only.
4. RR-016.4: member profile, bookmarks and account management; real membership entitlements and private research routes.
5. RR-016.5: billing sandbox, subscription lifecycle, refunds and privacy/security checks.
6. RR-016.6: publication pipeline, staged end-to-end security tests, accessibility and launch approval.

## References

- https://developers.cloudflare.com/ workers configuration: https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://www.cloudflare.com/plans/
- https://razorpay.com/docs/payments/subscriptions/

Free-tier operation is a design goal, not guaranteed. Domain, identity, email, database, Workers and payment costs depend on usage and provider plan. No production credentials, provider accounts, database, staff identities, domain mappings, payments or content releases created by this phase.
