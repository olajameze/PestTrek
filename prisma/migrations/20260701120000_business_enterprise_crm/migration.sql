-- Business & Enterprise CRM, invoicing, compliance alerts

ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "invoice_prefix" TEXT DEFAULT 'INV';
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "next_invoice_number" INTEGER DEFAULT 1;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "default_vat_rate" DECIMAL(5,2) DEFAULT 20;

CREATE TABLE IF NOT EXISTS "customer" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" TEXT NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "notes" TEXT,
  "archived_at" TIMESTAMPTZ,
  "portal_enabled" BOOLEAN NOT NULL DEFAULT false,
  "portal_token_hash" TEXT,
  "portal_token_expires_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "customer_company_id_idx" ON "customer"("company_id");
CREATE INDEX IF NOT EXISTS "customer_portal_token_hash_idx" ON "customer"("portal_token_hash");

CREATE TABLE IF NOT EXISTS "site" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" TEXT NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "customer_id" TEXT NOT NULL REFERENCES "customer"("id") ON DELETE CASCADE,
  "label" TEXT,
  "address" TEXT NOT NULL,
  "postcode" TEXT,
  "access_notes" TEXT,
  "property_type" TEXT,
  "archived_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "site_company_id_idx" ON "site"("company_id");
CREATE INDEX IF NOT EXISTS "site_customer_id_idx" ON "site"("customer_id");

CREATE TABLE IF NOT EXISTS "invoice" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" TEXT NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "customer_id" TEXT NOT NULL REFERENCES "customer"("id") ON DELETE CASCADE,
  "site_id" TEXT REFERENCES "site"("id") ON DELETE SET NULL,
  "logbook_entry_id" TEXT REFERENCES "LogbookEntry"("id") ON DELETE SET NULL,
  "number" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "issued_at" TIMESTAMPTZ NOT NULL,
  "due_at" TIMESTAMPTZ,
  "subtotal" DECIMAL(10,2) NOT NULL,
  "vat_rate" DECIMAL(5,2) NOT NULL,
  "vat_amount" DECIMAL(10,2) NOT NULL,
  "total" DECIMAL(10,2) NOT NULL,
  "line_items" JSONB NOT NULL,
  "stripe_payment_link_url" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("company_id", "number")
);

CREATE INDEX IF NOT EXISTS "invoice_company_id_idx" ON "invoice"("company_id");
CREATE INDEX IF NOT EXISTS "invoice_customer_id_idx" ON "invoice"("customer_id");

CREATE TABLE IF NOT EXISTS "compliance_alert" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" TEXT NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "type" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "resolved_at" TIMESTAMPTZ,
  "emailed_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("company_id", "type", "entity_type", "entity_id")
);

CREATE INDEX IF NOT EXISTS "compliance_alert_company_resolved_idx" ON "compliance_alert"("company_id", "resolved_at");

ALTER TABLE "LogbookEntry" ADD COLUMN IF NOT EXISTS "customer_id" TEXT REFERENCES "customer"("id") ON DELETE SET NULL;
ALTER TABLE "LogbookEntry" ADD COLUMN IF NOT EXISTS "site_id" TEXT REFERENCES "site"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "logbook_entry_customer_id_idx" ON "LogbookEntry"("customer_id");
CREATE INDEX IF NOT EXISTS "logbook_entry_site_id_idx" ON "LogbookEntry"("site_id");

ALTER TABLE "appointment" ADD COLUMN IF NOT EXISTS "customer_id" TEXT REFERENCES "customer"("id") ON DELETE SET NULL;
ALTER TABLE "appointment" ADD COLUMN IF NOT EXISTS "site_id" TEXT REFERENCES "site"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "appointment_customer_id_idx" ON "appointment"("customer_id");

ALTER TABLE "recurring_appointment" ADD COLUMN IF NOT EXISTS "customer_id" TEXT REFERENCES "customer"("id") ON DELETE SET NULL;
ALTER TABLE "recurring_appointment" ADD COLUMN IF NOT EXISTS "site_id" TEXT REFERENCES "site"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "recurring_appointment_customer_id_idx" ON "recurring_appointment"("customer_id");
