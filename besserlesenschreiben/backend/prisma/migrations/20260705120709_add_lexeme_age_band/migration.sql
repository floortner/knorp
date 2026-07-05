-- AlterTable
ALTER TABLE "lexeme" ADD COLUMN     "age_band" TEXT;

-- CreateIndex
CREATE INDEX "lexeme_age_band_idx" ON "lexeme"("age_band");
