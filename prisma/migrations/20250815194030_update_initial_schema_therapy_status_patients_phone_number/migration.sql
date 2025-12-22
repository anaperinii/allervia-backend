/*
  Warnings:

  - You are about to drop the column `nextDoseDate` on the `Dose` table. All the data in the column will be lost.
  - Added the required column `phoneNumber` to the `Patient` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."TherapyStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "public"."Dose" DROP COLUMN "nextDoseDate";

-- AlterTable
ALTER TABLE "public"."Immunotherapy" ADD COLUMN     "status" "public"."TherapyStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "public"."Patient" ADD COLUMN     "phoneNumber" TEXT NOT NULL;
