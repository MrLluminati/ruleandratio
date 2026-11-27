-- Private editorial workspace. Existing records require explicit review-plan migration.
ALTER TABLE editorial_documents ADD COLUMN title TEXT NOT NULL DEFAULT '';
ALTER TABLE editorial_documents ADD COLUMN review_plan_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(review_plan_json));
ALTER TABLE editorial_documents ADD COLUMN review_plan_hash TEXT NOT NULL DEFAULT '';
-- Each write batch asserts its authorization and expected state atomically.
CREATE TABLE studio_mutation_guards (
 id TEXT PRIMARY KEY,
 allowed INTEGER NOT NULL CHECK(allowed=1)
);
CREATE INDEX editorial_documents_updated ON editorial_documents(updated_at DESC,id);
CREATE INDEX editorial_reviews_document ON editorial_reviews(document_id,created_at DESC);
