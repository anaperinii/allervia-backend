CREATE TABLE "RateLimitCounter" (
  "key" TEXT NOT NULL,
  "windowStartsAt" TIMESTAMP(3) NOT NULL,
  "count" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RateLimitCounter_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "RateLimitCounter_expiresAt_idx" ON "RateLimitCounter"("expiresAt");
