-- CreateEnum
CREATE TYPE "ProtocolVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RETIRED');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "automationEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "timeZone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo';

-- AlterTable
ALTER TABLE "Immunotherapy" ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "targetVolumeExact" DECIMAL(65,30);

-- AlterTable
ALTER TABLE "Dose" ADD COLUMN     "administeredStepId" TEXT,
ADD COLUMN     "administeredValues" JSONB,
ADD COLUMN     "administeredVolumeExact" DECIMAL(65,30),
ADD COLUMN     "plannedStepId" TEXT,
ADD COLUMN     "plannedValues" JSONB,
ADD COLUMN     "plannedVolumeExact" DECIMAL(65,30),
ADD COLUMN     "prescriptionId" TEXT,
ADD COLUMN     "recommendation" JSONB,
ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sourceDoseId" TEXT;

-- CreateTable
CREATE TABLE "TreatmentProtocol" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "route" "AdministrationRoute" NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TreatmentProtocol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProtocolVersion" (
    "id" TEXT NOT NULL,
    "protocolId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "ProtocolVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "definition" JSONB NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "engineVersion" TEXT NOT NULL DEFAULT '1',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "publishedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "ProtocolVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationProtocolDefault" (
    "organizationId" TEXT NOT NULL,
    "route" "AdministrationRoute" NOT NULL,
    "versionId" TEXT NOT NULL,

    CONSTRAINT "OrganizationProtocolDefault_pkey" PRIMARY KEY ("organizationId","route")
);

-- CreateTable
CREATE TABLE "ProtocolPrescription" (
    "id" TEXT NOT NULL,
    "immunotherapyId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "resolved" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProtocolPrescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalCommand" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "doseId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClinicalCommand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TreatmentProtocol_organizationId_route_idx" ON "TreatmentProtocol"("organizationId", "route");

-- CreateIndex
CREATE UNIQUE INDEX "TreatmentProtocol_id_organizationId_key" ON "TreatmentProtocol"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ProtocolVersion_protocolId_number_key" ON "ProtocolVersion"("protocolId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "ProtocolVersion_id_organizationId_key" ON "ProtocolVersion"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ProtocolPrescription_immunotherapyId_key" ON "ProtocolPrescription"("immunotherapyId");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalCommand_organizationId_actorId_doseId_key_key" ON "ClinicalCommand"("organizationId", "actorId", "doseId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Dose_sourceDoseId_key" ON "Dose"("sourceDoseId");

-- AddForeignKey
ALTER TABLE "Dose" ADD CONSTRAINT "Dose_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "ProtocolPrescription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dose" ADD CONSTRAINT "Dose_sourceDoseId_fkey" FOREIGN KEY ("sourceDoseId") REFERENCES "Dose"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentProtocol" ADD CONSTRAINT "TreatmentProtocol_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolVersion" ADD CONSTRAINT "ProtocolVersion_protocolId_organizationId_fkey" FOREIGN KEY ("protocolId", "organizationId") REFERENCES "TreatmentProtocol"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationProtocolDefault" ADD CONSTRAINT "OrganizationProtocolDefault_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationProtocolDefault" ADD CONSTRAINT "OrganizationProtocolDefault_versionId_organizationId_fkey" FOREIGN KEY ("versionId", "organizationId") REFERENCES "ProtocolVersion"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolPrescription" ADD CONSTRAINT "ProtocolPrescription_immunotherapyId_fkey" FOREIGN KEY ("immunotherapyId") REFERENCES "Immunotherapy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolPrescription" ADD CONSTRAINT "ProtocolPrescription_versionId_organizationId_fkey" FOREIGN KEY ("versionId", "organizationId") REFERENCES "ProtocolVersion"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Published content and prescription snapshots are immutable, including direct SQL writes.
CREATE FUNCTION protect_protocol_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'DRAFT' THEN RAISE EXCEPTION 'Published protocol versions cannot be deleted'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.status <> 'DRAFT' AND (
    NEW.definition IS DISTINCT FROM OLD.definition OR
    NEW."protocolId" IS DISTINCT FROM OLD."protocolId" OR
    NEW."organizationId" IS DISTINCT FROM OLD."organizationId" OR
    NEW.number IS DISTINCT FROM OLD.number OR
    NEW."schemaVersion" IS DISTINCT FROM OLD."schemaVersion" OR
    NEW."engineVersion" IS DISTINCT FROM OLD."engineVersion" OR
    NEW."publishedAt" IS DISTINCT FROM OLD."publishedAt" OR
    NEW."publishedById" IS DISTINCT FROM OLD."publishedById" OR
    (NEW.status IS DISTINCT FROM OLD.status AND NOT (OLD.status = 'PUBLISHED' AND NEW.status = 'RETIRED'))
  ) THEN RAISE EXCEPTION 'Published protocol content is immutable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protocol_version_immutability BEFORE UPDATE OR DELETE ON "ProtocolVersion" FOR EACH ROW EXECUTE FUNCTION protect_protocol_version();

CREATE FUNCTION protect_prescription() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actual_org text;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Prescription snapshots are immutable'; END IF;
  SELECT p."organizationId" INTO actual_org FROM "Immunotherapy" i JOIN "Patient" p ON p.id = i."patientId" WHERE i.id = NEW."immunotherapyId";
  IF actual_org IS DISTINCT FROM NEW."organizationId" THEN RAISE EXCEPTION 'Prescription organization mismatch'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER prescription_immutability BEFORE INSERT OR UPDATE OR DELETE ON "ProtocolPrescription" FOR EACH ROW EXECUTE FUNCTION protect_prescription();

CREATE FUNCTION validate_configured_dose() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE therapy_id text;
BEGIN
  IF NEW."prescriptionId" IS NOT NULL THEN
    SELECT "immunotherapyId" INTO therapy_id FROM "ProtocolPrescription" WHERE id = NEW."prescriptionId";
    IF therapy_id IS DISTINCT FROM NEW."immunotherapyId" THEN RAISE EXCEPTION 'Dose prescription mismatch'; END IF;
    IF NEW."plannedValues" IS NULL OR NEW."plannedStepId" IS NULL OR NEW."plannedVolumeExact" IS NULL THEN RAISE EXCEPTION 'Configured dose requires exact planning values'; END IF;
  END IF;
  IF NEW."sourceDoseId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Dose" d WHERE d.id = NEW."sourceDoseId" AND d."immunotherapyId" = NEW."immunotherapyId" AND d."prescriptionId" = NEW."prescriptionId") THEN RAISE EXCEPTION 'Successor source mismatch'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER configured_dose_integrity BEFORE INSERT OR UPDATE ON "Dose" FOR EACH ROW EXECUTE FUNCTION validate_configured_dose();

CREATE FUNCTION validate_protocol_default() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "ProtocolVersion" v JOIN "TreatmentProtocol" p ON p.id = v."protocolId" WHERE v.id = NEW."versionId" AND v.status = 'PUBLISHED' AND p.route = NEW.route AND p.available) THEN RAISE EXCEPTION 'Default must reference an available published protocol of the same route'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protocol_default_integrity BEFORE INSERT OR UPDATE ON "OrganizationProtocolDefault" FOR EACH ROW EXECUTE FUNCTION validate_protocol_default();

-- Only new configured records are constrained; legacy duplicates remain visible for inventory.
CREATE UNIQUE INDEX "Dose_one_configured_scheduled_per_therapy" ON "Dose" ("immunotherapyId") WHERE "prescriptionId" IS NOT NULL AND status = 'SCHEDULED' AND NOT "isArchived";
ALTER TABLE "Dose" ADD CONSTRAINT "Dose_positive_exact_volumes" CHECK (("plannedVolumeExact" IS NULL OR "plannedVolumeExact" > 0) AND ("administeredVolumeExact" IS NULL OR "administeredVolumeExact" > 0));
ALTER TABLE "TreatmentProtocol" ADD CONSTRAINT "TreatmentProtocol_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"(id);
ALTER TABLE "ProtocolVersion" ADD CONSTRAINT "ProtocolVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"(id);
ALTER TABLE "ProtocolPrescription" ADD CONSTRAINT "ProtocolPrescription_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"(id);
