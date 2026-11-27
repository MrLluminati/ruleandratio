-- Proposed D1 foundation. No production database or accounts created.
PRAGMA foreign_keys = ON;
CREATE TABLE member_profiles (
 id TEXT PRIMARY KEY,
 issuer TEXT NOT NULL,
 subject TEXT NOT NULL,
 display_name TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','closed')),
 created_at INTEGER NOT NULL,
 UNIQUE(issuer,subject)
);
CREATE TABLE staff_accounts (
 id TEXT PRIMARY KEY,
 issuer TEXT NOT NULL,
 subject TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('owner','admin','author','reviewer')),
 status TEXT NOT NULL DEFAULT 'disabled' CHECK(status IN ('active','disabled')),
 created_at INTEGER NOT NULL,
 UNIQUE(issuer,subject)
);
CREATE TABLE membership_entitlements (
 id TEXT PRIMARY KEY,
 member_id TEXT NOT NULL REFERENCES member_profiles(id) ON DELETE CASCADE,
 capability TEXT NOT NULL CHECK(capability IN ('premium-research')),
 valid_from INTEGER NOT NULL,
 valid_until INTEGER NOT NULL CHECK(valid_until > valid_from),
 revoked_at INTEGER,
 source_ref TEXT NOT NULL UNIQUE
);
CREATE INDEX membership_entitlements_member ON membership_entitlements(member_id,capability,valid_until);
CREATE TABLE member_bookmarks (
 member_id TEXT NOT NULL REFERENCES member_profiles(id) ON DELETE CASCADE,
 content_key TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 PRIMARY KEY(member_id,content_key)
);
CREATE TABLE editorial_documents (
 id TEXT PRIMARY KEY,
 kind TEXT NOT NULL CHECK(kind IN ('article','judgment','statute','news')),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','in-review','approved','publication-requested','published','withdrawn')),
 current_revision_hash TEXT NOT NULL CHECK(length(current_revision_hash)=64),
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE TABLE editorial_assignments (
 document_id TEXT NOT NULL REFERENCES editorial_documents(id) ON DELETE CASCADE,
 staff_id TEXT NOT NULL REFERENCES staff_accounts(id),
 capability TEXT NOT NULL CHECK(capability IN ('edit','review')),
 PRIMARY KEY(document_id,staff_id,capability)
);
CREATE TABLE editorial_revisions (
 document_id TEXT NOT NULL REFERENCES editorial_documents(id),
 sha256 TEXT NOT NULL CHECK(length(sha256)=64),
 content TEXT NOT NULL,
 author_id TEXT NOT NULL REFERENCES staff_accounts(id),
 created_at INTEGER NOT NULL,
 PRIMARY KEY(document_id,sha256)
);
CREATE TABLE editorial_reviews (
 id TEXT PRIMARY KEY,
 document_id TEXT NOT NULL,
 revision_hash TEXT NOT NULL,
 reviewer_id TEXT NOT NULL REFERENCES staff_accounts(id),
 decision TEXT NOT NULL CHECK(decision IN ('approved','blocked')),
 evidence_json TEXT NOT NULL CHECK(json_valid(evidence_json)),
 review_plan_hash TEXT NOT NULL CHECK(length(review_plan_hash)=64),
 created_at INTEGER NOT NULL,
 FOREIGN KEY(document_id,revision_hash) REFERENCES editorial_revisions(document_id,sha256)
);
CREATE TABLE publication_requests (
 id TEXT PRIMARY KEY,
 document_id TEXT NOT NULL,
 revision_hash TEXT NOT NULL,
 review_id TEXT NOT NULL REFERENCES editorial_reviews(id),
 requested_by TEXT NOT NULL REFERENCES staff_accounts(id),
 state TEXT NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','building','failed','published','cancelled')),
 created_at INTEGER NOT NULL,
 FOREIGN KEY(document_id,revision_hash) REFERENCES editorial_revisions(document_id,sha256)
);
CREATE TABLE billing_events (
 provider TEXT NOT NULL,
 event_id TEXT NOT NULL,
 payload_sha256 TEXT NOT NULL CHECK(length(payload_sha256)=64),
 received_at INTEGER NOT NULL,
 PRIMARY KEY(provider,event_id)
);
CREATE TABLE audit_events (
 id TEXT PRIMARY KEY,
 actor_staff_id TEXT NOT NULL REFERENCES staff_accounts(id),
 action TEXT NOT NULL,
 target_key TEXT NOT NULL,
 revision_hash TEXT,
 occurred_at INTEGER NOT NULL,
 details_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(details_json))
);
CREATE INDEX audit_events_target ON audit_events(target_key,occurred_at);
