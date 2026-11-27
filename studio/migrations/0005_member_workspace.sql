-- Reader workspace. Apply after 0001–0004. No production content seeded.
ALTER TABLE member_profiles ADD COLUMN profession TEXT NOT NULL DEFAULT '' CHECK(profession IN ('','advocate','student','researcher','corporate','other'));
-- Only trusted publication integration may populate this catalogue.
CREATE TABLE member_content_catalog (
 content_key TEXT PRIMARY KEY CHECK(length(content_key) BETWEEN 1 AND 100),
 title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 300),
 kind TEXT NOT NULL CHECK(kind IN ('article','judgment','statute','news','research')),
 access_level TEXT NOT NULL CHECK(access_level IN ('public','premium')),
 public_path TEXT,
 status TEXT NOT NULL DEFAULT 'withdrawn' CHECK(status IN ('published','withdrawn')),
 CHECK((access_level='public' AND public_path IS NOT NULL) OR (access_level='premium' AND public_path IS NULL))
);
CREATE TABLE member_premium_content (
 content_key TEXT PRIMARY KEY REFERENCES member_content_catalog(content_key) ON DELETE CASCADE,
 body_markdown TEXT NOT NULL CHECK(length(body_markdown) BETWEEN 1 AND 250000)
);
CREATE TABLE member_collections (
 id TEXT PRIMARY KEY,
 member_id TEXT NOT NULL REFERENCES member_profiles(id) ON DELETE CASCADE,
 name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 80),
 created_at INTEGER NOT NULL,
 UNIQUE(member_id,name),
 UNIQUE(id,member_id)
);
CREATE TABLE member_collection_items (
 collection_id TEXT NOT NULL,
 member_id TEXT NOT NULL,
 content_key TEXT NOT NULL REFERENCES member_content_catalog(content_key) ON DELETE CASCADE,
 created_at INTEGER NOT NULL,
 PRIMARY KEY(collection_id,content_key),
 FOREIGN KEY(collection_id,member_id) REFERENCES member_collections(id,member_id) ON DELETE CASCADE
);
CREATE INDEX member_bookmarks_recent ON member_bookmarks(member_id,created_at DESC);
CREATE INDEX member_collections_owner ON member_collections(member_id,created_at DESC);
