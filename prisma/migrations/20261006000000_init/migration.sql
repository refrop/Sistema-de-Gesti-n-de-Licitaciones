-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'user');

-- CreateEnum
CREATE TYPE "TenderStatus" AS ENUM ('borrador', 'activa', 'finalizada', 'por_cobrar', 'cobrada', 'perdida');

-- CreateEnum
CREATE TYPE "EmailType" AS ENUM ('envio', 'recordatorio');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('enviado', 'fallido');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'user',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "tax_id" TEXT,
    "contact_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "description" TEXT,
    "base_price" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenders" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "max_budget" DECIMAL(12,2) NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "status" "TenderStatus" NOT NULL DEFAULT 'borrador',
    "proposal_path" TEXT,
    "proposal_url" TEXT,
    "proposal_name" TEXT,
    "proposal_size" INTEGER,
    "invoiced_amount" DECIMAL(12,2),
    "invoiced_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "reminder_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "tenders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tender_products" (
    "id" TEXT NOT NULL,
    "tender_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "tender_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "tender_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tender_transitions" (
    "id" TEXT NOT NULL,
    "tender_id" TEXT NOT NULL,
    "from_status" "TenderStatus",
    "to_status" "TenderStatus" NOT NULL,
    "user_id" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tender_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_logs" (
    "id" TEXT NOT NULL,
    "tender_id" TEXT NOT NULL,
    "type" "EmailType" NOT NULL,
    "to_email" TEXT NOT NULL,
    "provider_id" TEXT,
    "status" "EmailStatus" NOT NULL,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "clients_email_idx" ON "clients"("email");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE INDEX "tenders_status_deadline_idx" ON "tenders"("status", "deadline");

-- CreateIndex
CREATE INDEX "tenders_client_id_idx" ON "tenders"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "tender_products_tender_id_product_id_key" ON "tender_products"("tender_id", "product_id");

-- CreateIndex
CREATE INDEX "payments_tender_id_idx" ON "payments"("tender_id");

-- CreateIndex
CREATE INDEX "tender_transitions_tender_id_created_at_idx" ON "tender_transitions"("tender_id", "created_at");

-- CreateIndex
CREATE INDEX "email_logs_tender_id_idx" ON "email_logs"("tender_id");

-- AddForeignKey
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_products" ADD CONSTRAINT "tender_products_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_products" ADD CONSTRAINT "tender_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_transitions" ADD CONSTRAINT "tender_transitions_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
