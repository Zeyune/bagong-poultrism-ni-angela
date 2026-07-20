-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'FARM_WORKER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('INVITED', 'ACTIVE', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "FlockType" AS ENUM ('LAYER', 'BROILER');

-- CreateEnum
CREATE TYPE "FlockStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PROCESSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BirdStatus" AS ENUM ('ACTIVE', 'CULLED', 'SOLD', 'DECEASED');

-- CreateEnum
CREATE TYPE "InventoryItemType" AS ENUM ('FEED', 'MEDICATION', 'SUPPLEMENT', 'PRODUCT');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "TransactionReason" AS ENUM ('PURCHASE', 'PRODUCTION', 'MANUAL_ADJUSTMENT', 'FEED_CONSUMPTION', 'TREATMENT', 'SALE', 'SPOILAGE', 'REVERSAL');

-- CreateEnum
CREATE TYPE "HealthSeverity" AS ENUM ('MILD', 'MODERATE', 'SEVERE');

-- CreateEnum
CREATE TYPE "HealthLogStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "SalesOrderStatus" AS ENUM ('DRAFT', 'PLACED', 'FULFILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('PRODUCTION_DROP', 'MORTALITY_SPIKE', 'LOW_INVENTORY');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SUPPRESSED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "authUserId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'FARM_WORKER',
    "status" "UserStatus" NOT NULL DEFAULT 'INVITED',
    "farmId" TEXT NOT NULL,
    "invitedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Farm" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "ownerId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Farm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Flock" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "type" "FlockType" NOT NULL,
    "name" TEXT NOT NULL,
    "breed" TEXT,
    "initialCount" INTEGER NOT NULL,
    "currentCount" INTEGER NOT NULL,
    "startDate" DATE NOT NULL,
    "cycleLengthDays" INTEGER,
    "status" "FlockStatus" NOT NULL DEFAULT 'ACTIVE',
    "defaultFeedItemId" TEXT,
    "growthCurveId" TEXT,
    "withdrawalUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Flock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bird" (
    "id" TEXT NOT NULL,
    "flockId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "status" "BirdStatus" NOT NULL DEFAULT 'ACTIVE',
    "hatchDate" DATE,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bird_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyLog" (
    "id" TEXT NOT NULL,
    "flockId" TEXT NOT NULL,
    "logDate" DATE NOT NULL,
    "feedItemId" TEXT,
    "feedConsumedKg" DECIMAL(12,3) NOT NULL,
    "waterConsumedL" DECIMAL(12,3) NOT NULL,
    "mortalityCount" INTEGER NOT NULL DEFAULT 0,
    "eggsCollected" INTEGER,
    "crackedEggs" INTEGER,
    "eggsDiscarded" INTEGER,
    "notes" TEXT,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeightRecord" (
    "id" TEXT NOT NULL,
    "flockId" TEXT NOT NULL,
    "recordDate" DATE NOT NULL,
    "avgWeightG" DECIMAL(12,2) NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeightRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthLog" (
    "id" TEXT NOT NULL,
    "flockId" TEXT NOT NULL,
    "birdId" TEXT,
    "logDate" TIMESTAMP(3) NOT NULL,
    "eventType" TEXT NOT NULL,
    "severity" "HealthSeverity" NOT NULL DEFAULT 'MILD',
    "status" "HealthLogStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedAt" TIMESTAMP(3),
    "description" TEXT,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Treatment" (
    "id" TEXT NOT NULL,
    "healthLogId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "medicationName" TEXT NOT NULL,
    "dosageText" TEXT NOT NULL,
    "quantityUsed" DECIMAL(12,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "route" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "withdrawalPeriodDays" INTEGER NOT NULL,
    "withdrawalUntil" TIMESTAMP(3) NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Treatment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "InventoryItemType" NOT NULL,
    "unit" TEXT NOT NULL,
    "unitsPerPackage" INTEGER,
    "currentStock" DECIMAL(12,3) NOT NULL,
    "avgUnitCost" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "salePrice" DECIMAL(12,2),
    "reorderThreshold" DECIMAL(12,3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryTransaction" (
    "id" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "transactionType" "TransactionType" NOT NULL,
    "reason" "TransactionReason" NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitCostAtTime" DECIMAL(12,4),
    "costAmount" DECIMAL(12,2),
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "relatedEntityId" TEXT,
    "relatedEntityType" TEXT,
    "reversalOfId" TEXT,
    "notes" TEXT,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessingEvent" (
    "id" TEXT NOT NULL,
    "flockId" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL,
    "birdsProcessed" INTEGER NOT NULL,
    "totalLiveWeightKg" DECIMAL(12,3) NOT NULL,
    "totalDressedWeightKg" DECIMAL(12,3),
    "producedItemId" TEXT NOT NULL,
    "unitsProduced" DECIMAL(12,3) NOT NULL,
    "notes" TEXT,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrder" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL,
    "status" "SalesOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "fulfilledAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrderItem" (
    "id" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "sourceFlockId" TEXT,
    "productName" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertSetting" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "flockId" TEXT,
    "alertType" "AlertType" NOT NULL,
    "thresholdValue" DECIMAL(12,3) NOT NULL,
    "cooldownHours" INTEGER NOT NULL DEFAULT 24,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertRecipient" (
    "id" TEXT NOT NULL,
    "alertSettingId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertEvent" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "alertSettingId" TEXT,
    "alertType" "AlertType" NOT NULL,
    "flockId" TEXT,
    "inventoryItemId" TEXT,
    "triggeredAt" TIMESTAMP(3) NOT NULL,
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "dedupeKey" TEXT NOT NULL,
    "notificationStatus" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrowthCurve" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "breed" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrowthCurve_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrowthCurvePoint" (
    "id" TEXT NOT NULL,
    "growthCurveId" TEXT NOT NULL,
    "dayOfCycle" INTEGER NOT NULL,
    "targetWeightG" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "GrowthCurvePoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "userId" UUID,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_authUserId_key" ON "User"("authUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_farmId_status_idx" ON "User"("farmId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Farm_ownerId_key" ON "Farm"("ownerId");

-- CreateIndex
CREATE INDEX "Flock_farmId_status_idx" ON "Flock"("farmId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Flock_farmId_name_key" ON "Flock"("farmId", "name");

-- CreateIndex
CREATE INDEX "Bird_flockId_status_idx" ON "Bird"("flockId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Bird_flockId_tag_key" ON "Bird"("flockId", "tag");

-- CreateIndex
CREATE INDEX "DailyLog_flockId_logDate_idx" ON "DailyLog"("flockId", "logDate" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "DailyLog_flockId_logDate_key" ON "DailyLog"("flockId", "logDate");

-- CreateIndex
CREATE INDEX "WeightRecord_flockId_recordDate_idx" ON "WeightRecord"("flockId", "recordDate" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "WeightRecord_flockId_recordDate_key" ON "WeightRecord"("flockId", "recordDate");

-- CreateIndex
CREATE INDEX "HealthLog_flockId_status_idx" ON "HealthLog"("flockId", "status");

-- CreateIndex
CREATE INDEX "HealthLog_flockId_logDate_idx" ON "HealthLog"("flockId", "logDate" DESC);

-- CreateIndex
CREATE INDEX "Treatment_inventoryItemId_idx" ON "Treatment"("inventoryItemId");

-- CreateIndex
CREATE INDEX "Treatment_withdrawalUntil_idx" ON "Treatment"("withdrawalUntil");

-- CreateIndex
CREATE INDEX "InventoryItem_farmId_type_idx" ON "InventoryItem"("farmId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_farmId_name_key" ON "InventoryItem"("farmId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryTransaction_reversalOfId_key" ON "InventoryTransaction"("reversalOfId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_inventoryItemId_transactionDate_idx" ON "InventoryTransaction"("inventoryItemId", "transactionDate" DESC);

-- CreateIndex
CREATE INDEX "InventoryTransaction_relatedEntityType_relatedEntityId_idx" ON "InventoryTransaction"("relatedEntityType", "relatedEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessingEvent_flockId_key" ON "ProcessingEvent"("flockId");

-- CreateIndex
CREATE INDEX "Customer_farmId_name_idx" ON "Customer"("farmId", "name");

-- CreateIndex
CREATE INDEX "SalesOrder_farmId_status_idx" ON "SalesOrder"("farmId", "status");

-- CreateIndex
CREATE INDEX "SalesOrder_customerId_orderDate_idx" ON "SalesOrder"("customerId", "orderDate" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrder_farmId_orderNumber_key" ON "SalesOrder"("farmId", "orderNumber");

-- CreateIndex
CREATE INDEX "SalesOrderItem_salesOrderId_idx" ON "SalesOrderItem"("salesOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_salesOrderId_key" ON "Invoice"("salesOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "AlertSetting_farmId_flockId_alertType_key" ON "AlertSetting"("farmId", "flockId", "alertType");

-- CreateIndex
CREATE UNIQUE INDEX "AlertRecipient_alertSettingId_email_key" ON "AlertRecipient"("alertSettingId", "email");

-- CreateIndex
CREATE INDEX "AlertEvent_farmId_triggeredAt_idx" ON "AlertEvent"("farmId", "triggeredAt" DESC);

-- CreateIndex
CREATE INDEX "AlertEvent_notificationStatus_idx" ON "AlertEvent"("notificationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "AlertEvent_dedupeKey_key" ON "AlertEvent"("dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "GrowthCurve_farmId_name_key" ON "GrowthCurve"("farmId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "GrowthCurvePoint_growthCurveId_dayOfCycle_key" ON "GrowthCurvePoint"("growthCurveId", "dayOfCycle");

-- CreateIndex
CREATE INDEX "AuditLog_farmId_createdAt_idx" ON "AuditLog"("farmId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Farm" ADD CONSTRAINT "Farm_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flock" ADD CONSTRAINT "Flock_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flock" ADD CONSTRAINT "Flock_defaultFeedItemId_fkey" FOREIGN KEY ("defaultFeedItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flock" ADD CONSTRAINT "Flock_growthCurveId_fkey" FOREIGN KEY ("growthCurveId") REFERENCES "GrowthCurve"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bird" ADD CONSTRAINT "Bird_flockId_fkey" FOREIGN KEY ("flockId") REFERENCES "Flock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyLog" ADD CONSTRAINT "DailyLog_flockId_fkey" FOREIGN KEY ("flockId") REFERENCES "Flock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyLog" ADD CONSTRAINT "DailyLog_feedItemId_fkey" FOREIGN KEY ("feedItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyLog" ADD CONSTRAINT "DailyLog_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeightRecord" ADD CONSTRAINT "WeightRecord_flockId_fkey" FOREIGN KEY ("flockId") REFERENCES "Flock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeightRecord" ADD CONSTRAINT "WeightRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthLog" ADD CONSTRAINT "HealthLog_flockId_fkey" FOREIGN KEY ("flockId") REFERENCES "Flock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthLog" ADD CONSTRAINT "HealthLog_birdId_fkey" FOREIGN KEY ("birdId") REFERENCES "Bird"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthLog" ADD CONSTRAINT "HealthLog_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Treatment" ADD CONSTRAINT "Treatment_healthLogId_fkey" FOREIGN KEY ("healthLogId") REFERENCES "HealthLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Treatment" ADD CONSTRAINT "Treatment_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Treatment" ADD CONSTRAINT "Treatment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "InventoryTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessingEvent" ADD CONSTRAINT "ProcessingEvent_flockId_fkey" FOREIGN KEY ("flockId") REFERENCES "Flock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessingEvent" ADD CONSTRAINT "ProcessingEvent_producedItemId_fkey" FOREIGN KEY ("producedItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessingEvent" ADD CONSTRAINT "ProcessingEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderItem" ADD CONSTRAINT "SalesOrderItem_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderItem" ADD CONSTRAINT "SalesOrderItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderItem" ADD CONSTRAINT "SalesOrderItem_sourceFlockId_fkey" FOREIGN KEY ("sourceFlockId") REFERENCES "Flock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertSetting" ADD CONSTRAINT "AlertSetting_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertSetting" ADD CONSTRAINT "AlertSetting_flockId_fkey" FOREIGN KEY ("flockId") REFERENCES "Flock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertRecipient" ADD CONSTRAINT "AlertRecipient_alertSettingId_fkey" FOREIGN KEY ("alertSettingId") REFERENCES "AlertSetting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_alertSettingId_fkey" FOREIGN KEY ("alertSettingId") REFERENCES "AlertSetting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_flockId_fkey" FOREIGN KEY ("flockId") REFERENCES "Flock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrowthCurve" ADD CONSTRAINT "GrowthCurve_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrowthCurvePoint" ADD CONSTRAINT "GrowthCurvePoint_growthCurveId_fkey" FOREIGN KEY ("growthCurveId") REFERENCES "GrowthCurve"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
