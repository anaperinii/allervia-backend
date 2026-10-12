ALTER TABLE "CalendarSyncJob" ADD COLUMN "attemptId" TEXT;

CREATE TABLE "OAuthStateNonce" (
  "nonce" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OAuthStateNonce_pkey" PRIMARY KEY ("nonce")
);

CREATE INDEX "OAuthStateNonce_expiresAt_idx" ON "OAuthStateNonce"("expiresAt");
