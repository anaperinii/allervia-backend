-- O guardião de parâmetros vinculados deixa de vigiar inductionStartDate.
-- O início da indução passa a ser derivado da primeira dose viva do tratamento,
-- então reagendar essa dose move o marco junto — comportamento clínico pedido.
-- Os demais parâmetros vinculados seguem exigindo revisão de prescrição, e a
-- mutação genérica do campo continua bloqueada na camada de aplicação: só o
-- recálculo de marcos em ConfiguredDoseService.edit e DoseCorrectionService
-- escreve nesta coluna.
CREATE OR REPLACE FUNCTION protect_bound_therapy_parameters() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "ProtocolPrescription" p WHERE p."immunotherapyId" = OLD.id) AND (
    NEW."patientId" IS DISTINCT FROM OLD."patientId" OR
    NEW."administrationRoute" IS DISTINCT FROM OLD."administrationRoute" OR
    NEW."extract" IS DISTINCT FROM OLD."extract" OR
    NEW."targetConcentration" IS DISTINCT FROM OLD."targetConcentration"
  ) THEN RAISE EXCEPTION 'Bound prescription parameters require a dedicated clinical revision'; END IF;
  RETURN NEW;
END $$;
