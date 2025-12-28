/*
  Warnings:

  - The values [ADMINISTERED,SKIPPED] on the enum `DoseStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "DoseStatus_new" AS ENUM ('SCHEDULED', 'ADMINISTERED_ON_SCHEDULE', 'ADMINISTERED_OFF_SCHEDULE', 'ENTERED_IN_ERROR');
ALTER TABLE "public"."Dose" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Dose" ALTER COLUMN "status" TYPE "DoseStatus_new" USING ("status"::text::"DoseStatus_new");
ALTER TYPE "DoseStatus" RENAME TO "DoseStatus_old";
ALTER TYPE "DoseStatus_new" RENAME TO "DoseStatus";
DROP TYPE "public"."DoseStatus_old";
ALTER TABLE "Dose" ALTER COLUMN "status" SET DEFAULT 'SCHEDULED';
COMMIT;
