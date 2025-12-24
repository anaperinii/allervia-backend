/*
  Warnings:

  - You are about to drop the `Professional` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Dose" DROP CONSTRAINT "Dose_administeredById_fkey";

-- DropForeignKey
ALTER TABLE "Immunotherapy" DROP CONSTRAINT "Immunotherapy_responsiblePhysicianId_fkey";

-- DropForeignKey
ALTER TABLE "InternalUserInvite" DROP CONSTRAINT "InternalUserInvite_createdById_fkey";

-- DropForeignKey
ALTER TABLE "InternalUserInvite" DROP CONSTRAINT "InternalUserInvite_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "InternalUserInvite" DROP CONSTRAINT "InternalUserInvite_professionalId_fkey";

-- DropForeignKey
ALTER TABLE "Professional" DROP CONSTRAINT "Professional_userId_fkey";

-- AlterTable
ALTER TABLE "InternalUserInvite" ALTER COLUMN "organizationId" DROP NOT NULL,
ALTER COLUMN "createdById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phoneNumber" TEXT,
ADD COLUMN     "specialty" TEXT;

-- DropTable
DROP TABLE "Professional";

-- CreateIndex
CREATE INDEX "User_specialty_idx" ON "User"("specialty");

-- AddForeignKey
ALTER TABLE "Immunotherapy" ADD CONSTRAINT "Immunotherapy_responsiblePhysicianId_fkey" FOREIGN KEY ("responsiblePhysicianId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dose" ADD CONSTRAINT "Dose_administeredById_fkey" FOREIGN KEY ("administeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalUserInvite" ADD CONSTRAINT "InternalUserInvite_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalUserInvite" ADD CONSTRAINT "InternalUserInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalUserInvite" ADD CONSTRAINT "InternalUserInvite_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
