-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Court" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "venueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pricePerHour" INTEGER NOT NULL,
    "description" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Court_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Court" ("createdAt", "description", "id", "name", "pricePerHour", "status", "updatedAt", "venueId") SELECT "createdAt", "description", "id", "name", "pricePerHour", "status", "updatedAt", "venueId" FROM "Court";
DROP TABLE "Court";
ALTER TABLE "new_Court" RENAME TO "Court";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
