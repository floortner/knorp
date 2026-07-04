-- CreateTable
CREATE TABLE "lexeme" (
    "id" UUID NOT NULL,
    "lemma" TEXT NOT NULL,
    "hk" INTEGER NOT NULL,
    "pos" TEXT NOT NULL,
    "genus" TEXT,
    "morpheme_count" INTEGER NOT NULL,
    "ipa" TEXT NOT NULL,
    "syllabification" TEXT NOT NULL,
    "syllable_count" INTEGER NOT NULL,
    "forms" TEXT,
    "separable_prefix" TEXT,
    "features" JSONB NOT NULL,
    "skill_tags" TEXT[],
    "is_lernwort" BOOLEAN NOT NULL DEFAULT false,
    "is_trennbar" BOOLEAN NOT NULL DEFAULT false,
    "is_merkwort" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'rwe2015',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lexeme_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lexeme_lemma_key" ON "lexeme"("lemma");

-- CreateIndex
CREATE INDEX "lexeme_hk_idx" ON "lexeme"("hk");

-- CreateIndex (fast "words for skill X" selection on the string[] column)
CREATE INDEX "lexeme_skill_tags_idx" ON "lexeme" USING GIN ("skill_tags");
