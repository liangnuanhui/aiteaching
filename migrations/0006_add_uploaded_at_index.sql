-- Migration number: 0006 	 2025-11-23T13:02:58.754Z
-- Add index on uploaded_at for duplicate detection by time window

CREATE INDEX "uploads_uploaded_at_idx" ON "uploads"("uploaded_at");
