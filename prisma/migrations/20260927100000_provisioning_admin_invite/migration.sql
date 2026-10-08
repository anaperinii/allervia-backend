-- Convite de provisionamento não tem autor interno: a organização nasce junto
-- com o convite do administrador, antes de existir qualquer usuário nela.
ALTER TABLE "InternalUserInvite" ALTER COLUMN "createdById" DROP NOT NULL;

-- Auditoria de ação de sistema (sem ator autenticado) passa a ser representável.
ALTER TABLE "AuditLog" ALTER COLUMN "userId" DROP NOT NULL;
