-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationKind" ADD VALUE 'EMAIL_CHANGE_REQUEST_PENDING';
ALTER TYPE "NotificationKind" ADD VALUE 'EMAIL_CHANGE_REQUEST_DECIDED';

-- AlterEnum
ALTER TYPE "AuthSessionRevokeReason" ADD VALUE 'EMAIL_CHANGED';

-- AlterTable
ALTER TABLE "VerificationToken" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "requestedById" TEXT;
