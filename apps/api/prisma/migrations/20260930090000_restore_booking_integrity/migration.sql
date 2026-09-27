-- Restores the booking-integrity fields (handover code, deadlines, dispute kinds,
-- refund/payout ledger) on top of 20260927120000_security_hardening.

-- AlterTable
ALTER TABLE "booking_requests" ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledBy" TEXT,
ADD COLUMN     "fundedAt" TIMESTAMP(3),
ADD COLUMN     "handoverCode" TEXT,
ADD COLUMN     "handoverCodeAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "handoverDeadline" TIMESTAMP(3),
ADD COLUMN     "ownerReceiptDeadline" TIMESTAMP(3),
ADD COLUMN     "ownerReceivedQuantity" INTEGER,
ADD COLUMN     "paymentDeadline" TIMESTAMP(3),
ADD COLUMN     "razorpayOrderAmountPaise" INTEGER,
ADD COLUMN     "receivedQuantity" INTEGER,
ADD COLUMN     "returnedQuantity" INTEGER;

-- AlterTable
ALTER TABLE "disputes" ADD COLUMN     "escalatedAt" TIMESTAMP(3),
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'RETURN_CLAIM',
ADD COLUMN     "ownerResponse" TEXT,
ADD COLUMN     "raisedByRole" TEXT NOT NULL DEFAULT 'OWNER',
ADD COLUMN     "responseDeadline" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "payment_transactions" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "direction" TEXT NOT NULL DEFAULT 'IN',
ADD COLUMN     "failureReason" TEXT,
ADD COLUMN     "processedAt" TIMESTAMP(3),
ADD COLUMN     "processedById" TEXT,
ADD COLUMN     "razorpayRefundId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "utrReference" TEXT,
ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "resources_deletedAt_idx" ON "resources"("deletedAt");

-- CreateIndex
CREATE INDEX "payment_transactions_status_direction_idx" ON "payment_transactions"("status", "direction");


-- Backfill ledger direction for rows written before this migration
UPDATE "payment_transactions" SET "direction" = 'TO_OWNER' WHERE "type" IN ('RENT_PAYOUT', 'DAMAGE_PAYOUT');
UPDATE "payment_transactions" SET "direction" = 'TO_RENTER' WHERE "type" IN ('FULL_REFUND', 'RENT_REFUND', 'DEPOSIT_REFUND');
