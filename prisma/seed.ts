import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { difficulties } from '../shared/contracts';
import { GENERATOR_VERSION } from '../shared/games/engine';
import { achievements, campaignLevel, worlds } from '../shared/progression';
import { games, getGame } from '../shared/registry';

const client = new PrismaClient();

try {
  // Seed only definitions. Accounts, scores, and social activity come from players.
  await client.$transaction(async tx => {
    for (const game of games) {
      const data = { slug: game.slug, name: game.name, category: game.category, description: game.description, enabled: true, generatorVersion: GENERATOR_VERSION };
      await tx.gameDefinition.upsert({ where: { id: game.slug }, create: { id: game.slug, ...data }, update: data });
    }
    for (const [index, name] of difficulties.entries()) {
      const data = { name, description: `${name} puzzle difficulty` };
      await tx.difficultyDefinition.upsert({ where: { id: index + 1 }, create: { id: index + 1, ...data }, update: data });
    }
    for (const achievement of achievements) {
      const data = { name: achievement.name, description: achievement.description, category: achievement.category, target: achievement.threshold };
      await tx.achievement.upsert({ where: { id: achievement.id }, create: { id: achievement.id, ...data }, update: data });
    }
    for (const [position, world] of worlds.entries()) {
      const data = { name: world.name, description: world.description, category: world.category, position: position + 1 };
      await tx.campaignWorld.upsert({ where: { id: world.id }, create: { id: world.id, ...data }, update: data });
      for (let number = 1; number <= world.levels; number++) {
        const level = campaignLevel(world.id, number);
        if (!getGame(level.slug)) continue;
        const id = `${world.id}:${number}`;
        const levelData = { worldId: world.id, number, gameId: level.slug, seed: level.seed, difficulty: level.difficulty, generatorVersion: GENERATOR_VERSION };
        await tx.campaignLevel.upsert({ where: { id }, create: { id, ...levelData }, update: levelData });
      }
    }
  }, { timeout: 120_000 });
  const availableLevels = worlds.reduce((count, world) => count + Array.from({ length: world.levels }, (_, index) => campaignLevel(world.id, index + 1)).filter(level => getGame(level.slug)).length, 0);
  console.info(`Seeded ${games.length} playable games, ${achievements.length} achievements, ${worlds.length} worlds, and ${availableLevels} available campaign levels.`);
} finally {
  await client.$disconnect();
}
