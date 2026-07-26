-- §I3: the portal's lecture write routes are gone — retire any legacy portal-authored lecture created
-- during the one-release §I2→§I3 overlap window (idempotent; normally a no-op). History, item rows,
-- and in-flight assignments stay intact, exactly like the §I2 retirement.
UPDATE "lecture" SET "status" = 'superseded', "superseded_at" = now()
WHERE "slug" IS NULL AND "status" <> 'superseded';
