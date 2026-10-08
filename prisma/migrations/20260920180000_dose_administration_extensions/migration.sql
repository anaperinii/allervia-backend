-- As FKs de createdById em TreatmentProtocol, ProtocolVersion e
-- ProtocolPrescription existem no banco desde 20260917010000, mas o schema
-- Prisma não declara essas relações; o diff propôs removê-las e mantê-las
-- preserva a integridade referencial (mesma decisão das migrations anteriores).

-- CreateEnum
CREATE TYPE "DoseImmediateConduct" AS ENUM ('MAINTAIN', 'REQUEST_PHYSICIAN_REVIEW', 'SUSPEND_TREATMENT');

-- AlterTable
ALTER TABLE "Dose" ADD COLUMN     "administrationEndedAt" TIMESTAMP(3),
ADD COLUMN     "immediateConduct" "DoseImmediateConduct",
ADD COLUMN     "immediateConductJustification" TEXT,
ADD COLUMN     "performedById" TEXT;

-- CreateIndex
CREATE INDEX "Dose_performedById_idx" ON "Dose"("performedById");

-- AddForeignKey
ALTER TABLE "Dose" ADD CONSTRAINT "Dose_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "Professional"("id") ON DELETE SET NULL ON UPDATE CASCADE;

