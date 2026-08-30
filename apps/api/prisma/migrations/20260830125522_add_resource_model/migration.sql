-- CreateTable
CREATE TABLE "resources" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "resourceType" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit" TEXT,
    "status" TEXT NOT NULL DEFAULT 'available',
    "location" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "resources_businessId_idx" ON "resources"("businessId");

-- CreateIndex
CREATE INDEX "resources_resourceType_idx" ON "resources"("resourceType");

-- CreateIndex
CREATE INDEX "resources_status_idx" ON "resources"("status");

-- CreateIndex
CREATE INDEX "resources_isActive_idx" ON "resources"("isActive");

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
