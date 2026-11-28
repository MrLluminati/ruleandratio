# RR-016.6B — Member callback runtime diagnostics

Observed staging: Auth0 successful login and verified email, callback HTTP 503, zero member profiles/sessions. Cause is not yet proven. Detached native fetch is a plausible workerd receiver issue; the default token transport now explicitly calls globalThis.fetch. Atomic DELETE RETURNING and identity/session validation remain unchanged.

After CI passes, redeploy only the member Worker with the existing ignored configuration and existing secret. Keep both workspace flags false, public registration disabled and billing disabled.

Run `npx.cmd wrangler tail --config studio/wrangler.member.jsonc --format pretty` in a second terminal, then start a fresh /login in the browser. Do not replay an old callback. Only share the rr.auth.callback event stage, outcome and status fields; raw tail entries can contain OAuth query parameters or other private data. Stop tail with Ctrl+C. No raw errors, URLs, identities, credentials, state, nonce, codes or tokens are emitted by the custom diagnostic events.

The last exception stage identifies the failing operation: consume_attempt, exchange_code, decode_response, verify_id_token, upsert_member, read_member or create_session. A complete/success event indicates callback completion; independently verify the browser session, logout and database counts. A successful login does not establish production readiness.

The Node regression test models the native fetch receiver constraint and tests generic failure, log redaction and state replay. It does not execute inside workerd or prove the live cause. No database migration or provider configuration changes.

## RR-016.6C — Reject token endpoint redirects compatibly

Live tail after 016.6B reached exchange_code and threw before an HTTP response. Cloudflare's Request API documentation (https://developers.cloudflare.com/workers/runtime-apis/request/) states redirect:error is unsupported and throws at Request construction. The OAuth request now uses redirect:manual and explicitly rejects every 3xx response without following it. Client credentials must never be forwarded. No retry of consumed authorization codes. Node tests enforce manual redirect mode and exercise redirect rejection, single call, replay denial and no session creation. This corrects a documented runtime incompatibility; live confirmation remains required. No provider, migration, billing or workspace changes. Redeploy only the member Worker after successful CI and use a fresh login while tailing sanitized diagnostic events.
