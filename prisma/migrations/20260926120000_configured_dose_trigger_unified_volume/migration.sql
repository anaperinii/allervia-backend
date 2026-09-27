-- O planejamento exato agora vive na própria coluna volume (Decimal); o
-- gatilho deixa de exigir a coluna dropada e a positividade migra do par
-- *VolumeExact (CHECK removido junto com as colunas) para volume.
CREATE OR REPLACE FUNCTION validate_configured_dose() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE therapy_id text;
BEGIN
  IF NEW."prescriptionId" IS NOT NULL THEN
    SELECT "immunotherapyId" INTO therapy_id FROM "ProtocolPrescription" WHERE id = NEW."prescriptionId";
    IF therapy_id IS DISTINCT FROM NEW."immunotherapyId" THEN RAISE EXCEPTION 'Dose prescription mismatch'; END IF;
    IF NEW."plannedValues" IS NULL OR NEW."plannedStepId" IS NULL THEN RAISE EXCEPTION 'Configured dose requires exact planning values'; END IF;
  END IF;
  IF NEW."sourceDoseId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Dose" d WHERE d.id = NEW."sourceDoseId" AND d."immunotherapyId" = NEW."immunotherapyId") THEN RAISE EXCEPTION 'Successor source mismatch'; END IF;
  RETURN NEW;
END $$;

ALTER TABLE "Dose" ADD CONSTRAINT "Dose_positive_volume" CHECK ("volume" > 0);
