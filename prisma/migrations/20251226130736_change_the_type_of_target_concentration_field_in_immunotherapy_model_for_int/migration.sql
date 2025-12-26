/*
  Warnings:

  - Changed the type of `targetConcentration` on the `Immunotherapy` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "Immunotherapy" DROP COLUMN "targetConcentration",
ADD COLUMN     "targetConcentration" INTEGER NOT NULL;
