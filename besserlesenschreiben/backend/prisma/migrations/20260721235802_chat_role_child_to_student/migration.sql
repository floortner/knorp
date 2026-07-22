-- Terminology: the app's users are "students" (CLAUDE.md conventions). Flip the legacy chat role
-- literal. The read path tolerates both values ('trainer' vs anything else), so rows written by
-- old code between this pre-traffic migration and the code deploy stay renderable.
UPDATE "chat_message" SET "role" = 'student' WHERE "role" = 'child';
