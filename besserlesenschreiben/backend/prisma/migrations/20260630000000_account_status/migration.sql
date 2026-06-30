-- Account access lifecycle (ARCHITECTURE §1b): pending → active → deactivated.
-- New rows default to 'pending' (silent pending-on-first-code signup; a staff admin approves
-- before the first login code is sent). Existing accounts predate the approval gate, so they are
-- back-filled to 'active' — nothing currently working breaks.
ALTER TABLE "account" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'pending';
UPDATE "account" SET "status" = 'active';
