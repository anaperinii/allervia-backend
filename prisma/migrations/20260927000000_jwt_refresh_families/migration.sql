BEGIN;
CREATE TABLE "RefreshFamily" (
  "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "authVersion" INTEGER NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL, "lastInteractiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "mfaVerifiedAt" TIMESTAMP(3), "reauthenticatedAt" TIMESTAMP(3), "revokedAt" TIMESTAMP(3),
  "revokedReason" "AuthSessionRevokeReason", "userAgent" TEXT, "ipAddressHash" TEXT
);
CREATE INDEX "RefreshFamily_userId_revokedAt_idx" ON "RefreshFamily"("userId", "revokedAt");
CREATE INDEX "RefreshFamily_expiresAt_idx" ON "RefreshFamily"("expiresAt");
CREATE TABLE "RefreshToken" (
  "id" TEXT PRIMARY KEY, "familyId" TEXT NOT NULL REFERENCES "RefreshFamily"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "secretHash" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL, "consumedAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX "RefreshToken_secretHash_key" ON "RefreshToken"("secretHash");
CREATE INDEX "RefreshToken_familyId_consumedAt_idx" ON "RefreshToken"("familyId", "consumedAt");
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");
-- At most one current credential per family, enforced even under concurrency.
CREATE UNIQUE INDEX "RefreshToken_one_current_per_family" ON "RefreshToken"("familyId") WHERE "consumedAt" IS NULL;
-- Explicit cutover: old browser sessions must never be resurrected by rollback.
UPDATE "AuthSession" SET "revokedAt" = CURRENT_TIMESTAMP, "revokedReason" = 'SUPERSEDED' WHERE "revokedAt" IS NULL;
COMMIT;
