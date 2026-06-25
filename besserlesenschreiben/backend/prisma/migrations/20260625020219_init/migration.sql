-- CreateTable
CREATE TABLE "account" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "parent_pin_hash" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_code" (
    "id" UUID NOT NULL,
    "account_id" UUID,
    "email" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_code_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "buddy" TEXT NOT NULL DEFAULT 'nepo',
    "goal_per_week" INTEGER NOT NULL DEFAULT 5,
    "sound_on" BOOLEAN NOT NULL DEFAULT true,
    "dyslexic_font" BOOLEAN NOT NULL DEFAULT false,
    "font_scale" DECIMAL(3,2) NOT NULL DEFAULT 1.0,
    "stars" INTEGER NOT NULL DEFAULT 0,
    "streak_days" INTEGER NOT NULL DEFAULT 0,
    "last_active" DATE,
    "unlocked_unit" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_bank" (
    "id" UUID NOT NULL,
    "seed_key" TEXT,
    "unit" INTEGER NOT NULL,
    "exercise_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "audio_url" TEXT,
    "syllable_audio" JSONB,
    "skill_tags" TEXT[],
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "generated_by" TEXT NOT NULL DEFAULT 'seed',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_bank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "unit" INTEGER,
    "item_ids" UUID[],
    "source" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "stars_award" INTEGER,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempt" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "item_id" UUID,
    "exercise_type" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "expected" TEXT NOT NULL,
    "given" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL,
    "time_ms" INTEGER NOT NULL,
    "attempt_no" INTEGER NOT NULL DEFAULT 1,
    "skill_tags" TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_state" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "skill_tag" TEXT NOT NULL,
    "stability" DECIMAL(65,30),
    "difficulty" DECIMAL(65,30),
    "state" INTEGER NOT NULL DEFAULT 0,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "elapsed_days" INTEGER NOT NULL DEFAULT 0,
    "scheduled_days" INTEGER NOT NULL DEFAULT 0,
    "due" TIMESTAMPTZ(6),
    "last_review" TIMESTAMPTZ(6),

    CONSTRAINT "review_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "homework_upload" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "image_key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "analysis" JSONB,
    "confirmed_by" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "homework_upload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_message" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entitlement" (
    "account_id" UUID NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'free',
    "status" TEXT NOT NULL DEFAULT 'inactive',
    "renews_at" TIMESTAMPTZ(6),
    "provider" TEXT,
    "provider_ref" TEXT,

    CONSTRAINT "entitlement_pkey" PRIMARY KEY ("account_id")
);

-- CreateTable
CREATE TABLE "credits_ledger" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "beneficiary" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credits_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_webhook" (
    "provider" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "processed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_webhook_pkey" PRIMARY KEY ("provider","event_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "account_email_key" ON "account"("email");

-- CreateIndex
CREATE INDEX "login_code_email_idx" ON "login_code"("email");

-- CreateIndex
CREATE INDEX "profile_account_id_idx" ON "profile"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "item_bank_seed_key_key" ON "item_bank"("seed_key");

-- CreateIndex
CREATE INDEX "item_bank_unit_idx" ON "item_bank"("unit");

-- CreateIndex
CREATE INDEX "session_profile_id_idx" ON "session"("profile_id");

-- CreateIndex
CREATE INDEX "attempt_profile_id_idx" ON "attempt"("profile_id");

-- CreateIndex
CREATE INDEX "attempt_session_id_idx" ON "attempt"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "review_state_profile_id_skill_tag_key" ON "review_state"("profile_id", "skill_tag");

-- CreateIndex
CREATE INDEX "homework_upload_profile_id_idx" ON "homework_upload"("profile_id");

-- CreateIndex
CREATE INDEX "chat_message_profile_id_idx" ON "chat_message"("profile_id");

-- CreateIndex
CREATE INDEX "credits_ledger_account_id_idx" ON "credits_ledger"("account_id");

-- AddForeignKey
ALTER TABLE "login_code" ADD CONSTRAINT "login_code_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile" ADD CONSTRAINT "profile_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt" ADD CONSTRAINT "attempt_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt" ADD CONSTRAINT "attempt_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt" ADD CONSTRAINT "attempt_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "item_bank"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_state" ADD CONSTRAINT "review_state_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homework_upload" ADD CONSTRAINT "homework_upload_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlement" ADD CONSTRAINT "entitlement_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credits_ledger" ADD CONSTRAINT "credits_ledger_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
