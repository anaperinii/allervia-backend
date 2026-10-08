-- CreateEnum
CREATE TYPE "MfaFactorType" AS ENUM ('TOTP');

-- CreateEnum
CREATE TYPE "PreAuthPurpose" AS ENUM ('MFA_CHALLENGE', 'MFA_ENROLLMENT', 'REAUTHENTICATION');

-- CreateEnum
CREATE TYPE "AuthSessionRevokeReason" AS ENUM ('LOGOUT', 'LOGOUT_ALL', 'DEVICE_REVOKED', 'PASSWORD_CHANGED', 'ACCOUNT_DISABLED', 'MFA_CHANGED', 'IDLE_TIMEOUT', 'ABSOLUTE_TIMEOUT', 'SUPERSEDED');

-- As FKs de createdById em TreatmentProtocol, ProtocolVersion e
-- ProtocolPrescription existem no banco desde 20260917010000, mas o schema
-- Prisma não declara essas relações. O diff automático propôs removê-las;
-- mantê-las preserva a integridade referencial já garantida. O drift entre
-- schema e banco continua registrado como pendência da I1.

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "csrfTokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "authVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastInteractiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mfaVerifiedAt" TIMESTAMP(3),
    "reauthenticatedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedReason" "AuthSessionRevokeReason",
    "userAgent" TEXT,
    "ipAddressHash" TEXT,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MfaCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "MfaFactorType" NOT NULL DEFAULT 'TOTP',
    "label" TEXT NOT NULL,
    "secretCiphertext" TEXT NOT NULL,
    "secretIv" TEXT NOT NULL,
    "secretAuthTag" TEXT NOT NULL,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "confirmedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "lastUsedCounter" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "MfaCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MfaRecoveryCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "MfaRecoveryCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreAuthChallenge" (
    "id" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "PreAuthPurpose" NOT NULL,
    "sessionId" TEXT,
    "credentialId" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PreAuthChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthAttempt" (
    "id" TEXT NOT NULL,
    "identifierHash" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "succeeded" BOOLEAN NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_secretHash_key" ON "AuthSession"("secretHash");

-- CreateIndex
CREATE INDEX "AuthSession_userId_revokedAt_idx" ON "AuthSession"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

-- CreateIndex
CREATE INDEX "MfaCredential_userId_revokedAt_idx" ON "MfaCredential"("userId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MfaRecoveryCode_codeHash_key" ON "MfaRecoveryCode"("codeHash");

-- CreateIndex
CREATE INDEX "MfaRecoveryCode_userId_consumedAt_idx" ON "MfaRecoveryCode"("userId", "consumedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PreAuthChallenge_secretHash_key" ON "PreAuthChallenge"("secretHash");

-- CreateIndex
CREATE INDEX "PreAuthChallenge_userId_purpose_idx" ON "PreAuthChallenge"("userId", "purpose");

-- CreateIndex
CREATE INDEX "PreAuthChallenge_expiresAt_idx" ON "PreAuthChallenge"("expiresAt");

-- CreateIndex
CREATE INDEX "AuthAttempt_identifierHash_operation_occurredAt_idx" ON "AuthAttempt"("identifierHash", "operation", "occurredAt");

-- CreateIndex
CREATE INDEX "AuthAttempt_occurredAt_idx" ON "AuthAttempt"("occurredAt");

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MfaCredential" ADD CONSTRAINT "MfaCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MfaRecoveryCode" ADD CONSTRAINT "MfaRecoveryCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreAuthChallenge" ADD CONSTRAINT "PreAuthChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

