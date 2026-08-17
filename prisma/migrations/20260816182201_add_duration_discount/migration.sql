-- CreateTable
CREATE TABLE "DurationDiscount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "venueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minMinutes" INTEGER NOT NULL,
    "fixedAmount" INTEGER NOT NULL,
    "tierPrice" INTEGER,
    "active" TEXT NOT NULL DEFAULT 'active',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DurationDiscount_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DurationDiscount_venueId_idx" ON "DurationDiscount"("venueId");
