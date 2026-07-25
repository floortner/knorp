-- §H1 lecture/assignment rails (ROADMAP): two ADDITIVE tables — staff-authored lectures + their
-- per-student assignments. No existing table is altered structurally, so this is deploy-window-safe
-- in a single release. (The trainer.role default catch-up below is drift left by the reviewer→trainer
-- rename: rows were updated but the column DEFAULT still said 'reviewer'.)
-- AlterTable
ALTER TABLE "trainer" ALTER COLUMN "role" SET DEFAULT 'trainer';

-- CreateTable
CREATE TABLE "lecture" (
    "id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "intro" TEXT NOT NULL,
    "item_ids" UUID[],
    "skill_tags" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "lecture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment" (
    "id" UUID NOT NULL,
    "lecture_id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "assigned_by" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "session_id" UUID,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "assignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lecture_status_idx" ON "lecture"("status");

-- CreateIndex
CREATE UNIQUE INDEX "assignment_session_id_key" ON "assignment"("session_id");

-- CreateIndex
CREATE INDEX "assignment_profile_id_completed_at_idx" ON "assignment"("profile_id", "completed_at");

-- CreateIndex
CREATE UNIQUE INDEX "assignment_lecture_id_profile_id_key" ON "assignment"("lecture_id", "profile_id");

-- AddForeignKey
ALTER TABLE "lecture" ADD CONSTRAINT "lecture_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "trainer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_lecture_id_fkey" FOREIGN KEY ("lecture_id") REFERENCES "lecture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "trainer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "session"("id") ON DELETE SET NULL ON UPDATE CASCADE;
