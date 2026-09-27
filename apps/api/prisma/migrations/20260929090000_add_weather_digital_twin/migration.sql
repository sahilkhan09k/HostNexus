-- Weather-driven Digital Twin: additive tables only

-- CreateTable
CREATE TABLE "city_geo" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "city_geo_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "weather_daily" (
    "id" TEXT NOT NULL,
    "cityKey" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "precipMm" DOUBLE PRECISION NOT NULL,
    "precipHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxIntensity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tempMaxC" DOUBLE PRECISION NOT NULL,
    "tempMinC" DOUBLE PRECISION NOT NULL,
    "windMaxKmh" DOUBLE PRECISION NOT NULL,
    "weatherCode" INTEGER NOT NULL DEFAULT 0,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weather_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_signals" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "cityKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "category" TEXT NOT NULL,
    "severity" DOUBLE PRECISION NOT NULL,
    "sentiment" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "classifier" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "twin_models" (
    "key" TEXT NOT NULL,
    "mean" DOUBLE PRECISION[],
    "covariance" DOUBLE PRECISION[],
    "observations" INTEGER NOT NULL DEFAULT 0,
    "trainedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "twin_models_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "twin_snapshots" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "summary" JSONB NOT NULL,

    CONSTRAINT "twin_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "weather_daily_date_idx" ON "weather_daily"("date");

-- CreateIndex
CREATE UNIQUE INDEX "weather_daily_cityKey_date_key" ON "weather_daily"("cityKey", "date");

-- CreateIndex
CREATE UNIQUE INDEX "social_signals_externalId_key" ON "social_signals"("externalId");

-- CreateIndex
CREATE INDEX "social_signals_cityKey_publishedAt_idx" ON "social_signals"("cityKey", "publishedAt");

-- CreateIndex
CREATE INDEX "twin_snapshots_createdAt_idx" ON "twin_snapshots"("createdAt");

