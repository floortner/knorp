-- The Vokaltraining content set (word lists, training types, sequence, lecture-generation approach) is
-- being redesigned from scratch. Drop the lexeme table; re-add a fresh model once the new word-list
-- shape is decided.
DROP TABLE IF EXISTS "lexeme";
