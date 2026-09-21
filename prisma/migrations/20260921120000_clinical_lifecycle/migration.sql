-- CreateEnum
CREATE TYPE "LifecycleEventType" AS ENUM ('SUSPENSION', 'RESUMPTION', 'COMPLETION');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'MISSED');

-- As FKs de createdById em TreatmentProtocol, ProtocolVersion e
-- ProtocolPrescription existem no banco desde 20260917010000, mas o schema
-- Prisma não declara essas relações; o diff propôs removê-las e mantê-las
-- preserva a integridade referencial (mesma decisão das migrations anteriores).

-- DropIndex
DROP INDEX "ProtocolPrescription_immunotherapyId_key";

-- AlterTable
ALTER TABLE "Immunotherapy" ADD COLUMN     "currentPrescriptionId" TEXT;

-- AlterTable
ALTER TABLE "ProtocolPrescription" ADD COLUMN     "revisionReason" TEXT;

-- CreateTable
CREATE TABLE "TherapyLifecycleEvent" (
    "id" TEXT NOT NULL,
    "immunotherapyId" TEXT NOT NULL,
    "type" "LifecycleEventType" NOT NULL,
    "category" TEXT,
    "reason" TEXT NOT NULL,
    "expectedReturnAt" TIMESTAMP(3),
    "recommendations" JSONB,
    "archivedDoseIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "TherapyLifecycleEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoseObservationAddendum" (
    "id" TEXT NOT NULL,
    "doseId" TEXT NOT NULL,
    "reportedSideEffects" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "administeredMedications" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "conduct" "DoseImmediateConduct",
    "conductJustification" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "DoseObservationAddendum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doseId" TEXT,
    "title" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "statusReason" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" TEXT NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TherapyLifecycleEvent_immunotherapyId_createdAt_idx" ON "TherapyLifecycleEvent"("immunotherapyId", "createdAt");

-- CreateIndex
CREATE INDEX "DoseObservationAddendum_doseId_observedAt_idx" ON "DoseObservationAddendum"("doseId", "observedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_doseId_key" ON "Appointment"("doseId");

-- CreateIndex
CREATE INDEX "Appointment_organizationId_startsAt_idx" ON "Appointment"("organizationId", "startsAt");

-- CreateIndex
CREATE INDEX "Appointment_patientId_startsAt_idx" ON "Appointment"("patientId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Immunotherapy_currentPrescriptionId_key" ON "Immunotherapy"("currentPrescriptionId");

-- CreateIndex
CREATE INDEX "ProtocolPrescription_immunotherapyId_createdAt_idx" ON "ProtocolPrescription"("immunotherapyId", "createdAt");

-- AddForeignKey
ALTER TABLE "Immunotherapy" ADD CONSTRAINT "Immunotherapy_currentPrescriptionId_fkey" FOREIGN KEY ("currentPrescriptionId") REFERENCES "ProtocolPrescription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TherapyLifecycleEvent" ADD CONSTRAINT "TherapyLifecycleEvent_immunotherapyId_fkey" FOREIGN KEY ("immunotherapyId") REFERENCES "Immunotherapy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TherapyLifecycleEvent" ADD CONSTRAINT "TherapyLifecycleEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoseObservationAddendum" ADD CONSTRAINT "DoseObservationAddendum_doseId_fkey" FOREIGN KEY ("doseId") REFERENCES "Dose"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoseObservationAddendum" ADD CONSTRAINT "DoseObservationAddendum_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_doseId_fkey" FOREIGN KEY ("doseId") REFERENCES "Dose"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: a prescrição vigente de cada terapia é a única existente até aqui.
UPDATE "Immunotherapy" i
SET "currentPrescriptionId" = p.id
FROM "ProtocolPrescription" p
WHERE p."immunotherapyId" = i.id AND i."currentPrescriptionId" IS NULL;

-- A cadeia de sucessão pode cruzar prescrições após uma revisão clínica: o
-- vínculo exige a mesma terapia, não mais o mesmo snapshot de prescrição.
CREATE OR REPLACE FUNCTION validate_configured_dose() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE therapy_id text;
BEGIN
  IF NEW."prescriptionId" IS NOT NULL THEN
    SELECT "immunotherapyId" INTO therapy_id FROM "ProtocolPrescription" WHERE id = NEW."prescriptionId";
    IF therapy_id IS DISTINCT FROM NEW."immunotherapyId" THEN RAISE EXCEPTION 'Dose prescription mismatch'; END IF;
    IF NEW."plannedValues" IS NULL OR NEW."plannedStepId" IS NULL OR NEW."plannedVolumeExact" IS NULL THEN RAISE EXCEPTION 'Configured dose requires exact planning values'; END IF;
  END IF;
  IF NEW."sourceDoseId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Dose" d WHERE d.id = NEW."sourceDoseId" AND d."immunotherapyId" = NEW."immunotherapyId") THEN RAISE EXCEPTION 'Successor source mismatch'; END IF;
  RETURN NEW;
END $$;

-- Dose administrada continua imutável, exceto a correção clínica dedicada:
-- a única transição permitida é para ENTERED_IN_ERROR mantendo todos os
-- valores administrados intactos (apenas status/revision/updated* mudam).
CREATE OR REPLACE FUNCTION protect_administered_configured_dose() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."prescriptionId" IS NOT NULL AND OLD.status IN ('ADMINISTERED_ON_SCHEDULE', 'ADMINISTERED_OFF_SCHEDULE') THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Administered dose requires a dedicated clinical correction';
    END IF;
    IF NOT (
      NEW.status = 'ENTERED_IN_ERROR' AND
      (to_jsonb(NEW) - 'status' - 'revision' - 'updatedAt' - 'updatedById')
        IS NOT DISTINCT FROM
      (to_jsonb(OLD) - 'status' - 'revision' - 'updatedAt' - 'updatedById')
    ) THEN
      RAISE EXCEPTION 'Administered dose requires a dedicated clinical correction';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

