-- CreateTable
CREATE TABLE "negotiations" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "negotiations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "negotiation_offers" (
    "id" TEXT NOT NULL,
    "negotiationId" TEXT NOT NULL,
    "proposerId" TEXT NOT NULL,
    "proposerRole" TEXT NOT NULL,
    "offeredAmountPaise" INTEGER NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "negotiation_offers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "negotiations_bookingId_key" ON "negotiations"("bookingId");

-- CreateIndex
CREATE INDEX "negotiation_offers_negotiationId_idx" ON "negotiation_offers"("negotiationId");

-- AddForeignKey
ALTER TABLE "negotiations" ADD CONSTRAINT "negotiations_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "booking_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negotiation_offers" ADD CONSTRAINT "negotiation_offers_negotiationId_fkey" FOREIGN KEY ("negotiationId") REFERENCES "negotiations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negotiation_offers" ADD CONSTRAINT "negotiation_offers_proposerId_fkey" FOREIGN KEY ("proposerId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
