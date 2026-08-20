-- CreateTable
CREATE TABLE "BookingLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT,
    "actorName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "BookingLog_bookingId_idx" ON "BookingLog"("bookingId");

-- CreateIndex
CREATE INDEX "BookingLog_createdAt_idx" ON "BookingLog"("createdAt");
