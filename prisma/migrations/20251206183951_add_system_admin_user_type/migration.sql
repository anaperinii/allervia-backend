/*
  Warnings:

  - Added the required column `roleType` to the `ProfessionalInvite` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "UserType" ADD VALUE 'SYSTEM_ADMIN';

-- AlterTable
ALTER TABLE "ProfessionalInvite" ADD COLUMN     "roleType" "RoleType" NOT NULL;
