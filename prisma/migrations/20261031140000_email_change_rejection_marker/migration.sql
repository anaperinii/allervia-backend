-- AlterTable
ALTER TABLE "VerificationToken" ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "rejectedById" TEXT;
