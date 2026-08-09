CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "googleId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "Match" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'complete',
    "playerCount" INTEGER NOT NULL,
    "resultJson" TEXT NOT NULL,
    "startedAt" DATETIME,
    "endedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "MatchPlayer" (
    "matchId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "userId" TEXT,
    "playerName" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "placement" INTEGER,
    PRIMARY KEY ("matchId", "playerId"),
    CONSTRAINT "MatchPlayer_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MatchPlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "PlayerStat" (
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "played" INTEGER NOT NULL DEFAULT 0,
    "won" INTEGER NOT NULL DEFAULT 0,
    "lost" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    PRIMARY KEY ("userId", "gameId"),
    CONSTRAINT "PlayerStat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "GameState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameName" TEXT NOT NULL,
    "stateJson" TEXT NOT NULL,
    "initialStateJson" TEXT NOT NULL,
    "metadataJson" TEXT NOT NULL,
    "logJson" TEXT NOT NULL DEFAULT '[]',
    "isGameover" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "Match_gameId_endedAt_idx" ON "Match"("gameId", "endedAt");
CREATE INDEX "MatchPlayer_userId_idx" ON "MatchPlayer"("userId");
CREATE INDEX "PlayerStat_gameId_won_idx" ON "PlayerStat"("gameId", "won");
CREATE INDEX "GameState_gameName_isGameover_updatedAt_idx" ON "GameState"("gameName", "isGameover", "updatedAt");
