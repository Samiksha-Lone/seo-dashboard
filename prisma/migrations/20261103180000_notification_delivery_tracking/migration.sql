ALTER TABLE "Report"
ADD COLUMN "whatsAppAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "whatsAppClaimedAt" TIMESTAMP(3),
ADD COLUMN "whatsAppSentAt" TIMESTAMP(3),
ADD COLUMN "whatsAppCompletedAt" TIMESTAMP(3),
ADD COLUMN "whatsAppLastError" TEXT,
ADD COLUMN "emailAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "emailClaimedAt" TIMESTAMP(3),
ADD COLUMN "emailSentAt" TIMESTAMP(3),
ADD COLUMN "emailCompletedAt" TIMESTAMP(3),
ADD COLUMN "emailLastError" TEXT;

UPDATE "Report"
SET
  "whatsAppAttempts" = 1,
  "whatsAppCompletedAt" = "notificationAttemptedAt",
  "whatsAppLastError" = 'Legacy attempt outcome unknown; suppressed to prevent a duplicate.'
WHERE "notificationAttemptedAt" IS NOT NULL;
