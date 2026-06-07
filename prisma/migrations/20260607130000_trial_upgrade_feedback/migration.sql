CREATE TABLE IF NOT EXISTS "public"."trial_upgrade_feedback" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "company_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_email" TEXT,
    "reason" TEXT NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trial_upgrade_feedback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "trial_upgrade_feedback_company_id_key" ON "public"."trial_upgrade_feedback"("company_id");
CREATE INDEX IF NOT EXISTS "trial_upgrade_feedback_created_at_idx" ON "public"."trial_upgrade_feedback"("created_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trial_upgrade_feedback_company_id_fkey'
  ) THEN
    ALTER TABLE "public"."trial_upgrade_feedback"
      ADD CONSTRAINT "trial_upgrade_feedback_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "public"."Company"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;
