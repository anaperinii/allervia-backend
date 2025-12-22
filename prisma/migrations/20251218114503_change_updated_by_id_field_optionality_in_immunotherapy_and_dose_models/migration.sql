/*
  Warnings:

  - Made the column `updatedById` on table `Dose` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updatedById` on table `Immunotherapy` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Dose" DROP CONSTRAINT "Dose_updatedById_fkey";

-- DropForeignKey
ALTER TABLE "Immunotherapy" DROP CONSTRAINT "Immunotherapy_updatedById_fkey";

-- AlterTable
ALTER TABLE "Dose" ALTER COLUMN "updatedById" SET NOT NULL;

-- AlterTable
ALTER TABLE "Immunotherapy" ALTER COLUMN "updatedById" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Immunotherapy" ADD CONSTRAINT "Immunotherapy_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dose" ADD CONSTRAINT "Dose_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
