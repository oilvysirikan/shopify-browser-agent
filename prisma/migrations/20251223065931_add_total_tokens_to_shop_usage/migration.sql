-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ShopUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "totalRequests" INTEGER NOT NULL DEFAULT 0,
    "totalTokensUsed" INTEGER NOT NULL DEFAULT 0,
    "monthlyQuota" INTEGER NOT NULL DEFAULT 1000,
    "quotaResetDate" DATETIME NOT NULL,
    "planTier" TEXT NOT NULL DEFAULT 'free',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_ShopUsage" ("createdAt", "id", "isActive", "monthlyQuota", "planTier", "quotaResetDate", "shop", "totalRequests", "updatedAt") SELECT "createdAt", "id", "isActive", "monthlyQuota", "planTier", "quotaResetDate", "shop", "totalRequests", "updatedAt" FROM "ShopUsage";
DROP TABLE "ShopUsage";
ALTER TABLE "new_ShopUsage" RENAME TO "ShopUsage";
CREATE UNIQUE INDEX "ShopUsage_shop_key" ON "ShopUsage"("shop");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
