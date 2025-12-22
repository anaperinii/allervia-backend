/*
  Warnings:

  - Made the column `nextIntervalInDays` on table `Dose` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "public"."PatientStatus" AS ENUM ('IN_TREATMENT', 'TREATMENT_INTERRUPTED', 'DISCHARGED', 'DECEASED');

-- CreateEnum
CREATE TYPE "public"."DoseStatus" AS ENUM ('ADMINISTERED', 'SKIPPED', 'ENTERED_IN_ERROR');

-- AlterTable
ALTER TABLE "public"."Dose" ADD COLUMN     "status" "public"."DoseStatus" NOT NULL DEFAULT 'ADMINISTERED',
ALTER COLUMN "nextIntervalInDays" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."Patient" ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "status" "public"."PatientStatus" NOT NULL DEFAULT 'IN_TREATMENT';

-- AlterTable
ALTER TABLE "public"."Professional" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;
