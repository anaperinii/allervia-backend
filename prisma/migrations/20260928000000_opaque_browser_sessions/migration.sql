-- Additive cutover: no clinical data or legacy token history is deleted.
CREATE TABLE "AuthSession" (
 "id" TEXT NOT NULL, "secretHash" TEXT NOT NULL, "userId" TEXT NOT NULL,
 "organizationId" TEXT NOT NULL, "authVersion" INTEGER NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "expiresAt" TIMESTAMP(3) NOT NULL,
 "lastInteractiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "mfaVerifiedAt" TIMESTAMP(3), "reauthenticatedAt" TIMESTAMP(3),
 "revokedAt" TIMESTAMP(3), "revokedReason" "AuthSessionRevokeReason",
 "userAgent" TEXT, "ipAddressHash" TEXT,
 CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AuthSession_secretHash_key" ON "AuthSession"("secretHash");
CREATE INDEX "AuthSession_userId_revokedAt_idx" ON "AuthSession"("userId", "revokedAt");
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");
UPDATE "RefreshFamily" SET "revokedAt" = CURRENT_TIMESTAMP, "revokedReason" = 'SUPERSEDED' WHERE "revokedAt" IS NULL;
