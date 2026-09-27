-- How a listing's rent is charged: per HOUR, per DAY or flat per EVENT.
-- Existing listings and bookings were all priced per day.
ALTER TABLE "resources" ADD COLUMN "pricingBasis" TEXT NOT NULL DEFAULT 'DAY';

-- Bookings snapshot the basis; hourly bookings also record hours per booked day.
ALTER TABLE "booking_requests" ADD COLUMN "pricingBasis" TEXT NOT NULL DEFAULT 'DAY',
ADD COLUMN "hoursPerDay" INTEGER;
