-- Integração Google Calendar: conexão OAuth por profissional, correlação
-- Appointment <-> evento Google e fila de sincronização no padrão outbox.

CREATE TYPE "GoogleCalendarConnectionStatus" AS ENUM ('ACTIVE', 'BROKEN');

CREATE TYPE "CalendarSyncJobKind" AS ENUM (
  'PUSH_SYNC',
  'PULL_INCREMENTAL',
  'PULL_FULL_RESYNC',
  'CHANNEL_RENEW',
  'CHANNEL_STOP'
);

-- Refresh token cifrado fora de alcance de leitura casual: AES-256-GCM com
-- chave dedicada (GOOGLE_TOKEN_ENCRYPTION_KEY), mesmo formato do MfaCredential.
CREATE TABLE "GoogleCalendarConnection" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "professionalId" TEXT NOT NULL,
  "googleAccountEmail" TEXT NOT NULL,
  "calendarId" TEXT NOT NULL DEFAULT 'primary',
  "grantedScopes" TEXT NOT NULL,
  "refreshTokenCiphertext" TEXT NOT NULL,
  "refreshTokenIv" TEXT NOT NULL,
  "refreshTokenAuthTag" TEXT NOT NULL,
  "keyVersion" INTEGER NOT NULL DEFAULT 1,
  "status" "GoogleCalendarConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
  "brokenReason" TEXT,
  "syncToken" TEXT,
  "lastIncrementalSyncAt" TIMESTAMP(3),
  "lastFullSyncAt" TIMESTAMP(3),
  "channelId" TEXT,
  "channelResourceId" TEXT,
  "channelExpiresAt" TIMESTAMP(3),
  "channelTokenHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GoogleCalendarConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GoogleCalendarConnection_professionalId_key"
  ON "GoogleCalendarConnection"("professionalId");
CREATE UNIQUE INDEX "GoogleCalendarConnection_channelId_key"
  ON "GoogleCalendarConnection"("channelId");
CREATE INDEX "GoogleCalendarConnection_organizationId_status_idx"
  ON "GoogleCalendarConnection"("organizationId", "status");
CREATE INDEX "GoogleCalendarConnection_channelExpiresAt_idx"
  ON "GoogleCalendarConnection"("channelExpiresAt");

ALTER TABLE "GoogleCalendarConnection"
  ADD CONSTRAINT "GoogleCalendarConnection_professionalId_fkey"
  FOREIGN KEY ("professionalId") REFERENCES "Professional"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "GoogleCalendarEventLink" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "appointmentId" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "googleEventId" TEXT NOT NULL,
  "etag" TEXT,
  "lastSyncedHash" TEXT,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GoogleCalendarEventLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GoogleCalendarEventLink_appointmentId_key"
  ON "GoogleCalendarEventLink"("appointmentId");
CREATE UNIQUE INDEX "GoogleCalendarEventLink_connectionId_googleEventId_key"
  ON "GoogleCalendarEventLink"("connectionId", "googleEventId");

ALTER TABLE "GoogleCalendarEventLink"
  ADD CONSTRAINT "GoogleCalendarEventLink_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GoogleCalendarEventLink"
  ADD CONSTRAINT "GoogleCalendarEventLink_connectionId_fkey"
  FOREIGN KEY ("connectionId") REFERENCES "GoogleCalendarConnection"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CalendarSyncJob" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "kind" "CalendarSyncJobKind" NOT NULL,
  "connectionId" TEXT,
  "appointmentId" TEXT,
  "payload" JSONB,
  "pendingKey" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseUntil" TIMESTAMP(3),
  "processedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CalendarSyncJob_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CalendarSyncJob"
  ADD CONSTRAINT "CalendarSyncJob_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "CalendarSyncJob_processedAt_nextAttemptAt_createdAt_idx"
  ON "CalendarSyncJob"("processedAt", "nextAttemptAt", "createdAt");
CREATE INDEX "CalendarSyncJob_organizationId_createdAt_idx"
  ON "CalendarSyncJob"("organizationId", "createdAt");

-- Deduplicação de jobs pendentes: "pendingKey" guarda PUSH:<appointmentId> ou
-- PULL:<connectionId> enquanto o job está aberto e vira nulo quando ele é
-- concluído ou vai para dead-letter. Um índice único comum basta, porque o
-- Postgres aceita vários nulos — e, diferente de um índice parcial, essa regra
-- é declarada no schema Prisma e não pode ser removida por uma migração
-- gerada automaticamente.
CREATE UNIQUE INDEX "CalendarSyncJob_pendingKey_key"
  ON "CalendarSyncJob"("pendingKey");
