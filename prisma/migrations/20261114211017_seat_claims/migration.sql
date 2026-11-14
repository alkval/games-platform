-- CreateTable
CREATE TABLE "SeatClaim" (
    "matchId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("matchId", "playerId"),
    CONSTRAINT "SeatClaim_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "GameState" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SeatClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SeatClaim_userId_idx" ON "SeatClaim"("userId");
