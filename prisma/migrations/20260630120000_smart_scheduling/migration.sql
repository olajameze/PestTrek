-- Smart Scheduling module tables (Company.id is TEXT in production Postgres)

CREATE TABLE "schedule" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "company_id" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/London',
    "default_duration_minutes" INTEGER NOT NULL DEFAULT 60,
    "generation_horizon_days" INTEGER NOT NULL DEFAULT 90,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "schedule_company_id_key" ON "schedule"("company_id");

ALTER TABLE "schedule" ADD CONSTRAINT "schedule_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

CREATE TABLE "recurring_appointment" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "company_id" TEXT NOT NULL,
    "interval_type" TEXT NOT NULL,
    "interval_days" INTEGER,
    "anchor_start" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6),
    "generated_until" TIMESTAMPTZ(6) NOT NULL,
    "exception_dates" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "client_name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "postcode" TEXT,
    "treatment" TEXT,
    "notes" TEXT,
    "duration_minutes" INTEGER NOT NULL DEFAULT 60,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recurring_appointment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "recurring_appointment_company_id_idx" ON "recurring_appointment"("company_id");

ALTER TABLE "recurring_appointment" ADD CONSTRAINT "recurring_appointment_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

CREATE TABLE "appointment" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "company_id" TEXT NOT NULL,
    "logbook_entry_id" TEXT,
    "recurring_appointment_id" TEXT,
    "client_name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "postcode" TEXT,
    "treatment" TEXT,
    "notes" TEXT,
    "scheduled_start" TIMESTAMPTZ(6) NOT NULL,
    "scheduled_end" TIMESTAMPTZ(6) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "appointment_logbook_entry_id_key" ON "appointment"("logbook_entry_id");
CREATE INDEX "appointment_company_scheduled_start_idx" ON "appointment"("company_id", "scheduled_start");
CREATE INDEX "appointment_recurring_id_idx" ON "appointment"("recurring_appointment_id");

ALTER TABLE "appointment" ADD CONSTRAINT "appointment_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_logbook_entry_id_fkey" FOREIGN KEY ("logbook_entry_id") REFERENCES "LogbookEntry"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_recurring_appointment_id_fkey" FOREIGN KEY ("recurring_appointment_id") REFERENCES "recurring_appointment"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

CREATE TABLE "appointment_technician" (
    "appointment_id" TEXT NOT NULL,
    "technician_id" TEXT NOT NULL,

    CONSTRAINT "appointment_technician_pkey" PRIMARY KEY ("appointment_id","technician_id")
);

CREATE INDEX "appointment_technician_technician_id_idx" ON "appointment_technician"("technician_id");

ALTER TABLE "appointment_technician" ADD CONSTRAINT "appointment_technician_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointment"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "appointment_technician" ADD CONSTRAINT "appointment_technician_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "Technician"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

CREATE TABLE "technician_availability" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "technician_id" TEXT NOT NULL,
    "day_of_week" INTEGER,
    "specific_date" DATE,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "technician_availability_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "technician_availability_technician_id_idx" ON "technician_availability"("technician_id");

ALTER TABLE "technician_availability" ADD CONSTRAINT "technician_availability_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "Technician"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
