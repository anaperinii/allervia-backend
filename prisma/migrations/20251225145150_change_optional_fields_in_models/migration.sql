/*
  Warnings:

  - Made the column `organizationId` on table `InternalUserInvite` required. This step will fail if there are existing NULL values in that column.
  - Made the column `createdById` on table `InternalUserInvite` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "InternalUserInvite" DROP CONSTRAINT "InternalUserInvite_createdById_fkey";

-- DropForeignKey
ALTER TABLE "InternalUserInvite" DROP CONSTRAINT "InternalUserInvite_organizationId_fkey";

-- AlterTable
ALTER TABLE "InternalUserInvite" ALTER COLUMN "organizationId" SET NOT NULL,
ALTER COLUMN "createdById" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "InternalUserInvite" ADD CONSTRAINT "InternalUserInvite_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalUserInvite" ADD CONSTRAINT "InternalUserInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
