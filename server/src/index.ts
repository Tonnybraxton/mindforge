import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { createApp } from './app';
import { MemoryRepository } from './database/memory';
import { PrismaRepository } from './database/prisma';

const production = process.env.NODE_ENV === 'production';
const memory = process.env.MEMORY_DATABASE === 'true';
if (memory && production) throw new Error('MEMORY_DATABASE cannot be used in production.');
if (!memory && !process.env.DATABASE_URL) throw new Error('Set DATABASE_URL, or explicitly set MEMORY_DATABASE=true for temporary local development accounts.');
if (production && (!process.env.ACCESS_TOKEN_SECRET || !process.env.APP_ORIGIN)) throw new Error('Production requires ACCESS_TOKEN_SECRET and APP_ORIGIN.');
const repository = memory ? new MemoryRepository() : new PrismaRepository();
await repository.ping();
const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error('PORT must be a valid TCP port.');
const app = createApp({ repository, production, accessSecret: process.env.ACCESS_TOKEN_SECRET ?? randomBytes(48).toString('hex'), appOrigin: process.env.APP_ORIGIN ?? 'http://localhost:5173' });
const server = app.listen(port, () => {
  console.info(`MindForge API listening on port ${port} (${repository.kind}).`);
  if (memory) console.info('Development memory mode: accounts and results disappear when this process stops.');
});
let shuttingDown = false;
const shutdown = () => {
  if (shuttingDown) return;
  shuttingDown = true;
  const timeout = setTimeout(() => process.exit(1), 10_000);
  timeout.unref();
  server.close(async () => {
    if (repository instanceof PrismaRepository) await repository.client.$disconnect();
    clearTimeout(timeout); process.exit(0);
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
