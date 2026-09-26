-- AlterTable
ALTER TABLE "resources" ADD COLUMN     "transportAvailable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "transportRatePerKmPaise" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "booking_requests" ADD COLUMN     "transportDistanceKm" DOUBLE PRECISION,
ADD COLUMN     "transportFeePaise" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "transportMode" TEXT NOT NULL DEFAULT 'SELF',
ADD COLUMN     "transportRatePerKmPaise" INTEGER NOT NULL DEFAULT 0;
