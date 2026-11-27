-- Prevent stale forms from surviving a state cycle with identical content.
ALTER TABLE editorial_documents ADD COLUMN generation INTEGER NOT NULL DEFAULT 0 CHECK(generation>=0);
ALTER TABLE editorial_documents ADD COLUMN last_editor_id TEXT REFERENCES staff_accounts(id);
