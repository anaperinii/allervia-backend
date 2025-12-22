/*
  Warnings:

  - Changed the type of `name` on the `Role` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "RoleType" AS ENUM ('SYSTEM_ADMIN', 'ADMIN', 'PHYSICIAN', 'NURSE', 'NURSING_TECHNICIAN');

-- AlterTable
ALTER TABLE "Role" DROP COLUMN "name",
ADD COLUMN     "name" "RoleType" NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE INDEX "Role_name_isActive_idx" ON "Role"("name", "isActive");
