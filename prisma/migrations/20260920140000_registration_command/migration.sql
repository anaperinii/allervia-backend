-- As FKs de createdById em TreatmentProtocol, ProtocolVersion e
-- ProtocolPrescription existem no banco desde 20260917010000, mas o schema
-- Prisma não declara essas relações; o diff propôs removê-las e mantê-las
-- preserva a integridade referencial (mesma decisão das migrations anteriores).

-- CreateTable
CREATE TABLE "RegistrationCommand" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistrationCommand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationCommand_organizationId_actorId_key_key" ON "RegistrationCommand"("organizationId", "actorId", "key");
