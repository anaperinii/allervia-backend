/*
  Warnings:

  - You are about to drop the column `organizationId` on the `Patient` table. All the data in the column will be lost.
  - Added the required column `scheduledAt` to the `Dose` table without a default value. This is not possible if the table is not empty.
  - Added the required column `primaryOrganizationId` to the `Patient` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "public"."DoseStatus" ADD VALUE 'SCHEDULED';

-- DropForeignKey
ALTER TABLE "public"."Patient" DROP CONSTRAINT "Patient_organizationId_fkey";

-- AlterTable
ALTER TABLE "public"."Dose" ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "scheduledAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "administeredAt" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."Immunotherapy" ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."Patient" DROP COLUMN "organizationId",
ADD COLUMN     "primaryOrganizationId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."Patient" ADD CONSTRAINT "Patient_primaryOrganizationId_fkey" FOREIGN KEY ("primaryOrganizationId") REFERENCES "public"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
