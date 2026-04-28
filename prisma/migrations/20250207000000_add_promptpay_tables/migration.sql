-- CreateTable
CREATE TABLE "PromptpayTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "amount" REAL,
    "qrData" TEXT NOT NULL,
    "expiryDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    "orderId" TEXT,
    "merchantId" TEXT NOT NULL,
    "isDynamic" BOOLEAN NOT NULL,
    "paidAt" DATETIME,
    "paidAmount" REAL,
    "paidBy" TEXT,
    "referenceNo" TEXT,
    "bank" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "response" TEXT,
    "error" TEXT,
    "sentAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "PromptpayTransaction_shop_status_idx" ON "PromptpayTransaction"("shop", "status");

-- CreateIndex
CREATE INDEX "PromptpayTransaction_orderId_idx" ON "PromptpayTransaction"("orderId");

-- CreateIndex
CREATE INDEX "PromptpayTransaction_merchantId_idx" ON "PromptpayTransaction"("merchantId");

-- CreateIndex
CREATE INDEX "PromptpayTransaction_expiryDate_idx" ON "PromptpayTransaction"("expiryDate");

-- CreateIndex
CREATE INDEX "Notification_shop_sentAt_idx" ON "Notification"("shop", "sentAt");

-- CreateIndex
CREATE INDEX "Notification_type_status_idx" ON "Notification"("type", "status");

-- CreateIndex
CREATE INDEX "Notification_recipient_idx" ON "Notification"("recipient");
