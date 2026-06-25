-- Attempt idempotency (SPEC §3, ARCHITECTURE §4): dedupe on (session_id, item_id, attempt_no).
-- item_id is nullable and NULLs are DISTINCT in Postgres, so a plain UNIQUE won't dedupe
-- homework/ad-hoc attempts. Enforce with a functional unique index that coalesces a nil UUID.
CREATE UNIQUE INDEX "attempt_idempotency_key"
  ON "attempt" (
    "session_id",
    (COALESCE("item_id", '00000000-0000-0000-0000-000000000000'::uuid)),
    "attempt_no"
  );

-- FSRS scheduling reads "what's due now" per profile; index the lookup the bank selector runs.
CREATE INDEX "review_state_profile_id_due_idx" ON "review_state" ("profile_id", "due");
