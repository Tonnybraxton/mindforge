ALTER TABLE "GameSession" ADD COLUMN "typingConfig" JSONB;

CREATE TABLE "TypingGoal" (
  "userId" TEXT NOT NULL,
  "wpm" INTEGER NOT NULL DEFAULT 60,
  "accuracy" INTEGER NOT NULL DEFAULT 97,
  "minutes" INTEGER NOT NULL DEFAULT 10,
  CONSTRAINT "TypingGoal_pkey" PRIMARY KEY ("userId")
);
CREATE TABLE "TypingRace" (
  "id" TEXT NOT NULL,
  "hostId" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TypingRace_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TypingRace_createdAt_idx" ON "TypingRace"("createdAt");
ALTER TABLE "TypingGoal" ADD CONSTRAINT "TypingGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TypingRace" ADD CONSTRAINT "TypingRace_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
