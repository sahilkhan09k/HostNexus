-- AlterTable
ALTER TABLE "users" ADD COLUMN     "gstin" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_gstin_key" ON "users"("gstin");
