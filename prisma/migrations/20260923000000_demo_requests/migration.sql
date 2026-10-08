CREATE TABLE "DemoRequest" (
    "id" TEXT NOT NULL,
    "requestId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "solution" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "professionals" INTEGER NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emailAttempts" INTEGER NOT NULL DEFAULT 0,
    "emailNextAttemptAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "emailLeaseUntil" TIMESTAMP(3),
    "emailAcceptedAt" TIMESTAMP(3),
    "emailErrorCode" TEXT,
    CONSTRAINT "DemoRequest_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DemoRequest_professionals_check" CHECK ("professionals" BETWEEN 1 AND 9999)
);
CREATE UNIQUE INDEX "DemoRequest_requestId_key" ON "DemoRequest"("requestId");
CREATE INDEX "DemoRequest_emailNextAttemptAt_emailLeaseUntil_idx" ON "DemoRequest"("emailNextAttemptAt", "emailLeaseUntil");
CREATE INDEX "DemoRequest_sourceHash_createdAt_idx" ON "DemoRequest"("sourceHash", "createdAt");
CREATE INDEX "DemoRequest_email_createdAt_idx" ON "DemoRequest"("email", "createdAt");
CREATE INDEX "DemoRequest_createdAt_idx" ON "DemoRequest"("createdAt");
