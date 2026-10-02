-- Profissional dono da agenda do compromisso. Coluna nulável porque o legado
-- anterior à coluna não registrava o profissional; novos registros são
-- obrigados pela aplicação. Pré-requisito da sincronização com o Google
-- Calendar, que é por conta de cada profissional.
ALTER TABLE "Appointment" ADD COLUMN "professionalId" TEXT;

ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_professionalId_fkey"
  FOREIGN KEY ("professionalId") REFERENCES "Professional"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Appointment_professionalId_startsAt_idx"
  ON "Appointment"("professionalId", "startsAt");

-- Backfill: Professional.userId é único (1:1 com User), então o criador do
-- compromisso, quando profissional, identifica o dono da agenda. Linhas
-- criadas por usuários não-profissionais permanecem nulas por design.
UPDATE "Appointment" a SET "professionalId" = p."id"
FROM "Professional" p
WHERE p."userId" = a."createdById" AND a."professionalId" IS NULL;
