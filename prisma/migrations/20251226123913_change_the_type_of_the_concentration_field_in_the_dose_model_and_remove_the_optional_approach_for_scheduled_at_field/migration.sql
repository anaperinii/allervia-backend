/*
  Warnings:

  - Changed the type of `concentration` on the `Dose` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Made the column `scheduledAt` on table `Dose` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Dose" DROP COLUMN "concentration",
ADD COLUMN     "concentration" INTEGER NOT NULL,
ALTER COLUMN "scheduledAt" SET NOT NULL;
