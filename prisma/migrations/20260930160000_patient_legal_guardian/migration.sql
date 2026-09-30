-- Responsável legal do paciente menor de idade. Três colunas nuláveis em
-- Patient em vez de tabela própria: a relação é 1:1, sem vida própria, e o
-- diff de auditoria já compara campo escalar.
--
-- O CHECK garante a invariante que a aplicação também valida: ou não há
-- responsável nenhum, ou há nome e telefone. O CPF segue a mesma regra do
-- paciente — pode faltar, porque existe pessoa sem CPF conhecido. Responsável
-- pela metade não é estado alcançável nem por escrita direta no banco.
ALTER TABLE "Patient"
  ADD COLUMN "guardianName" TEXT,
  ADD COLUMN "guardianCpf" TEXT,
  ADD COLUMN "guardianPhoneNumber" TEXT;

ALTER TABLE "Patient"
  ADD CONSTRAINT "Patient_guardian_all_or_none" CHECK (
    ("guardianName" IS NULL AND "guardianCpf" IS NULL AND "guardianPhoneNumber" IS NULL)
    OR ("guardianName" IS NOT NULL AND "guardianPhoneNumber" IS NOT NULL)
  );
