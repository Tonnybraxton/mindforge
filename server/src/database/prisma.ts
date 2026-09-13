import type { TypingConfig, TypingGoal } from '../../../shared/typing/types';
import type { TypingRaceRecord } from '../typing-records';
import { Prisma, PrismaClient } from '@prisma/client';
import type { GameResult, PlayerSettings } from '../../../shared/contracts';
import { achievementProgress, achievements, currentStreak, playerLevel, playerRank } from '../../../shared/progression';
import { getGame } from '../../../shared/registry';
import { ApiError } from '../shared/errors';
import { defaultSettings, type FriendRecord, type RefreshRecord, type Repository, type SessionRecord, type UserRecord } from './repository';

const includeUser = { profile: true, settings: true } as const;
type DatabaseUser = Prisma.UserGetPayload<{ include: typeof includeUser }>;
function userRecord(user: DatabaseUser): UserRecord {
  if (!user.profile || !user.settings) throw new Error('Account profile is incomplete.');
  return {
    id: user.id, email: user.email, username: user.username, passwordHash: user.passwordHash, role: user.role, createdAt: user.createdAt.toISOString(),
    profile: { avatar: user.profile.avatar, level: user.profile.level, xp: user.profile.xp, coins: user.profile.coins, rank: user.profile.rank, brainScore: user.profile.brainScore, totalGames: user.profile.totalGames, totalPlayTime: user.profile.totalPlayTime },
    settings: { theme: user.settings.theme as PlayerSettings['theme'], sound: user.settings.sound, volume: user.settings.volume, reducedMotion: user.settings.reducedMotion, highContrast: user.settings.highContrast, largeText: user.settings.largeText, colorBlind: user.settings.colorBlind, privacy: user.settings.privacy as PlayerSettings['privacy'] },
  };
}
function friendRecord(row: { id: string; requesterId: string; recipientId: string; status: string; createdAt: Date }): FriendRecord { return { ...row, status: row.status as FriendRecord['status'], createdAt: row.createdAt.toISOString() }; }
const json = (value: unknown) => value as Prisma.InputJsonValue;

export class PrismaRepository implements Repository {
  kind = 'postgres' as const;
  async getTypingGoal(userId: string) { return this.client.typingGoal.findUnique({ where: { userId }, select: { wpm: true, accuracy: true, minutes: true } }); }
  async setTypingGoal(userId:string, goal:TypingGoal) { await this.client.typingGoal.upsert({where:{userId},create:{userId,...goal},update:goal}); }
  async createTypingRace(race:TypingRaceRecord) { await this.client.typingRace.create({data:{id:race.id,hostId:race.hostId,data:json(race)}}); }
  async getTypingRace(id:string) { const row=await this.client.typingRace.findUnique({where:{id}}); return row ? row.data as unknown as TypingRaceRecord : null; }
  async changeTypingRace(id:string, change:(race:TypingRaceRecord)=>TypingRaceRecord) { return this.client.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "TypingRace" WHERE id = ${id} FOR UPDATE`; const row=await tx.typingRace.findUnique({where:{id}}); if(!row) throw new ApiError(404,'RACE_MISSING','Race not found.'); const next=change(row.data as unknown as TypingRaceRecord);await tx.typingRace.update({where:{id},data:{data:json(next)}});return next;}); }
  async typingRankings(since: Date | null, visibleTo?: string) {
    const friends = visibleTo ? (await this.friends(visibleTo)).filter(f => f.status === 'accepted').map(f => f.requesterId === visibleTo ? f.recipientId : f.requesterId) : [];
    const rows = await this.client.gameSession.findMany({ where: { gameId: 'typing-academy', completed: true, completedAt: since ? { gte: since } : undefined, user: visibleTo ? { OR: [{ id: visibleTo }, { id: { in: friends }, settings: { privacy: { in: ['friends', 'public'] } } }] } : { settings: { privacy: 'public' } } }, select: { userId: true, result: true, user: { select: { username: true } } } });
    return rows.map(r => ({ userId: r.userId, username: r.user.username, result: r.result as unknown as GameResult }));
  }

  constructor(public client = new PrismaClient()) {}
  async ping() { await this.client.$queryRaw`SELECT 1`; }
  async getUser(id: string) { const user = await this.client.user.findUnique({ where: { id }, include: includeUser }); return user ? userRecord(user) : null; }
  async findUser(email: string) { const user = await this.client.user.findUnique({ where: { email }, include: includeUser }); return user ? userRecord(user) : null; }
  async findUsername(username: string) { const user = await this.client.user.findUnique({ where: { username }, include: includeUser }); return user ? userRecord(user) : null; }
  async createUser(input: { email: string; username: string; passwordHash: string }) {
    return userRecord(await this.client.user.create({ data: { email: input.email, username: input.username, passwordHash: input.passwordHash, profile: { create: { rank: playerRank(1) } }, settings: { create: defaultSettings }, streak: { create: {} } }, include: includeUser }));
  }
  async updateUser(id: string, input: { username?: string; avatar?: string; settings?: Partial<PlayerSettings> }) {
    return userRecord(await this.client.user.update({ where: { id }, data: { username: input.username, profile: input.avatar ? { update: { avatar: input.avatar } } : undefined, settings: input.settings ? { update: input.settings } : undefined }, include: includeUser }));
  }
  async deleteUser(id: string) { const races=await this.client.typingRace.findMany();for(const row of races){const race=row.data as unknown as TypingRaceRecord;if(race.hostId!==id && race.participants.some(p=>p.userId===id)) await this.changeTypingRace(race.id,r=>({...r,participants:r.participants.filter(p=>p.userId!==id)}));}await this.client.user.delete({where:{id}}); }
  async saveRefresh(record: RefreshRecord) { await this.client.refreshToken.create({ data: record }); }
  async getRefresh(hash: string) { return this.client.refreshToken.findUnique({ where: { hash } }); }
  async rotateRefresh(hash: string, next: RefreshRecord, now: Date) {
    return this.client.$transaction(async tx => {
      // Rotation and family revocation take the same lock, so a concurrent logout
      // or replay cannot miss a newly inserted descendant token.
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${next.userId} FOR UPDATE`;
      const claimed = await tx.refreshToken.updateMany({ where: { hash, revoked: false, expiresAt: { gt: now } }, data: { revoked: true } });
      if (claimed.count !== 1) return false;
      await tx.refreshToken.create({ data: next }); return true;
    });
  }
  async revokeRefresh(hash: string) { await this.client.refreshToken.updateMany({ where: { hash }, data: { revoked: true } }); }
  async revokeFamily(family: string) {
    await this.client.$transaction(async tx => {
      const member = await tx.refreshToken.findFirst({ where: { family }, select: { userId: true } });
      if (!member) return;
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${member.userId} FOR UPDATE`;
      await tx.refreshToken.updateMany({ where: { family }, data: { revoked: true } });
    });
  }
  async createSession(session: SessionRecord) { const { slug, context, typingConfig, ...rest } = session; await this.client.gameSession.create({ data: { ...rest, typingConfig: typingConfig ? json(typingConfig) : Prisma.JsonNull, gameId: slug, context: context ? json(context) : Prisma.JsonNull } }); }
  async getSession(id: string): Promise<SessionRecord | null> {
    const session = await this.client.gameSession.findUnique({ where: { id } });
    return session ? { id: session.id, typingConfig: session.typingConfig as unknown as TypingConfig | undefined, userId: session.userId, slug: session.gameId, seed: session.seed, difficulty: session.difficulty, generatorVersion: session.generatorVersion, startedAt: session.startedAt, completed: session.completed, context: session.context as GameResult['context'] } : null;
  }
  async activeSessionCount(userId: string, since: Date) { return this.client.gameSession.count({ where: { userId, startedAt: { gte: since }, completed: false } }); }
  async completeSession(session: SessionRecord, result: GameResult) {
    // The profile row lock serializes reward, streak and achievement updates for one player.
    return this.client.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Profile" WHERE "userId" = ${session.userId} FOR UPDATE`;
      if (result.typing && await tx.gameSession.findFirst({ where: { userId: session.userId, seed: session.seed, completed: true, completedAt: { gte: new Date(result.completedAt.slice(0, 10) + 'T00:00:00Z'), lt: new Date(new Date(result.completedAt.slice(0, 10) + 'T00:00:00Z').getTime() + 86400000) } }, select: { id: true } })) { result.xp = 0; result.typing.xp = 0; }
      const claim = await tx.gameSession.updateMany({ where: { id: session.id, userId: session.userId, completed: false }, data: { completed: true, completedAt: new Date(result.completedAt), score: result.score, accuracy: result.accuracy, mistakes: result.mistakes, moves: result.moves, duration: result.duration, xpEarned: result.xp, result: json(result) } });
      if (claim.count !== 1) return false;
      if (session.context?.mode === 'daily') {
        const date = session.context.date!;
        await tx.dailyChallenge.upsert({ where: { date }, create: { id: date, date, gameId: session.slug, seed: session.seed, difficulty: session.difficulty }, update: {} });
        const prior = await tx.challengeAttempt.findUnique({ where: { userId_challengeId: { userId: session.userId, challengeId: date } } });
        if (prior) throw new ApiError(409, 'DAILY_ALREADY_COMPLETED', 'Today’s ranked challenge is already complete. Practice games are still available.');
        await tx.challengeAttempt.create({ data: { userId: session.userId, challengeId: date, sessionId: session.id, score: result.score } });
      }
      await tx.gameScore.create({ data: { sessionId: session.id, userId: session.userId, slug: session.slug, score: result.score, accuracy: result.accuracy } });
      await tx.reward.create({ data: { userId: session.userId, sessionId: session.id, source: 'game', sourceId: session.id, xp: result.xp, coins: Math.floor(result.xp / 10) } });
      const profile = await tx.profile.findUniqueOrThrow({ where: { userId: session.userId } });
      const xp = profile.xp + result.xp;
      await tx.profile.update({ where: { userId: session.userId }, data: { xp, coins: { increment: Math.floor(result.xp / 10) }, level: playerLevel(xp).level, rank: playerRank(playerLevel(xp).level), totalGames: { increment: 1 }, totalPlayTime: { increment: result.duration }, brainScore: Math.round((profile.brainScore * profile.totalGames + result.accuracy * 10) / (profile.totalGames + 1)) } });
      const category = getGame(session.slug)!.category;
      const cognitive = await tx.cognitiveScore.findUnique({ where: { userId_category: { userId: session.userId, category } } });
      await tx.cognitiveScore.upsert({ where: { userId_category: { userId: session.userId, category } }, create: { userId: session.userId, category, score: result.accuracy, samples: 1 }, update: { score: ((cognitive?.score ?? 0) * (cognitive?.samples ?? 0) + result.accuracy) / ((cognitive?.samples ?? 0) + 1), samples: { increment: 1 } } });
      if (session.context?.mode === 'campaign' && !session.typingConfig) {
        const levelId = `${session.context.world}:${session.context.level}`;
        const previous = await tx.campaignProgress.findUnique({ where: { userId_levelId: { userId: session.userId, levelId } } });
        const stars = result.accuracy >= 95 ? 3 : result.accuracy >= 70 ? 2 : 1;
        await tx.campaignProgress.upsert({ where: { userId_levelId: { userId: session.userId, levelId } }, create: { userId: session.userId, levelId, stars, bestScore: result.score }, update: { stars: Math.max(stars, previous?.stars ?? 0), bestScore: Math.max(result.score, previous?.bestScore ?? 0) } });
      }
      const rows = await tx.gameSession.findMany({ where: { userId: session.userId, completed: true }, select: { result: true } });
      const history = rows.map(row => row.result as unknown as GameResult);
      const streak = currentStreak(history, new Date(result.completedAt));
      const previousStreak = await tx.streak.findUnique({ where: { userId: session.userId } });
      await tx.streak.upsert({ where: { userId: session.userId }, create: { userId: session.userId, current: streak, longest: streak, lastPlayDay: result.completedAt.slice(0, 10) }, update: { current: streak, longest: Math.max(streak, previousStreak?.longest ?? 0), lastPlayDay: result.completedAt.slice(0, 10) } });
      const unlocked = achievements.filter(a => achievementProgress(a, history, slug => getGame(slug)?.category) >= a.threshold);
      if (unlocked.length) await tx.userAchievement.createMany({ data: unlocked.map(a => ({ userId: session.userId, achievementId: a.id })), skipDuplicates: true });
      return true;
    }, { timeout: 15_000 });
  }
  async history(userId: string) { const rows = await this.client.gameSession.findMany({ where: { userId, completed: true }, orderBy: { completedAt: 'desc' }, select: { result: true } }); return rows.map(row => row.result as unknown as GameResult); }
  async leaderboard(since: Date | null, slug?: string, visibleTo?: string) {
    const friendRecords = visibleTo ? await this.friends(visibleTo) : [];
    const friendIds = friendRecords.filter(f => f.status === 'accepted').map(f => f.requesterId === visibleTo ? f.recipientId : f.requesterId);
    const groups = await this.client.gameScore.groupBy({ by: ['userId'], where: { verified: true, slug, createdAt: since ? { gte: since } : undefined, user: visibleTo ? { OR: [{ id: visibleTo }, { id: { in: friendIds }, settings: { privacy: { in: ['friends', 'public'] } } }] } : { settings: { privacy: 'public' } } }, _max: { score: true }, _count: { id: true }, orderBy: { _max: { score: 'desc' } }, take: 100 });
    const users = await this.client.user.findMany({ where: { id: { in: groups.map(g => g.userId) } }, include: { profile: true } });
    return groups.map(group => { const user = users.find(u => u.id === group.userId)!; return { userId: user.id, username: user.username, avatar: user.profile?.avatar ?? 'spark', score: group._max.score ?? 0, games: group._count.id }; });
  }
  async friends(userId: string) { return (await this.client.friendship.findMany({ where: { OR: [{ requesterId: userId }, { recipientId: userId }] } })).map(friendRecord); }
  async requestFriend(requesterId: string, recipientId: string) { return friendRecord(await this.client.friendship.create({ data: { requesterId, recipientId, pairKey: [requesterId, recipientId].sort().join(':') } })); }
  async acceptFriend(id: string, userId: string) {
    const updated = await this.client.friendship.updateMany({ where: { id, recipientId: userId, status: 'pending' }, data: { status: 'accepted' } });
    return updated.count ? friendRecord(await this.client.friendship.findUniqueOrThrow({ where: { id } })) : null;
  }
}
