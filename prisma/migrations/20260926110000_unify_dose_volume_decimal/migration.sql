-- Unifica o volume planejado da dose em uma única coluna Decimal exata.
-- A representação textual do float preserva o valor exibido; onde o fluxo
-- configurado gravou plannedVolumeExact, ele é a autoridade. O volume
-- aplicado permanece em administeredValues.volume (string exata no JSON).
ALTER TABLE "Dose"
  ALTER COLUMN "volume" TYPE DECIMAL(65,30) USING "volume"::text::numeric;

UPDATE "Dose"
  SET "volume" = "plannedVolumeExact"
  WHERE "plannedVolumeExact" IS NOT NULL;

ALTER TABLE "Dose" DROP COLUMN "plannedVolumeExact";
ALTER TABLE "Dose" DROP COLUMN "administeredVolumeExact";
