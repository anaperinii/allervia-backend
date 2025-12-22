/*
  Warnings:

  - You are about to drop the column `professionalId` on the `Membership` table. All the data in the column will be lost.
  - You are about to drop the column `isArchived` on the `Patient` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Patient` table. All the data in the column will be lost.
  - You are about to drop the column `weight` on the `Patient` table. All the data in the column will be lost.
  - You are about to drop the `MembershipRole` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[name]` on the table `Organization` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId]` on the table `Professional` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `administrationRoute` on the `Immunotherapy` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `weightInKg` to the `Patient` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Professional` table without a default value. This is not possible if the table is not empty.
  - Made the column `specialty` on table `Professional` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `type` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."AdministrationRoute" AS ENUM ('SUBCUTANEOUS', 'SUBLINGUAL');

-- CreateEnum
CREATE TYPE "public"."UserType" AS ENUM ('PROFESSIONAL', 'PATIENT');

-- DropForeignKey
ALTER TABLE "public"."Membership" DROP CONSTRAINT "Membership_professionalId_fkey";

-- DropForeignKey
ALTER TABLE "public"."MembershipRole" DROP CONSTRAINT "MembershipRole_membershipId_fkey";

-- DropForeignKey
ALTER TABLE "public"."MembershipRole" DROP CONSTRAINT "MembershipRole_roleId_fkey";

-- AlterTable
ALTER TABLE "public"."Immunotherapy" DROP COLUMN "administrationRoute",
ADD COLUMN     "administrationRoute" "public"."AdministrationRoute" NOT NULL;

-- AlterTable
ALTER TABLE "public"."Membership" DROP COLUMN "professionalId";

-- AlterTable
ALTER TABLE "public"."Patient" DROP COLUMN "isArchived",
DROP COLUMN "status",
DROP COLUMN "weight",
ADD COLUMN     "weightInKg" DOUBLE PRECISION NOT NULL;

-- AlterTable
ALTER TABLE "public"."Professional" ADD COLUMN     "userId" TEXT NOT NULL,
ALTER COLUMN "specialty" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "organizationId" TEXT,
ADD COLUMN     "type" "public"."UserType" NOT NULL;

-- DropTable
DROP TABLE "public"."MembershipRole";

-- DropEnum
DROP TYPE "public"."AdminRoute";

-- DropEnum
DROP TYPE "public"."PatientStatus";

-- CreateTable
CREATE TABLE "public"."UserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_roleId_key" ON "public"."UserRole"("userId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_name_key" ON "public"."Organization"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Professional_userId_key" ON "public"."Professional"("userId");

-- AddForeignKey
ALTER TABLE "public"."UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Professional" ADD CONSTRAINT "Professional_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
