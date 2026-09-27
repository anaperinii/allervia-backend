-- Unifica o volume-alvo em uma única coluna Decimal exata, mantendo o nome
-- targetVolume. A representação textual do float preserva o valor exibido;
-- onde o fluxo dedicado já gravou targetVolumeExact, ele é a autoridade.
ALTER TABLE "Immunotherapy"
  ALTER COLUMN "targetVolume" TYPE DECIMAL(65,30) USING "targetVolume"::text::numeric;

UPDATE "Immunotherapy"
  SET "targetVolume" = "targetVolumeExact"
  WHERE "targetVolumeExact" IS NOT NULL;

ALTER TABLE "Immunotherapy" DROP COLUMN "targetVolumeExact";

-- O guardião de parâmetros vinculados deixa de vigiar targetVolume: revisão de
-- prescrição e binding legado agora atualizam esta coluna diretamente; a
-- mutação genérica continua bloqueada na camada de aplicação.
CREATE OR REPLACE FUNCTION protect_bound_therapy_parameters() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "ProtocolPrescription" p WHERE p."immunotherapyId" = OLD.id) AND (
    NEW."patientId" IS DISTINCT FROM OLD."patientId" OR
    NEW."administrationRoute" IS DISTINCT FROM OLD."administrationRoute" OR
    NEW."extract" IS DISTINCT FROM OLD."extract" OR
    NEW."targetConcentration" IS DISTINCT FROM OLD."targetConcentration" OR
    NEW."inductionStartDate" IS DISTINCT FROM OLD."inductionStartDate"
  ) THEN RAISE EXCEPTION 'Bound prescription parameters require a dedicated clinical revision'; END IF;
  RETURN NEW;
END $$;
