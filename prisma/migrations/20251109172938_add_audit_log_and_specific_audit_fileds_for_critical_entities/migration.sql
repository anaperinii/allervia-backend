/*
  Warnings:

  - Added the required column `createdById` to the `Dose` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdById` to the `Immunotherapy` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdById` to the `Patient` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Dose" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "archivedById" TEXT,
ADD COLUMN     "createdById" TEXT NOT NULL,
ADD COLUMN     "updatedById" TEXT,
ALTER COLUMN "administeredAt" DROP DEFAULT,
ALTER COLUMN "status" SET DEFAULT 'SCHEDULED';

-- AlterTable
ALTER TABLE "public"."Immunotherapy" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "archivedById" TEXT,
ADD COLUMN     "createdById" TEXT NOT NULL,
ADD COLUMN     "updatedById" TEXT;

-- AlterTable
ALTER TABLE "public"."Patient" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "archivedById" TEXT,
ADD COLUMN     "createdById" TEXT NOT NULL,
ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updatedById" TEXT;

-- CreateTable
CREATE TABLE "public"."AuditLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "oldValues" JSONB,
    "newValues" JSONB,
    "changedFields" TEXT[],
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    "organizationId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_timestamp_idx" ON "public"."AuditLog"("entityType", "entityId", "timestamp");

-- CreateIndex
CREATE INDEX "AuditLog_userId_timestamp_idx" ON "public"."AuditLog"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_timestamp_idx" ON "public"."AuditLog"("organizationId", "timestamp");

-- CreateIndex
CREATE INDEX "AuditLog_timestamp_idx" ON "public"."AuditLog"("timestamp");

-- CreateIndex
CREATE INDEX "Dose_immunotherapyId_scheduledAt_idx" ON "public"."Dose"("immunotherapyId", "scheduledAt");

-- CreateIndex
CREATE INDEX "Dose_status_scheduledAt_idx" ON "public"."Dose"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "Dose_administeredById_idx" ON "public"."Dose"("administeredById");

-- CreateIndex
CREATE INDEX "Dose_scheduledAt_idx" ON "public"."Dose"("scheduledAt");

-- CreateIndex
CREATE INDEX "Immunotherapy_patientId_status_isArchived_idx" ON "public"."Immunotherapy"("patientId", "status", "isArchived");

-- CreateIndex
CREATE INDEX "Immunotherapy_responsiblePhysicianId_idx" ON "public"."Immunotherapy"("responsiblePhysicianId");

-- CreateIndex
CREATE INDEX "Immunotherapy_inductionStartDate_idx" ON "public"."Immunotherapy"("inductionStartDate");

-- CreateIndex
CREATE INDEX "Membership_organizationId_isActive_idx" ON "public"."Membership"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "Membership_userId_isActive_idx" ON "public"."Membership"("userId", "isActive");

-- CreateIndex
CREATE INDEX "Organization_taxId_idx" ON "public"."Organization"("taxId");

-- CreateIndex
CREATE INDEX "Patient_primaryOrganizationId_isActive_isArchived_idx" ON "public"."Patient"("primaryOrganizationId", "isActive", "isArchived");

-- CreateIndex
CREATE INDEX "Patient_userId_idx" ON "public"."Patient"("userId");

-- CreateIndex
CREATE INDEX "Patient_phoneNumber_idx" ON "public"."Patient"("phoneNumber");

-- CreateIndex
CREATE INDEX "Patient_fullName_idx" ON "public"."Patient"("fullName");

-- CreateIndex
CREATE INDEX "Patient_birthDate_idx" ON "public"."Patient"("birthDate");

-- CreateIndex
CREATE INDEX "Professional_userId_idx" ON "public"."Professional"("userId");

-- CreateIndex
CREATE INDEX "Professional_specialty_idx" ON "public"."Professional"("specialty");

-- CreateIndex
CREATE INDEX "Role_name_isActive_idx" ON "public"."Role"("name", "isActive");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "public"."User"("email");

-- CreateIndex
CREATE INDEX "User_type_isActive_idx" ON "public"."User"("type", "isActive");

-- CreateIndex
CREATE INDEX "User_organizationId_idx" ON "public"."User"("organizationId");

-- CreateIndex
CREATE INDEX "UserRole_userId_isActive_idx" ON "public"."UserRole"("userId", "isActive");

-- CreateIndex
CREATE INDEX "UserRole_roleId_isActive_idx" ON "public"."UserRole"("roleId", "isActive");

-- AddForeignKey
ALTER TABLE "public"."Patient" ADD CONSTRAINT "Patient_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Patient" ADD CONSTRAINT "Patient_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Patient" ADD CONSTRAINT "Patient_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Immunotherapy" ADD CONSTRAINT "Immunotherapy_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Immunotherapy" ADD CONSTRAINT "Immunotherapy_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Immunotherapy" ADD CONSTRAINT "Immunotherapy_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Dose" ADD CONSTRAINT "Dose_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Dose" ADD CONSTRAINT "Dose_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Dose" ADD CONSTRAINT "Dose_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
