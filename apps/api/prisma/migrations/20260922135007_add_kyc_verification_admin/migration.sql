-- AlterTable
ALTER TABLE "booking_requests" ADD COLUMN     "bookingStatus" TEXT NOT NULL DEFAULT 'BOOKING_REQUESTED',
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "conditionSnapshot" JSONB,
ADD COLUMN     "damageDisclosureSnapshot" JSONB,
ADD COLUMN     "financialStatus" TEXT NOT NULL DEFAULT 'PENDING_PAYMENT',
ADD COLUMN     "handoverInitiatedAt" TIMESTAMP(3),
ADD COLUMN     "listingPhotosSnapshot" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "nonReturnReportedAt" TIMESTAMP(3),
ADD COLUMN     "ownerInspectionDeadline" TIMESTAMP(3),
ADD COLUMN     "ownerReceivedAt" TIMESTAMP(3),
ADD COLUMN     "rentAmountPaise" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "renterInspectionDeadline" TIMESTAMP(3),
ADD COLUMN     "returnInitiatedAt" TIMESTAMP(3),
ADD COLUMN     "securityDepositPaise" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "termsVersion" TEXT NOT NULL DEFAULT 'v2.0',
ADD COLUMN     "totalAmountPaise" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "addressLine" TEXT,
ADD COLUMN     "businessType" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "pincode" TEXT,
ADD COLUMN     "state" TEXT;

-- AlterTable
ALTER TABLE "resources" ADD COLUMN     "damageDescription" TEXT,
ADD COLUMN     "damagePhotos" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "hasPreExistingDamage" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "rentAmountPaise" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "securityDepositPaise" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "aadhaarUrl" TEXT,
ADD COLUMN     "gstCertificateUrl" TEXT,
ADD COLUMN     "ownerName" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "verificationNotes" TEXT,
ADD COLUMN     "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "admins" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspections" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "performedById" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "condition" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "inspectionId" TEXT,
    "uploadedById" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'IMAGE',
    "fileUrl" TEXT NOT NULL,
    "fileHash" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "damage_claims" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "claimantId" TEXT NOT NULL,
    "claimType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "claimedAmountPaise" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "damage_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disputes" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "damageClaimId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "renterResponse" TEXT,
    "renterReason" TEXT,
    "adminDecision" TEXT,
    "resolutionAmountPaise" INTEGER,
    "resolutionNotes" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_transactions" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "providerReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_timeline_events" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_timeline_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");

-- CreateIndex
CREATE INDEX "inspections_bookingId_idx" ON "inspections"("bookingId");

-- CreateIndex
CREATE INDEX "evidence_bookingId_idx" ON "evidence"("bookingId");

-- CreateIndex
CREATE INDEX "evidence_stage_idx" ON "evidence"("stage");

-- CreateIndex
CREATE INDEX "damage_claims_bookingId_idx" ON "damage_claims"("bookingId");

-- CreateIndex
CREATE INDEX "disputes_bookingId_idx" ON "disputes"("bookingId");

-- CreateIndex
CREATE INDEX "payment_transactions_bookingId_idx" ON "payment_transactions"("bookingId");

-- CreateIndex
CREATE INDEX "booking_timeline_events_bookingId_idx" ON "booking_timeline_events"("bookingId");

-- CreateIndex
CREATE INDEX "booking_requests_bookingStatus_idx" ON "booking_requests"("bookingStatus");

-- CreateIndex
CREATE INDEX "booking_requests_financialStatus_idx" ON "booking_requests"("financialStatus");

-- CreateIndex
CREATE INDEX "users_verificationStatus_idx" ON "users"("verificationStatus");

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "booking_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "booking_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "inspections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "damage_claims" ADD CONSTRAINT "damage_claims_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "booking_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "booking_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_damageClaimId_fkey" FOREIGN KEY ("damageClaimId") REFERENCES "damage_claims"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "booking_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_timeline_events" ADD CONSTRAINT "booking_timeline_events_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "booking_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
