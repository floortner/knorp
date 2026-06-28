-- AlterTable
ALTER TABLE "account" ADD COLUMN     "pin_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pin_locked_until" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "review_state" ADD COLUMN     "learning_steps" INTEGER NOT NULL DEFAULT 0;
