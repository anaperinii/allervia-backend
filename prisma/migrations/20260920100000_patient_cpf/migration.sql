-- As FKs de createdById em TreatmentProtocol, ProtocolVersion e
-- ProtocolPrescription existem no banco desde 20260917010000, mas o schema
-- Prisma não declara essas relações. O diff automático propôs removê-las;
-- mantê-las preserva a integridade referencial já garantida (mesma decisão da
-- migration 20260919120000).

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "cpf" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Patient_organizationId_cpf_key" ON "Patient"("organizationId", "cpf");
