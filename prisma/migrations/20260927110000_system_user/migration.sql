-- Autoria volta a ser obrigatória: ações de sistema apontam para o usuário
-- operacional cadastrado pela operação e referenciado via SYSTEM_USER_ID (env).
ALTER TABLE "InternalUserInvite" ALTER COLUMN "createdById" SET NOT NULL;
ALTER TABLE "AuditLog" ALTER COLUMN "userId" SET NOT NULL;
