-- DropForeignKey
ALTER TABLE "Dose" DROP CONSTRAINT "Dose_administeredById_fkey";

-- AlterTable
ALTER TABLE "Dose" ALTER COLUMN "administeredById" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Dose" ADD CONSTRAINT "Dose_administeredById_fkey" FOREIGN KEY ("administeredById") REFERENCES "Professional"("id") ON DELETE SET NULL ON UPDATE CASCADE;
