import { createClient } from "redis";
import { mockQuestions, type Question } from "../lib/questions";

type Player = {
  id: string;
  seatNumber: number;
  name: string;
  confirmed: boolean;
  chips: number;
};

type GameState = "LOBBY" | "TURN_ACTIVE" | "QUESTION_ACTIVE" | "FINISHED";
type AnswerResult = { selectedIndices: number[]; isCorrect: boolean; playerId?: string };
type ReflectionStats = Record<string, { totalTime: number; correctCount: number }>;
type ReflectionStartTimes = Record<string, number>;

export type Session = {
  code: string;
  players: Player[];
  currentPlayerId: string | null;
  gameState: GameState;
  questionLock: boolean;
  usedQuestionIds: string[];
  wrongQuestionIds: string[];
  reflectionQuestionIds: string[];
  currentQuestion: Question | null;
  answerResult: AnswerResult | null;
  turnIndex: number;
  activeResponderId: string | null;
  buzzOpen: boolean;
  buzzReadyAt: number | null;
  buzzWinnerId: string | null;
  paidBuzzUsedIds: string[];
  lastWrongResponderId: string | null;
  reflectionStats: ReflectionStats;
  reflectionSettled: boolean;
  reflectionStartTimes: ReflectionStartTimes;
  endVotes: string[];
};

const defaultChips = 4000000;
const redisUrl = process.env.REDIS_URL;
const useRedis = Boolean(redisUrl);
const sessionKey = (code: string) => `session:${code}`;

const globalForRedis = global as unknown as { _redisClient?: ReturnType<typeof createClient> };
const getRedisClient = async () => {
  if (!redisUrl) return null;
  if (!globalForRedis._redisClient) {
    globalForRedis._redisClient = createClient({ url: redisUrl });
    globalForRedis._redisClient.on("error", () => undefined);
  }
  if (!globalForRedis._redisClient.isOpen) {
    await globalForRedis._redisClient.connect();
  }
  return globalForRedis._redisClient;
};

// Keep in-memory fallback for local dev.
const globalForSessions = global as unknown as { _sessions?: Map<string, Session> };
globalForSessions._sessions = globalForSessions._sessions || new Map<string, Session>();
const sessions: Map<string, Session> = globalForSessions._sessions;

const normalizeSession = (session: Session) => {
  session.paidBuzzUsedIds = session.paidBuzzUsedIds || [];
  session.lastWrongResponderId = session.lastWrongResponderId || null;
  session.reflectionStats = session.reflectionStats || {};
  session.reflectionSettled = session.reflectionSettled || false;
  session.reflectionStartTimes = session.reflectionStartTimes || {};
  session.reflectionQuestionIds = session.reflectionQuestionIds || [];
  session.usedQuestionIds = session.usedQuestionIds || [];
  session.wrongQuestionIds = session.wrongQuestionIds || [];
  session.endVotes = session.endVotes || [];
  session.players = session.players.map((p) => ({
    ...p,
    chips: typeof p.chips === "number" ? p.chips : defaultChips
  }));
  return session;
};

const createFreshSession = (code: string): Session => ({
  code,
  players: [],
  currentPlayerId: null,
  gameState: "LOBBY",
  questionLock: false,
  usedQuestionIds: [],
  wrongQuestionIds: [],
  reflectionQuestionIds: [],
  currentQuestion: null,
  answerResult: null,
  turnIndex: 0,
  activeResponderId: null,
  buzzOpen: false,
  buzzReadyAt: null,
  buzzWinnerId: null,
  paidBuzzUsedIds: [],
  lastWrongResponderId: null,
  reflectionStats: {},
  reflectionSettled: false,
  reflectionStartTimes: {},
  endVotes: []
});

const getSession = async (code: string): Promise<Session> => {
  const normalized = code.trim().toUpperCase();
  let session: Session | null | undefined;
  if (useRedis) {
    const client = await getRedisClient();
    const raw = client ? await client.get(sessionKey(normalized)) : null;
    if (raw) {
      try {
        session = JSON.parse(raw) as Session;
      } catch {
        session = undefined;
      }
    }
  } else {
    session = sessions.get(normalized);
  }
  if (!session) {
    session = createFreshSession(normalized);
  } else {
    session = normalizeSession(session);
  }
  if (useRedis) {
    const client = await getRedisClient();
    if (client) {
      await client.set(sessionKey(normalized), JSON.stringify(session));
    }
  } else {
    sessions.set(normalized, session);
  }
  return session;
};

const saveSession = async (session: Session) => {
  const normalized = session.code.trim().toUpperCase();
  session.code = normalized;
  if (useRedis) {
    const client = await getRedisClient();
    if (client) {
      await client.set(sessionKey(normalized), JSON.stringify(session));
    }
  } else {
    sessions.set(normalized, session);
  }
  return session;
};

export const joinSession = async ({
  sessionCode,
  playerName,
  playerId
}: {
  sessionCode: string;
  playerName?: string;
  playerId?: string;
}) => {
  const code = sessionCode.trim().toUpperCase();
  if (!/^\d{2}$/.test(code)) {
    throw new Error("房間號需為 2 位數");
  }
  const session = await getSession(code);
  const existing = playerId ? session.players.find((p) => p.id === playerId) : undefined;

  if (existing) {
    existing.name = playerName || existing.name;
    if (typeof existing.chips !== "number") existing.chips = defaultChips;
    const saved = await saveSession(session);
    return { session: saved, playerId: existing.id };
  }

  const seatNumber = session.players.length + 1;
  const newId = playerId || `player-${Math.floor(Math.random() * 90000) + 10000}`;
  const newPlayer: Player = {
    id: newId,
    seatNumber,
    name: playerName || `玩家 ${seatNumber}`,
    confirmed: false,
    chips: defaultChips
  };
  session.players.push(newPlayer);
  if (!session.currentPlayerId) {
    session.currentPlayerId = newPlayer.id;
  }

  const saved = await saveSession(session);
  return { session: saved, playerId: newId };
};

export const confirmSeat = async ({
  sessionCode,
  playerId,
  playerName
}: {
  sessionCode: string;
  playerId: string;
  playerName?: string;
}) => {
  const session = await getSession(sessionCode);
  session.players = session.players.map((p) =>
    p.id === playerId ? { ...p, confirmed: true, name: playerName || p.name } : p
  );
  return saveSession(session);
};

export const startGame = async (sessionCode: string) => {
  const session = await getSession(sessionCode);
  const confirmedPlayers = session.players.filter((p) => p.confirmed);
  const order =
    (confirmedPlayers.length >= 2 ? confirmedPlayers : session.players).sort(
      (a, b) => a.seatNumber - b.seatNumber
    );
  session.gameState = order.length >= 2 ? "TURN_ACTIVE" : "LOBBY";
  session.turnIndex = 0;
  session.currentPlayerId = order[0]?.id ?? null;
  session.questionLock = false;
  session.currentQuestion = null;
  session.answerResult = null;
  session.usedQuestionIds = [];
  session.wrongQuestionIds = [];
  session.reflectionQuestionIds = [];
  session.activeResponderId = session.currentPlayerId;
  session.buzzOpen = false;
  session.buzzReadyAt = null;
  session.buzzWinnerId = null;
  session.paidBuzzUsedIds = [];
  session.lastWrongResponderId = null;
  session.reflectionStats = {};
  session.reflectionSettled = false;
  session.reflectionStartTimes = {};
  session.endVotes = [];
  return saveSession(session);
};

const pickQuestion = (usedQuestionIds: string[]) => {
  const available = mockQuestions.filter((q) => !usedQuestionIds.includes(q.id));
  if (available.length === 0) return null;
  const index = Math.floor(Math.random() * available.length);
  return available[index];
};

const getStake = (question: Question | null) => {
  if (!question) return 0;
  const raw = String(question.difficulty || "").trim();
  const normalized = raw.toLowerCase();
  const stakeByDifficulty: Record<string, number> = {
    易: 100000,
    中低: 300000,
    中: 500000,
    中高: 600000,
    難: 700000,
    easy: 100000,
    low_medium: 300000,
    medium: 500000,
    medium_high: 600000,
    high: 600000,
    hard: 700000
  };
  const mapped =
    stakeByDifficulty[raw] ??
    stakeByDifficulty[normalized] ??
    stakeByDifficulty[raw.replace(/\s+/g, "")] ??
    stakeByDifficulty[normalized.replace(/\s+/g, "")];
  if (mapped) return mapped;
  return Math.max(0, Number((question as any)?.stake ?? 100000)) || 0;
};

const getReflectionQuestionIds = (session: Session) =>
  Array.from(new Set(session.wrongQuestionIds.filter((id) => session.usedQuestionIds.includes(id))));

const resolveReflectionQuestionIds = (session: Session) => {
  if (session.reflectionQuestionIds.length > 0) {
    return session.reflectionQuestionIds;
  }
  return getReflectionQuestionIds(session);
};

const deductChips = (player: Player, amount: number) => {
  player.chips = Math.max(0, player.chips - amount);
};

export const startQuestion = async (sessionCode: string) => {
  const session = await getSession(sessionCode);
  if (session.questionLock && session.currentQuestion) {
    return { session: await saveSession(session) };
  }
  if (session.questionLock && !session.currentQuestion) {
    session.questionLock = false;
    return { session: await saveSession(session), error: "上一題出錯，請重新開始" };
  }

  // Trim wrong-question pool to only this round.
  session.usedQuestionIds = Array.from(new Set(session.usedQuestionIds));
  session.wrongQuestionIds = session.wrongQuestionIds.filter((id) =>
    session.usedQuestionIds.includes(id)
  );

  const question = pickQuestion(session.usedQuestionIds);
  if (!question) {
    session.gameState = "FINISHED";
    session.questionLock = false;
    session.currentQuestion = null;
    session.reflectionQuestionIds = getReflectionQuestionIds(session);
    return { session: await saveSession(session), error: "題庫已用完，請進入反思結算" };
  }
  session.currentQuestion = question;
  session.usedQuestionIds.push(question.id);
  session.gameState = "QUESTION_ACTIVE";
  session.questionLock = true;
  session.answerResult = null;
  session.activeResponderId = session.currentPlayerId;
  session.buzzOpen = false;
  session.buzzReadyAt = null;
  session.buzzWinnerId = null;
  session.lastWrongResponderId = null;
  session.paidBuzzUsedIds = session.paidBuzzUsedIds || [];
  session.endVotes = [];
  return { session: await saveSession(session) };
};

export const submitAnswer = async ({
  sessionCode,
  selectedIndices
}: {
  sessionCode: string;
  selectedIndices: number[];
}) => {
  const session = await getSession(sessionCode);
  if (!session.currentQuestion) {
    session.questionLock = false;
    return { session: await saveSession(session), error: "尚未取得題目" };
  }
  const responderId = session.activeResponderId || session.currentPlayerId || undefined;
  const expectedSet = new Set(session.currentQuestion.answerIndices);
  const actualSet = new Set(selectedIndices);
  const expected = Array.from(expectedSet).sort();
  const actual = Array.from(actualSet).sort();
  const isCorrect =
    expected.length === actual.length &&
    expected.every((value, index) => value === actual[index]);
  session.answerResult = { selectedIndices: actual, isCorrect, playerId: responderId };
  session.buzzOpen = false;
  session.buzzReadyAt = null;
  session.buzzWinnerId = null;
  const stake = getStake(session.currentQuestion);
  const questionType = session.currentQuestion.type;
  const responderPlayer = responderId
    ? session.players.find((p) => p.id === responderId)
    : undefined;
  let scoreDelta = 0;
  if (questionType === "multi") {
    let correctCount = 0;
    actualSet.forEach((value) => {
      if (expectedSet.has(value)) correctCount += 1;
    });
    scoreDelta = correctCount === 0 ? -stake : Math.min(stake, correctCount * 200000);
  } else {
    scoreDelta = isCorrect ? stake : -stake;
  }
  if (responderPlayer && scoreDelta !== 0) {
    if (scoreDelta > 0) {
      responderPlayer.chips += scoreDelta;
    } else {
      deductChips(responderPlayer, Math.abs(scoreDelta));
    }
  }
  if (!isCorrect) {
    // Wrong answers go into the reflection pool.
    session.wrongQuestionIds = Array.from(
      new Set([...session.wrongQuestionIds, session.currentQuestion.id])
    );
    if (!session.lastWrongResponderId) {
      // First wrong opens the 10s paid-buzz window.
      session.lastWrongResponderId = responderId || null;
      session.buzzOpen = true;
      session.buzzReadyAt = Date.now() + 10_000;
      session.activeResponderId = null;
    } else if (session.lastWrongResponderId && session.lastWrongResponderId !== responderId) {
      // Second wrong (buzz) -> move to next turn and keep the question in wrong pool.
      const nextSession = await advanceTurn(sessionCode);
      nextSession.wrongQuestionIds = Array.from(
        new Set([...nextSession.wrongQuestionIds, session.currentQuestion.id])
      );
      return { session: await saveSession(nextSession) };
    }
  } else {
    if (responderId && session.lastWrongResponderId && responderId !== session.lastWrongResponderId) {
      // If a buzz winner answers correctly, transfer 1x stake from the original wrong responder.
      const payer = session.players.find((p) => p.id === session.lastWrongResponderId);
      if (payer) {
        const payment = Math.max(0, Math.min(payer.chips, stake));
        deductChips(payer, payment);
        if (responderPlayer) {
          responderPlayer.chips += payment;
        }
      }
    }
    session.lastWrongResponderId = null;
    session.activeResponderId = responderId || null;
  }
  return { session: await saveSession(session) };
};

export const advanceTurn = async (sessionCode: string) => {
  const session = await getSession(sessionCode);
  const confirmedPlayers = session.players.filter((p) => p.confirmed);
  const order =
    (confirmedPlayers.length >= 2 ? confirmedPlayers : session.players).sort(
      (a, b) => a.seatNumber - b.seatNumber
    );
  if (order.length === 0) return saveSession(session);
  const nextIndex = (session.turnIndex + 1) % order.length;
  session.turnIndex = nextIndex;
  session.currentPlayerId = order[nextIndex].id;
  session.gameState = "TURN_ACTIVE";
  session.questionLock = false;
  session.currentQuestion = null;
  session.answerResult = null;
  session.activeResponderId = session.currentPlayerId;
  session.buzzOpen = false;
  session.buzzReadyAt = null;
  session.buzzWinnerId = null;
  session.lastWrongResponderId = null;
  session.paidBuzzUsedIds = session.paidBuzzUsedIds || [];
  session.endVotes = [];
  return saveSession(session);
};

export const forfeitQuestion = async (sessionCode: string) => {
  const session = await getSession(sessionCode);
  if (session.currentQuestion) {
    session.wrongQuestionIds = Array.from(
      new Set([...session.wrongQuestionIds, session.currentQuestion.id])
    );
  }
  const next = await advanceTurn(sessionCode);
  next.buzzOpen = false;
  next.buzzReadyAt = null;
  next.buzzWinnerId = null;
  next.lastWrongResponderId = null;
  return { session: await saveSession(next) };
};

export const buzzIn = async ({
  sessionCode,
  playerId
}: {
  sessionCode: string;
  playerId: string;
}) => {
  const session = await getSession(sessionCode);
  const now = Date.now();
  const stake = getStake(session.currentQuestion);
  const buzzer = session.players.find((p) => p.id === playerId);
  if (!buzzer) {
    return { session: await saveSession(session), error: "找不到玩家" };
  }
  if (!session.currentQuestion || !session.buzzOpen) {
    return { session: await saveSession(session), error: "Buzz is not available" };
  }
  if (
    session.answerResult &&
    session.answerResult.playerId === playerId &&
    !session.answerResult.isCorrect
  ) {
    return { session: await saveSession(session), error: "Previous answerer cannot buzz" };
  }
  if (session.paidBuzzUsedIds.includes(playerId)) {
    return { session: await saveSession(session), error: "付費搶答已使用" };
  }
  if (buzzer.chips < stake) {
    return { session: await saveSession(session), error: "籌碼不足，無法付費搶答" };
  }
  if (!session.buzzReadyAt || now > session.buzzReadyAt) {
    session.buzzOpen = false;
    return { session: await saveSession(session), error: "Buzz window closed" };
  }
  if (session.buzzWinnerId) {
    return { session: await saveSession(session), error: "Another player already buzzed in" };
  }

  session.buzzWinnerId = playerId;
  session.activeResponderId = playerId;
  session.buzzOpen = false;
  deductChips(buzzer, stake);
  session.paidBuzzUsedIds = Array.from(new Set([...(session.paidBuzzUsedIds || []), playerId]));
  return { session: await saveSession(session) };
};

export const startReflection = async (sessionCode: string, playerId: string) => {
  const session = await getSession(sessionCode);
  const playerExists = session.players.some((p) => p.id === playerId);
  if (!playerExists) {
    return { session: await saveSession(session), error: "找不到玩家" };
  }
  session.reflectionStartTimes = session.reflectionStartTimes || {};
  if (!session.reflectionStartTimes[playerId]) {
    session.reflectionStartTimes[playerId] = Date.now();
  }
  return { session: await saveSession(session) };
};

export const submitReflectionStats = async ({
  sessionCode,
  playerId,
  answers,
  totalTime
}: {
  sessionCode: string;
  playerId: string;
  answers: Record<string, number[]>;
  totalTime?: number;
}) => {
  const session = await getSession(sessionCode);
  const player = session.players.find((p) => p.id === playerId);
  if (!player) {
    return { session: await saveSession(session), error: "找不到玩家" };
  }
  const safeAnswers = answers || {};
  const reflectionIds = resolveReflectionQuestionIds(session);
  const questions = mockQuestions.filter((q) => reflectionIds.includes(q.id));
  const correctCount = questions.reduce((acc, q) => {
    const expected = Array.from(new Set(q.answerIndices)).sort();
    const actual = Array.from(new Set(safeAnswers[q.id] || [])).sort();
    const ok =
      expected.length === actual.length &&
      expected.every((value, index) => value === actual[index]);
    return acc + (ok ? 1 : 0);
  }, 0);
  const startedAt = session.reflectionStartTimes?.[playerId];
  const elapsed =
    typeof totalTime === "number"
      ? totalTime
      : startedAt
      ? Math.round((Date.now() - startedAt) / 1000)
      : 0;
  session.reflectionStats = session.reflectionStats || {};
  session.reflectionStats[playerId] = {
    totalTime: Math.max(0, Math.round(elapsed)),
    correctCount: Math.max(0, Math.round(correctCount))
  };
  return { session: await saveSession(session) };
};

export const settleReflection = async (sessionCode: string) => {
  const session = await getSession(sessionCode);
  session.reflectionStats = session.reflectionStats || {};
  const prizes = [500000, 250000, 100000];
  const leaderboard = Object.entries(session.reflectionStats)
    .map(([pid, stats]) => ({
      playerId: pid,
      totalTime: stats.totalTime,
      correctCount: stats.correctCount,
      player: session.players.find((p) => p.id === pid)
    }))
    .filter((entry) => entry.player)
    .sort((a, b) => {
      if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
      return a.totalTime - b.totalTime;
    });

  if (!session.reflectionSettled && leaderboard.length > 0) {
    leaderboard.forEach((entry, idx) => {
      const prize = prizes[idx];
      if (!prize) return;
      if (entry.player) {
        entry.player.chips += prize;
      }
    });
    session.reflectionSettled = true;
  }

  return { session: await saveSession(session), leaderboard };
};

export const voteEndGame = async (sessionCode: string, playerId: string) => {
  const session = await getSession(sessionCode);
  if (!session.players.some((p) => p.id === playerId)) {
    return { session: await saveSession(session), error: "玩家不存在" };
  }
  session.endVotes = Array.from(new Set([...(session.endVotes || []), playerId]));
  const confirmedCount = session.players.filter((p) => p.confirmed).length || 0;
  const livingPlayers = confirmedCount > 0 ? confirmedCount : session.players.length || 1;
  const threshold = Math.ceil(livingPlayers / 2);
  if (session.endVotes.length >= threshold) {
    session.gameState = "FINISHED";
    session.questionLock = false;
    session.buzzOpen = false;
    if (session.currentQuestion) {
      session.wrongQuestionIds = Array.from(
        new Set([...session.wrongQuestionIds, session.currentQuestion.id])
      );
    }
    session.reflectionQuestionIds = getReflectionQuestionIds(session);
  }
  return { session: await saveSession(session), endVotes: session.endVotes, threshold };
};

export const getState = async (sessionCode: string) => getSession(sessionCode);
