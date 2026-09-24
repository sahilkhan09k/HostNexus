-- CreateTable
CREATE TABLE "availability_windows" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "fromDate" TIMESTAMP(3) NOT NULL,
    "toDate" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "availability_windows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "availability_windows_resourceId_idx" ON "availability_windows"("resourceId");

-- CreateIndex
CREATE INDEX "availability_windows_fromDate_toDate_idx" ON "availability_windows"("fromDate", "toDate");

-- AddForeignKey
ALTER TABLE "availability_windows" ADD CONSTRAINT "availability_windows_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
