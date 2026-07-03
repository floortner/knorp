-- Billing is deferred and not built (ARCHITECTURE §9). Drop the dormant tables; re-add by migration
-- if metering is ever introduced. Rows here are default empty records, no meaningful data.
DROP TABLE IF EXISTS "processed_webhook";
DROP TABLE IF EXISTS "credits_ledger";
DROP TABLE IF EXISTS "entitlement";
