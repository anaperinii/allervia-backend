-- AlterTable
ALTER TABLE "Dose" ALTER COLUMN "scheduledAt" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "ProfessionalInvite" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "professionalId" TEXT,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfessionalInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProfessionalInvite_token_key" ON "ProfessionalInvite"("token");

-- CreateIndex
CREATE INDEX "ProfessionalInvite_token_idx" ON "ProfessionalInvite"("token");

-- CreateIndex
CREATE INDEX "ProfessionalInvite_email_idx" ON "ProfessionalInvite"("email");

-- CreateIndex
CREATE INDEX "ProfessionalInvite_organizationId_isActive_idx" ON "ProfessionalInvite"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "ProfessionalInvite_expiresAt_idx" ON "ProfessionalInvite"("expiresAt");

-- CreateIndex
CREATE INDEX "ProfessionalInvite_professionalId_idx" ON "ProfessionalInvite"("professionalId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfessionalInvite_email_organizationId_isActive_key" ON "ProfessionalInvite"("email", "organizationId", "isActive");

-- AddForeignKey
ALTER TABLE "ProfessionalInvite" ADD CONSTRAINT "ProfessionalInvite_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalInvite" ADD CONSTRAINT "ProfessionalInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalInvite" ADD CONSTRAINT "ProfessionalInvite_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE SET NULL ON UPDATE CASCADE;
