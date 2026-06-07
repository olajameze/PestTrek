-- Recreate if a prior failed deploy left uuid-typed company_id.
DROP TABLE IF EXISTS "public"."company_activation";

CREATE TABLE "public"."company_activation" (
    "company_id" TEXT NOT NULL,
    "first_customer_created_at" TIMESTAMPTZ(6),
    "first_site_created_at" TIMESTAMPTZ(6),
    "first_job_completed_at" TIMESTAMPTZ(6),
    "first_photo_uploaded_at" TIMESTAMPTZ(6),
    "first_report_generated_at" TIMESTAMPTZ(6),
    "checklist_dismissed_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_activation_pkey" PRIMARY KEY ("company_id")
);

ALTER TABLE "public"."company_activation"
  ADD CONSTRAINT "company_activation_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "public"."Company"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
