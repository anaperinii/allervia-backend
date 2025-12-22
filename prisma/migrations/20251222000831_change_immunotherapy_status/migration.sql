/*
  Warnings:

  - The values [ACTIVE,CANCELLED] on the enum `TherapyStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "TherapyStatus_new" AS ENUM ('IN_PROGRESS', 'SUSPENDED', 'COMPLETED');
ALTER TABLE "public"."Immunotherapy" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Immunotherapy" ALTER COLUMN "status" TYPE "TherapyStatus_new" USING ("status"::text::"TherapyStatus_new");
ALTER TYPE "TherapyStatus" RENAME TO "TherapyStatus_old";
ALTER TYPE "TherapyStatus_new" RENAME TO "TherapyStatus";
DROP TYPE "public"."TherapyStatus_old";
ALTER TABLE "Immunotherapy" ALTER COLUMN "status" SET DEFAULT 'IN_PROGRESS';
COMMIT;

-- AlterTable
ALTER TABLE "Immunotherapy" ALTER COLUMN "status" SET DEFAULT 'IN_PROGRESS';
