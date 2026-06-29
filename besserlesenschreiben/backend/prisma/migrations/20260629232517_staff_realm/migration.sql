/*
  Warnings:

  - You are about to drop the column `analysis` on the `homework_upload` table. All the data in the column will be lost.
  - You are about to drop the column `confirmed_by` on the `homework_upload` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "homework_upload" DROP COLUMN "analysis",
DROP COLUMN "confirmed_by",
ADD COLUMN     "applied_at" TIMESTAMPTZ(6),
ADD COLUMN     "claimed_by" UUID,
ADD COLUMN     "claimed_until" TIMESTAMPTZ(6),
ADD COLUMN     "llm_analysis" JSONB,
ADD COLUMN     "review_decision" TEXT,
ADD COLUMN     "reviewed_analysis" JSONB,
ADD COLUMN     "reviewed_at" TIMESTAMPTZ(6),
ADD COLUMN     "reviewer_id" UUID,
ALTER COLUMN "status" SET DEFAULT 'pending_analysis';

-- CreateTable
CREATE TABLE "reviewer" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'reviewer',
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviewer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_login_code" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_login_code_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "homework_review" (
    "id" UUID NOT NULL,
    "upload_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "decision" TEXT NOT NULL,
    "llm_analysis" JSONB NOT NULL,
    "reviewed_analysis" JSONB,
    "agreed_with_llm" BOOLEAN NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "homework_review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reviewer_email_key" ON "reviewer"("email");

-- CreateIndex
CREATE INDEX "staff_login_code_email_idx" ON "staff_login_code"("email");

-- CreateIndex
CREATE INDEX "homework_review_upload_id_idx" ON "homework_review"("upload_id");

-- CreateIndex
CREATE INDEX "homework_review_reviewer_id_idx" ON "homework_review"("reviewer_id");

-- CreateIndex
CREATE INDEX "homework_upload_status_idx" ON "homework_upload"("status");

-- AddForeignKey
ALTER TABLE "homework_upload" ADD CONSTRAINT "homework_upload_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "reviewer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homework_upload" ADD CONSTRAINT "homework_upload_claimed_by_fkey" FOREIGN KEY ("claimed_by") REFERENCES "reviewer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homework_review" ADD CONSTRAINT "homework_review_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "homework_upload"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homework_review" ADD CONSTRAINT "homework_review_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "reviewer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
