DROP INDEX "InternalUserInvite_email_organizationId_isActive_key";

CREATE UNIQUE INDEX "InternalUserInvite_email_organizationId_active_key"
  ON "InternalUserInvite"("email", "organizationId")
  WHERE "isActive" = true;
