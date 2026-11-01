-- Remoção da integração Google Calendar: OAuth por profissional, correlação
-- Appointment <-> evento Google e fila de sincronização.
-- O agendamento nativo (Appointment, Appointment.professionalId) permanece.
-- Linhas históricas de AuditLog com action GOOGLE_* não são tocadas:
-- AuditLog.action é TEXT e o histórico continua legível.

DROP TABLE "GoogleCalendarEventLink";

DROP TABLE "CalendarSyncJob";

DROP TABLE "GoogleCalendarConnection";

DROP TABLE "OAuthStateNonce";

DROP TYPE "CalendarSyncJobKind";

DROP TYPE "GoogleCalendarConnectionStatus";
