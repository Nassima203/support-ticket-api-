/*
  Warnings:

  - You are about to drop the column `authorEmail` on the `tickets` table. All the data in the column will be lost.
  - Added the required column `authorId` to the `tickets` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "tickets" DROP COLUMN "authorEmail",
ADD COLUMN     "authorId" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "tickets_authorId_idx" ON "tickets"("authorId");

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
