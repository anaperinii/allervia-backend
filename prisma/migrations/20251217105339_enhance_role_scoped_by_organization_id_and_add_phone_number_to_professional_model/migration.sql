/*
  Warnings:

  - You are about to drop the column `fullName` on the `Professional` table. All the data in the column will be lost.
  - You are about to drop the `ProfessionalInvite` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `phoneNumber` to the `Professional` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `Role` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fullName` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "UserType" ADD VALUE 'ADMIN';

-- DropForeignKey
ALTER TABLE "ProfessionalInvite" DROP CONSTRAINT "ProfessionalInvite_createdById_fkey";

-- DropForeignKey
ALTER TABLE "ProfessionalInvite" DROP CONSTRAINT "ProfessionalInvite_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "ProfessionalInvite" DROP CONSTRAINT "ProfessionalInvite_professionalId_fkey";

-- AlterTable
ALTER TABLE "Professional" DROP COLUMN "fullName",
ADD COLUMN     "phoneNumber" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "fullName" TEXT NOT NULL,
ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "ProfessionalInvite";

-- CreateTable
CREATE TABLE "InternalUserInvite" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "roleType" "RoleType" NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "professionalId" TEXT,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternalUserInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InternalUserInvite_token_key" ON "InternalUserInvite"("token");

-- CreateIndex
CREATE INDEX "InternalUserInvite_token_idx" ON "InternalUserInvite"("token");

-- CreateIndex
CREATE INDEX "InternalUserInvite_email_idx" ON "InternalUserInvite"("email");

-- CreateIndex
CREATE INDEX "InternalUserInvite_organizationId_isActive_idx" ON "InternalUserInvite"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "InternalUserInvite_expiresAt_idx" ON "InternalUserInvite"("expiresAt");

-- CreateIndex
CREATE INDEX "InternalUserInvite_professionalId_idx" ON "InternalUserInvite"("professionalId");

-- CreateIndex
CREATE UNIQUE INDEX "InternalUserInvite_email_organizationId_isActive_key" ON "InternalUserInvite"("email", "organizationId", "isActive");

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalUserInvite" ADD CONSTRAINT "InternalUserInvite_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalUserInvite" ADD CONSTRAINT "InternalUserInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalUserInvite" ADD CONSTRAINT "InternalUserInvite_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE SET NULL ON UPDATE CASCADE;
