-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "recurringId" TEXT;

-- CreateTable
CREATE TABLE "RecurringBooking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courtId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RecurringBooking_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecurringBooking_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "RecurringBooking_courtId_idx" ON "RecurringBooking"("courtId");

-- CreateIndex
CREATE INDEX "RecurringBooking_status_idx" ON "RecurringBooking"("status");

-- CreateIndex
CREATE INDEX "Booking_recurringId_idx" ON "Booking"("recurringId");
