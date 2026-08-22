-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Booking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courtId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "totalPrice" INTEGER NOT NULL,
    "discountAmount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attendance" TEXT NOT NULL DEFAULT 'pending',
    "attendanceAt" DATETIME,
    "paymentStatus" TEXT NOT NULL DEFAULT 'unpaid',
    "reservedAt" DATETIME,
    "paidAt" DATETIME,
    "source" TEXT NOT NULL DEFAULT 'member',
    "note" TEXT,
    "recurringId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Booking_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Booking_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Booking" ("courtId", "createdAt", "date", "discountAmount", "durationMinutes", "endTime", "id", "memberId", "note", "paidAt", "paymentStatus", "recurringId", "reservedAt", "source", "startTime", "status", "totalPrice", "updatedAt") SELECT "courtId", "createdAt", "date", "discountAmount", "durationMinutes", "endTime", "id", "memberId", "note", "paidAt", "paymentStatus", "recurringId", "reservedAt", "source", "startTime", "status", "totalPrice", "updatedAt" FROM "Booking";
DROP TABLE "Booking";
ALTER TABLE "new_Booking" RENAME TO "Booking";
CREATE INDEX "Booking_courtId_date_idx" ON "Booking"("courtId", "date");
CREATE INDEX "Booking_memberId_idx" ON "Booking"("memberId");
CREATE INDEX "Booking_recurringId_idx" ON "Booking"("recurringId");
CREATE TABLE "new_Member" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "passwordHash" TEXT,
    "role" TEXT NOT NULL DEFAULT 'member',
    "lineUserId" TEXT,
    "lineName" TEXT,
    "linePictureUrl" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "banned" BOOLEAN NOT NULL DEFAULT false,
    "noShowCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Member" ("banned", "createdAt", "email", "id", "lineName", "linePictureUrl", "lineUserId", "name", "passwordHash", "phone", "points", "role", "updatedAt") SELECT "banned", "createdAt", "email", "id", "lineName", "linePictureUrl", "lineUserId", "name", "passwordHash", "phone", "points", "role", "updatedAt" FROM "Member";
DROP TABLE "Member";
ALTER TABLE "new_Member" RENAME TO "Member";
CREATE UNIQUE INDEX "Member_email_key" ON "Member"("email");
CREATE UNIQUE INDEX "Member_lineUserId_key" ON "Member"("lineUserId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
