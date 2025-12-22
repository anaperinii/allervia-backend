/*
  Warnings:

  - You are about to drop the column `roleId` on the `UserRole` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId,roleTag]` on the table `UserRole` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `roleTag` to the `UserRole` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "UserRole" DROP CONSTRAINT "UserRole_roleId_fkey";

-- DropIndex
DROP INDEX "UserRole_roleId_isActive_idx";

-- DropIndex
DROP INDEX "UserRole_userId_roleId_key";

-- AlterTable
ALTER TABLE "UserRole" DROP COLUMN "roleId",
ADD COLUMN     "roleTag" "RoleType" NOT NULL;

-- CreateIndex
CREATE INDEX "UserRole_roleTag_isActive_idx" ON "UserRole"("roleTag", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_roleTag_key" ON "UserRole"("userId", "roleTag");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleTag_fkey" FOREIGN KEY ("roleTag") REFERENCES "Role"("name") ON DELETE RESTRICT ON UPDATE CASCADE;
