-- Strengthen immutability beyond API paths, preserving all legacy rows unchanged.
CREATE OR REPLACE FUNCTION protect_protocol_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'DRAFT' THEN RAISE EXCEPTION 'Published protocol versions cannot be deleted'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.status <> 'DRAFT' AND (
    (to_jsonb(NEW) - 'status' - 'revision') IS DISTINCT FROM (to_jsonb(OLD) - 'status' - 'revision') OR
    (NEW.status IS DISTINCT FROM OLD.status AND NOT (OLD.status = 'PUBLISHED' AND NEW.status = 'RETIRED'))
  ) THEN RAISE EXCEPTION 'Published protocol content is immutable'; END IF;
  IF NEW.status = 'RETIRED' AND EXISTS (SELECT 1 FROM "OrganizationProtocolDefault" d WHERE d."versionId" = NEW.id) THEN RAISE EXCEPTION 'Retired version cannot remain default'; END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION protect_bound_therapy_parameters() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "ProtocolPrescription" p WHERE p."immunotherapyId" = OLD.id) AND (
    NEW."patientId" IS DISTINCT FROM OLD."patientId" OR
    NEW."administrationRoute" IS DISTINCT FROM OLD."administrationRoute" OR
    NEW."extract" IS DISTINCT FROM OLD."extract" OR
    NEW."targetConcentration" IS DISTINCT FROM OLD."targetConcentration" OR
    NEW."targetVolume" IS DISTINCT FROM OLD."targetVolume" OR
    NEW."inductionStartDate" IS DISTINCT FROM OLD."inductionStartDate"
  ) THEN RAISE EXCEPTION 'Bound prescription parameters require a dedicated clinical revision'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER bound_therapy_parameters BEFORE UPDATE ON "Immunotherapy" FOR EACH ROW EXECUTE FUNCTION protect_bound_therapy_parameters();

CREATE FUNCTION protect_administered_configured_dose() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."prescriptionId" IS NOT NULL AND OLD.status IN ('ADMINISTERED_ON_SCHEDULE', 'ADMINISTERED_OFF_SCHEDULE') THEN
    RAISE EXCEPTION 'Administered dose requires a dedicated clinical correction';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER administered_configured_dose_immutability BEFORE UPDATE OR DELETE ON "Dose" FOR EACH ROW EXECUTE FUNCTION protect_administered_configured_dose();
