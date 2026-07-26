-- Content-library lecture versioning (ROADMAP §I2). Additive + nullable-widening; single-release safe:
-- the old binary always writes created_by, the new one stops. Content lectures are versioned rows
-- ((slug, version) unique — legacy rows keep slug NULL, exempt because Postgres NULLs are distinct).

-- DropForeignKey
ALTER TABLE "lecture" DROP CONSTRAINT "lecture_created_by_fkey";

-- AlterTable
ALTER TABLE "lecture" ADD COLUMN     "content_hash" TEXT,
ADD COLUMN     "slug" TEXT,
ADD COLUMN     "source_path" TEXT,
ADD COLUMN     "superseded_at" TIMESTAMPTZ(6),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "created_by" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "lecture_slug_status_idx" ON "lecture"("slug", "status");

-- CreateIndex
CREATE UNIQUE INDEX "lecture_slug_version_key" ON "lecture"("slug", "version");

-- AddForeignKey
ALTER TABLE "lecture" ADD CONSTRAINT "lecture_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "trainer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Data: retire the legacy portal-authored lectures (§H1 authoring is replaced by the content library).
-- Their rows, item rows, and assignment/attempt history survive untouched — in-flight assignments keep
-- playing (the session path doesn't check lecture status) — but they leave the browse/assign surface.
UPDATE "lecture" SET "status" = 'superseded', "superseded_at" = now() WHERE "slug" IS NULL;
