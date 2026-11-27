-- Apply after 0001. Times are Unix seconds.
CREATE TABLE member_login_attempts (
 state_hash TEXT PRIMARY KEY CHECK(length(state_hash)=64),
 verifier TEXT NOT NULL,
 nonce TEXT NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE INDEX member_login_expiry ON member_login_attempts(expires_at);
CREATE TABLE member_sessions (
 token_hash TEXT PRIMARY KEY CHECK(length(token_hash)=64),
 member_id TEXT NOT NULL REFERENCES member_profiles(id) ON DELETE CASCADE,
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL CHECK(expires_at>created_at)
);
CREATE INDEX member_session_expiry ON member_sessions(expires_at);
