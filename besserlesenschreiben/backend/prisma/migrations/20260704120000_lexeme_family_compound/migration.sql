-- AlterTable: add Wortfamilie stem + compound-parts structure to the lexeme foundation
ALTER TABLE "lexeme" ADD COLUMN "family_stem" TEXT;
ALTER TABLE "lexeme" ADD COLUMN "compound_parts" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- CreateIndex (fast "members of Wortfamilie X" selection)
CREATE INDEX "lexeme_family_stem_idx" ON "lexeme"("family_stem");
