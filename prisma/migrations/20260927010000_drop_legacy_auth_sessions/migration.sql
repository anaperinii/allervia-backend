BEGIN;

-- Refuse deletion if an old application has resumed creating legacy sessions.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "AuthSession" WHERE "revokedAt" IS NULL) THEN
    RAISE EXCEPTION 'Stop legacy session writers and revoke remaining AuthSession records before removal';
  END IF;
END $$;

-- RefreshFamily still uses AuthSessionRevokeReason. Keep that shared enum.
-- Unexpected dependencies must fail instead of being silently removed.
DROP TABLE "AuthSession" RESTRICT;

COMMIT;
