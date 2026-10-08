-- Keep clinical executor in administeredById (User), recorder in AuditLog.
-- Historical audit events remain untouched.
BEGIN;
LOCK TABLE "Dose" IN ACCESS EXCLUSIVE MODE;
ALTER TABLE "Dose" DISABLE TRIGGER administered_configured_dose_immutability;

UPDATE "Dose" d
SET "administeredById" = p."userId"
FROM "Professional" p
WHERE d."performedById" = p.id;

-- Preserve the response contract for already stored idempotent commands.
DO $$
DECLARE field_name text;
BEGIN
  FOREACH field_name IN ARRAY ARRAY['dose', 'successor'] LOOP
    UPDATE "ClinicalCommand" c
    SET result = jsonb_set(c.result, ARRAY[field_name],
      ((c.result -> field_name) - 'performedById') ||
      jsonb_build_object('administeredById', p."userId"))
    FROM "Professional" p
    WHERE c.result -> field_name ->> 'performedById' = p.id;

    UPDATE "ClinicalCommand" c
    SET result = jsonb_set(c.result, ARRAY[field_name], (c.result -> field_name) - 'performedById')
    WHERE jsonb_typeof(c.result -> field_name) = 'object'
      AND (c.result -> field_name) ? 'performedById';
  END LOOP;
END $$;

ALTER TABLE "Dose" DROP CONSTRAINT "Dose_performedById_fkey";
DROP INDEX "Dose_performedById_idx";
ALTER TABLE "Dose" DROP COLUMN "performedById";
ALTER TABLE "Dose" ENABLE TRIGGER administered_configured_dose_immutability;
COMMIT;
