-- The staff person is a TRAINER (known-trainer model, ROADMAP §H): rename the reviewer table, its
-- FK columns, and the role value. Homework *review* (the activity) keeps its name. RENAMEs are
-- metadata-only; index/constraint names are renamed to what Prisma would generate fresh so the
-- shadow-DB replay stays drift-free. Deploy note: between pre-traffic migrate and restart, the OLD
-- binary errors on /staff/* only (family routes never touch these tables' renamed parts).
ALTER TABLE "reviewer" RENAME TO "trainer";
ALTER INDEX "reviewer_pkey" RENAME TO "trainer_pkey";
ALTER INDEX "reviewer_email_key" RENAME TO "trainer_email_key";
UPDATE "trainer" SET "role" = 'trainer' WHERE "role" = 'reviewer';

ALTER TABLE "homework_upload" RENAME COLUMN "reviewer_id" TO "trainer_id";
ALTER TABLE "homework_upload" RENAME CONSTRAINT "homework_upload_reviewer_id_fkey" TO "homework_upload_trainer_id_fkey";

ALTER TABLE "homework_review" RENAME COLUMN "reviewer_id" TO "trainer_id";
ALTER TABLE "homework_review" RENAME CONSTRAINT "homework_review_reviewer_id_fkey" TO "homework_review_trainer_id_fkey";
ALTER INDEX "homework_review_reviewer_id_idx" RENAME TO "homework_review_trainer_id_idx";
