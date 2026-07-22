-- Second half of the parent-PIN removal (two-release deploy safety, ROADMAP 2026-07-22): the binary
-- that stopped referencing these columns is live since the previous release, so the drop can no
-- longer break a serving process during the pre-traffic migrate window.
ALTER TABLE "account" DROP COLUMN "parent_pin_hash",
DROP COLUMN "pin_attempts",
DROP COLUMN "pin_locked_until";
