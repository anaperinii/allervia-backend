/*
  Warnings:

  - Made the column `updatedById` on table `Patient` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Patient" DROP CONSTRAINT "Patient_updatedById_fkey";

-- AlterTable
ALTER TABLE "Patient" ALTER COLUMN "updatedById" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
