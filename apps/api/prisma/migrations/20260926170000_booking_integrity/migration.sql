-- DropForeignKey
ALTER TABLE "booking_requests" DROP CONSTRAINT "booking_requests_providerId_fkey";

-- DropForeignKey
ALTER TABLE "booking_requests" DROP CONSTRAINT "booking_requests_resourceId_fkey";

-- DropForeignKey
ALTER TABLE "booking_requests" DROP CONSTRAINT "booking_requests_seekerId_fkey";

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
ADD COLUMN     "razorpayOrderId" TEXT,
ADD COLUMN     "razorpayPaymentId" TEXT,
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
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "utrReference" TEXT,
ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "resources" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "booking_requests_razorpayPaymentId_key" ON "booking_requests"("razorpayPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_providerReference_key" ON "payment_transactions"("providerReference");

-- CreateIndex
CREATE INDEX "payment_transactions_status_direction_idx" ON "payment_transactions"("status", "direction");

-- CreateIndex
CREATE INDEX "resources_deletedAt_idx" ON "resources"("deletedAt");

-- AddForeignKey
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_seekerId_fkey" FOREIGN KEY ("seekerId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

