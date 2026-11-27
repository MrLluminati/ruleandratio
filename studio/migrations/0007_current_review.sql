-- Existing approvals require reopening and fresh review before candidate export.
ALTER TABLE editorial_documents ADD COLUMN current_review_id TEXT REFERENCES editorial_reviews(id);
