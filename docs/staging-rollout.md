# RR-016.6A — Staging integration and release handoff

Status: code and configuration gate only. No provider resources, custom domains, owner records, real payments, DNS or deployment were created. Do not enable indexing or billing. The first staging setup requires account owner access to Cloudflare and Auth0. Use an actual domain under the owner's control (example names are illustrative).

## Setup sequence

1. In Cloudflare Dashboard (https://dash.cloudflare.com/) check the existing Pages project, linked repo MrLluminati/ruleandratio, main, build npm run build, output dist, Node 22. PUBLIC_RR_INDEXING=false. Confirm the actual custom domain and DNS zone before deploying Workers. A pages.dev preview alone does not provide the custom hostnames required by this implementation. Do not switch to public workers.dev as a workaround.
2. Create separate staging D1 databases rr-staff-staging and rr-members-staging. Record non-secret IDs locally. Apply all numbered migrations to each database via Wrangler or D1 migration tooling. Do not copy live or private data into staging.
3. Configure Cloudflare Access on the whole staff staging hostname with an invitation-only policy and MFA. Confirm the team issuer and exact application AUD. Configure separate Auth0 Regular Web Application for member staging, allow only the exact member HTTPS /callback and / logout origin; enable verified email, password recovery and attack protection. Use test identities only; restrict signup until privacy and rate-limit review.
4. Copy studio/wrangler.staff.example.jsonc and studio/wrangler.member.example.jsonc to their ignored local names (strict JSON, no comments). Fill actual origins, database IDs, issuer, audience, client ID, and set routes to a single custom-domain entry, e.g. {"pattern":"admin-staging.your-domain","custom_domain":true}. Keep workers_dev=false, preview_urls=false, STUDIO_ENABLED=false, MEMBER_WORKSPACE_ENABLED=false, BILLING_MODE=disabled. Never include secrets in vars. Run npm run studio:preflight -- studio/wrangler.staff.jsonc studio/wrangler.member.jsonc. This validates local config only, not actual DNS, Access policy or secret presence.
5. Use a verified supported Wrangler CLI (install via official Cloudflare instructions), run wrangler d1 migrations apply DB --remote --config studio/wrangler.staff.jsonc and repeat with member config. Set MEMBER_CLIENT_SECRET using wrangler secret put MEMBER_CLIENT_SECRET --config studio/wrangler.member.jsonc. Review Worker targets before wrangler deploy --config studio/wrangler.staff.jsonc and equivalent member command. No live billing secrets. Confirm Access protection before staff deployment; disabled feature flags are not a substitute for Access. Use the secure out-of-band owner bootstrap in authentication-setup.md; do not paste tokens into chat. Verify unauthenticated, unprovisioned, disabled and member identities cannot open staff routes.
6. Only after verified authentication and migration tests, enable STUDIO_ENABLED on staff staging and MEMBER_WORKSPACE_ENABLED on member staging, then test synthetic drafts and two independent member accounts. Keep billing disabled until a separately approved isolated test environment with Razorpay Test Mode is ready.
7. Public header account link is opt-in: PUBLIC_RR_ACCOUNT_LINKS=true and PUBLIC_RR_ACCOUNT_ORIGIN=the verified member custom HTTPS origin, set only on the intended Pages environment after testing. No admin link in public navigation. Do not inherit staging identity links into production.

## Publication handoff

Migration 0007 stores the current approved review ID. Older approvals without this pointer cannot export; reopen and conduct a new review. Owner/admin may explicitly confirm a public copy and download Markdown or JSON candidate from an approved document. Exact revision and plan hashes, current review, reviewer status and evidence are checked. Export is audited and returns a SHA256 header. No GitHub write, public content copy, deployment or publication status change. Candidate is not full-schema validated or proof that law is correct. Before manually releasing, recheck current approval (downloaded files can become stale), confidentiality, legal sources, pilot issues, metadata dates, links, statutory version dates and full Astro publishing validation. Do not add premium or private text to the public repo. Use separate reviewed PR, successful CI, and owner approval. Check the proposed destination for existing slugs, no overwrite. Public and private catalogue sync, GitHub App integration and live deployment confirmation remain future work.

## Staging acceptance checklist

- [ ] Staff anonymous/unprovisioned/disabled denied; actual owner and MFA work; no alternate origin.
- [ ] Real D1 migration and transactional race tests; actual browser queue/edit/review/export.
- [ ] Member registration, verification, recovery, logout, session expiry and two-account isolation.
- [ ] Premium response not cached and unavailable without active entitlement.
- [ ] Public page navigation and search; preview noindex; no private or draft files in static output.
- [ ] Test-only billing later; actual gateway reconciliation, cancellation and refund tests.
- [ ] Privacy, terms, account export/deletion, rate limits, backups and recovery before production.
- [ ] Final legal and publication approval, confirmed deployment and indexing separately authorised.

No production launch is approved by this document.
