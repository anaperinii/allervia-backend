ALTER TABLE "OutboxEvent" ADD COLUMN "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "OutboxEvent" ADD COLUMN "leaseUntil" TIMESTAMP(3);
ALTER TABLE "OutboxEvent" ADD COLUMN "attemptId" TEXT;

CREATE INDEX "OutboxEvent_processedAt_nextAttemptAt_createdAt_idx" ON "OutboxEvent"("processedAt", "nextAttemptAt", "createdAt");
