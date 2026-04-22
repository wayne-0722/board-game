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
type ReflectionStats = Record<string, { correctCount: number }>;
type ReflectionStartTimes = Record<string, number>;
type ReflectionDisconnectedAt = Record<string, number>;

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
  reflectionDisconnectedAt: ReflectionDisconnectedAt;
  reflectionExcludedIds: string[];
  reflectionDeclinedIds: string[];
  reflectionExitVotes: string[];
  endVotes: string[];
  endVoteThreshold: number;
  lastActivityAt: number;
};

const defaultChips = 1500000;
const paidBuzzFee = 100000;
const chipWinThreshold = 3000000;
const redisUrl = process.env.REDIS_URL;
const useRedis = Boolean(redisUrl);
const sessionKey = (code: string) => `session:${code}`;
const sessionAuthKey = (code: string) => `session-auth:${code}`;

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

const globalForSessions = global as unknown as { _sessions?: Map<string, Session> };
globalForSessions._sessions = globalForSessions._sessions || new Map<string, Session>();
const sessions: Map<string, Session> = globalForSessions._sessions;

const globalForSessionAuth = global as unknown as {
  _sessionAuth?: Map<string, Record<string, string>>;
};
globalForSessionAuth._sessionAuth =
  globalForSessionAuth._sessionAuth || new Map<string, Record<string, string>>();
const sessionAuth: Map<string, Record<string, string>> = globalForSessionAuth._sessionAuth;

const normalizeSession = (session: Session) => {
  session.paidBuzzUsedIds = session.paidBuzzUsedIds || [];
  session.lastWrongResponderId = session.lastWrongResponderId || null;
  session.reflectionStats = session.reflectionStats || {};
  session.reflectionSettled = Boolean(session.reflectionSettled);
  session.reflectionStartTimes = session.reflectionStartTimes || {};
  session.reflectionDisconnectedAt = session.reflectionDisconnectedAt || {};
  session.reflectionExcludedIds = session.reflectionExcludedIds || [];
  session.reflectionDeclinedIds = session.reflectionDeclinedIds || [];
  session.reflectionExitVotes = session.reflectionExitVotes || [];
  session.reflectionQuestionIds = session.reflectionQuestionIds || [];
  session.usedQuestionIds = session.usedQuestionIds || [];
  session.wrongQuestionIds = session.wrongQuestionIds || [];
  session.endVotes = session.endVotes || [];
  session.endVoteThreshold =
    typeof session.endVoteThreshold === "number" ? session.endVoteThreshold : 0;
  session.lastActivityAt =
    typeof session.lastActivityAt === "number" ? session.lastActivityAt : Date.now();
  session.players = session.players.map((player) => ({
    ...player,
    chips: typeof player.chips === "number" ? player.chips : defaultChips
  }));
  return syncDerivedSessionFields(session);
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
  reflectionDisconnectedAt: {},
  reflectionExcludedIds: [],
  reflectionDeclinedIds: [],
  reflectionExitVotes: [],
  endVotes: [],
  endVoteThreshold: 0,
  lastActivityAt: Date.now()
});

const createPlayerToken = () =>
  `token-${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;

const loadRawSession = async (code: string): Promise<Session | null | undefined> => {
  const normalized = code.trim().toUpperCase();
  if (useRedis) {
    const client = await getRedisClient();
    const raw = client ? await client.get(sessionKey(normalized)) : null;
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Session;
    } catch {
      return undefined;
    }
  }
  return sessions.get(normalized) ?? null;
};

const loadSessionAuth = async (code: string): Promise<Record<string, string>> => {
  const normalized = code.trim().toUpperCase();
  if (useRedis) {
    const client = await getRedisClient();
    const raw = client ? await client.get(sessionAuthKey(normalized)) : null;
    if (!raw) return {};
    try {
      return JSON.parse(raw) as Record<string, string>;
    } catch {
      return {};
    }
  }
  return sessionAuth.get(normalized) || {};
};

const saveSessionAuth = async (code: string, auth: Record<string, string>) => {
  const normalized = code.trim().toUpperCase();
  if (useRedis) {
    const client = await getRedisClient();
    if (client) {
      await client.set(sessionAuthKey(normalized), JSON.stringify(auth));
    }
  } else {
    sessionAuth.set(normalized, auth);
  }
};

const getSession = async (code: string): Promise<Session> => {
  const normalized = code.trim().toUpperCase();
  let session = await loadRawSession(normalized);
  if (!session) {
    session = createFreshSession(normalized);
  } else {
    session = normalizeSession(session);
  }
  session = syncDerivedSessionFields(session);
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
  session = syncDerivedSessionFields(session);
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

const touchSession = (session: Session) => {
  session.lastActivityAt = Date.now();
  return session;
};

export const getExistingSession = async (code: string) => {
  const session = await loadRawSession(code);
  if (!session || session === undefined) return null;
  return normalizeSession(session);
};

export const getSessionAuth = async (code: string) => loadSessionAuth(code);

export const listSessionCodes = async () => {
  if (useRedis) {
    const client = await getRedisClient();
    if (!client) return [] as string[];
    const keys = await client.keys("session:*");
    return keys
      .filter((key) => !key.startsWith("session-auth:"))
      .map((key) => key.replace(/^session:/, ""));
  }
  return Array.from(sessions.keys());
};

export const deleteSession = async (sessionCode: string) => {
  const normalized = sessionCode.trim().toUpperCase();
  if (!normalized) return;
  if (useRedis) {
    const client = await getRedisClient();
    if (client) {
      await client.del(sessionKey(normalized));
      await client.del(sessionAuthKey(normalized));
    }
  } else {
    sessions.delete(normalized);
    sessionAuth.delete(normalized);
  }
};

export const joinSession = async ({
  sessionCode,
  playerName,
  playerId,
  playerToken
}: {
  sessionCode: string;
  playerName?: string;
  playerId?: string;
  playerToken?: string;
}) => {
  const code = sessionCode.trim().toUpperCase();
  if (!/^\d{2}$/.test(code)) {
    throw new Error("房號必須是 2 碼數字。");
  }
  const session = await getSession(code);
  const auth = await loadSessionAuth(code);
  const existing =
    playerId && playerToken && auth[playerId] === playerToken
      ? session.players.find((player) => player.id === playerId)
      : undefined;

  if (existing) {
    existing.name = playerName || existing.name;
    if (typeof existing.chips !== "number") existing.chips = defaultChips;
    const saved = await saveSession(touchSession(session));
    return { session: saved, playerId: existing.id, playerToken };
  }

  if (session.gameState !== "LOBBY") {
    throw new Error("遊戲已開始，無法再加入房間。");
  }

  const seatNumber = session.players.length + 1;
  const newId = `player-${Math.floor(Math.random() * 90000) + 10000}`;
  const newToken = createPlayerToken();
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
  auth[newId] = newToken;
  await saveSessionAuth(code, auth);

  const saved = await saveSession(touchSession(session));
  return { session: saved, playerId: newId, playerToken: newToken };
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
  session.players = session.players.map((player) =>
    player.id === playerId
      ? { ...player, confirmed: true, name: playerName || player.name }
      : player
  );
  return saveSession(touchSession(session));
};

export const startGame = async (sessionCode: string) => {
  const session = await getSession(sessionCode);
  const order = [...session.players].sort((left, right) => left.seatNumber - right.seatNumber);
  const allConfirmed = order.length >= 2 && order.every((player) => player.confirmed);
  if (!allConfirmed) {
    return {
      session: await saveSession(touchSession(session)),
      error:
        "至少需要 2 名玩家，且所有玩家都要先確認座位才能開始。"
    };
  }

  session.gameState = "TURN_ACTIVE";
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
  session.lastWrongResponderId = null;
  session.reflectionStats = {};
  session.reflectionSettled = false;
  session.reflectionStartTimes = {};
  session.reflectionDisconnectedAt = {};
  session.reflectionExcludedIds = [];
  session.reflectionDeclinedIds = [];
  session.reflectionExitVotes = [];
  session.endVotes = [];
  return { session: await saveSession(touchSession(session)) };
};

const pickQuestion = (usedQuestionIds: string[]) => {
  const available = mockQuestions.filter((question) => !usedQuestionIds.includes(question.id));
  if (available.length === 0) return null;
  const index = Math.floor(Math.random() * available.length);
  return available[index];
};

const getStake = (question: Question | null) => {
  if (!question) return 0;
  if (typeof question.stake === "number" && question.stake > 0) {
    return question.stake;
  }
  const raw = String(question.difficulty || "").trim();
  const normalized = raw.toLowerCase();
  const byDifficulty: Record<string, number> = {
    easy: 100000,
    low_medium: 300000,
    medium: 500000,
    medium_high: 600000,
    mediumlow: 300000,
    mediumhigh: 600000,
    high: 600000,
    hard: 700000,
    "簡單": 100000,
    "中低": 300000,
    "中等": 500000,
    "中高": 600000,
    "高": 600000,
    "困難": 700000
  };
  const mapped =
    byDifficulty[raw] ??
    byDifficulty[normalized] ??
    byDifficulty[raw.replace(/\s+/g, "")] ??
    byDifficulty[normalized.replace(/\s+/g, "")];
  return mapped ?? 100000;
};

const getReflectionQuestionIds = (session: Session) =>
  Array.from(new Set(session.wrongQuestionIds.filter((id) => session.usedQuestionIds.includes(id))));

const getEndVoteThreshold = (session: Session) => {
  const confirmedCount = session.players.filter((player) => player.confirmed).length || 0;
  const livingPlayers = confirmedCount > 0 ? confirmedCount : session.players.length || 1;
  return Math.ceil(livingPlayers / 2);
};

const syncDerivedSessionFields = (session: Session) => {
  session.reflectionQuestionIds = getReflectionQuestionIds(session);
  session.endVoteThreshold = getEndVoteThreshold(session);
  return session;
};

const resolveReflectionQuestionIds = (session: Session) => {
  if (session.reflectionQuestionIds.length > 0) return session.reflectionQuestionIds;
  return getReflectionQuestionIds(session);
};

const deductChips = (player: Player, amount: number) => {
  player.chips = Math.max(0, player.chips - amount);
};

const finalizeEndGame = (session: Session) => {
  session.gameState = "FINISHED";
  session.questionLock = false;
  session.buzzOpen = false;
  session.buzzReadyAt = null;
  session.buzzWinnerId = null;
  if (session.currentQuestion) {
    session.wrongQuestionIds = Array.from(
      new Set([...session.wrongQuestionIds, session.currentQuestion.id])
    );
  }
  return syncDerivedSessionFields(session);
};

const shouldEndByChips = (session: Session) =>
  session.players.some((player) => player.chips >= chipWinThreshold);

export const startQuestion = async (sessionCode: string) => {
  const session = await getSession(sessionCode);
  if (session.questionLock && session.currentQuestion) {
    return { session: await saveSession(touchSession(session)) };
  }
  if (session.questionLock && !session.currentQuestion) {
    session.questionLock = false;
    return {
      session: await saveSession(touchSession(session)),
      error:
        "題目狀態異常，已重置為可以重新抽題。"
    };
  }

  session.usedQuestionIds = Array.from(new Set(session.usedQuestionIds));
  session.wrongQuestionIds = session.wrongQuestionIds.filter((id) =>
    session.usedQuestionIds.includes(id)
  );

  const question = pickQuestion(session.usedQuestionIds);
  if (!question) {
    session.gameState = "FINISHED";
    session.questionLock = false;
    session.currentQuestion = null;
    syncDerivedSessionFields(session);
    return {
      session: await saveSession(touchSession(session)),
      error: "題庫已經抽完，遊戲結束並可進入反思。"
    };
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
  session.endVotes = [];
  session.reflectionExitVotes = [];
  return { session: await saveSession(touchSession(session)) };
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
    return {
      session: await saveSession(touchSession(session)),
      error: "目前沒有進行中的題目。"
    };
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
    ? session.players.find((player) => player.id === responderId)
    : undefined;
  let scoreDelta = 0;

  if (questionType === "multi") {
    let correctCount = 0;
    actualSet.forEach((value) => {
      if (expectedSet.has(value)) correctCount += 1;
    });
    const isBuzzAnswer =
      Boolean(session.lastWrongResponderId) &&
      Boolean(responderId) &&
      responderId !== session.lastWrongResponderId;

    if (isBuzzAnswer) {
      scoreDelta = isCorrect ? stake : 0;
    } else {
      scoreDelta = correctCount === 0 ? -stake : Math.min(stake, correctCount * 200000);
    }
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
    session.wrongQuestionIds = Array.from(
      new Set([...session.wrongQuestionIds, session.currentQuestion.id])
    );
    if (!session.lastWrongResponderId) {
      session.lastWrongResponderId = responderId || null;
      session.buzzOpen = true;
      session.buzzReadyAt = Date.now() + 10_000;
      session.activeResponderId = null;
    } else if (session.lastWrongResponderId && session.lastWrongResponderId !== responderId) {
      session.activeResponderId = responderId || null;
      session.lastWrongResponderId = null;
    }
  } else {
    if (responderId && session.lastWrongResponderId && responderId !== session.lastWrongResponderId) {
      const payer = session.players.find((player) => player.id === session.lastWrongResponderId);
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

  return { session: await saveSession(touchSession(session)) };
};

export const advanceTurn = async (sessionCode: string) => {
  const session = await getSession(sessionCode);
  const confirmedPlayers = session.players.filter((player) => player.confirmed);
  const order = (confirmedPlayers.length >= 2 ? confirmedPlayers : session.players).sort(
    (left, right) => left.seatNumber - right.seatNumber
  );
  if (order.length === 0) return saveSession(touchSession(session));

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
  session.endVotes = [];
  session.reflectionExitVotes = [];
  return saveSession(touchSession(session));
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
  return { session: await saveSession(touchSession(next)) };
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
  const buzzer = session.players.find((player) => player.id === playerId);
  if (!buzzer) {
    return { session: await saveSession(touchSession(session)), error: "找不到玩家。" };
  }
  if (!session.currentQuestion || !session.buzzOpen) {
    return {
      session: await saveSession(touchSession(session)),
      error: "目前不在可搶答狀態。"
    };
  }
  if (session.lastWrongResponderId === playerId) {
    return {
      session: await saveSession(touchSession(session)),
      error: "前一位答錯的玩家不能參與搶答。"
    };
  }
  if (
    session.answerResult &&
    session.answerResult.playerId === playerId &&
    !session.answerResult.isCorrect
  ) {
    return {
      session: await saveSession(touchSession(session)),
      error: "前一位答錯的玩家不能參與搶答。"
    };
  }
  if (session.paidBuzzUsedIds.includes(playerId)) {
    return {
      session: await saveSession(touchSession(session)),
      error: "你已經參加過這題的搶答。"
    };
  }
  if (buzzer.chips < paidBuzzFee) {
    return {
      session: await saveSession(touchSession(session)),
      error: "籌碼不足，無法支付搶答費用。"
    };
  }
  if (!session.buzzReadyAt || now > session.buzzReadyAt) {
    session.buzzOpen = false;
    return {
      session: await saveSession(touchSession(session)),
      error: "搶答時間已結束。"
    };
  }
  if (session.buzzWinnerId) {
    return {
      session: await saveSession(touchSession(session)),
      error: "這題已經有其他玩家搶答成功。"
    };
  }

  session.buzzWinnerId = playerId;
  session.activeResponderId = playerId;
  session.buzzOpen = false;
  session.answerResult = null;
  deductChips(buzzer, paidBuzzFee);
  session.paidBuzzUsedIds = Array.from(new Set([...(session.paidBuzzUsedIds || []), playerId]));
  return { session: await saveSession(touchSession(session)) };
};

export const startReflection = async (sessionCode: string, playerId: string) => {
  const session = await getSession(sessionCode);
  const playerExists = session.players.some((player) => player.id === playerId);
  if (!playerExists) {
    return { session: await saveSession(touchSession(session)), error: "找不到玩家。" };
  }
  if (session.reflectionSettled) {
    return {
      session: await saveSession(touchSession(session)),
      error: "反思結算已完成。"
    };
  }
  if (session.reflectionExcludedIds.includes(playerId)) {
    return {
      session: await saveSession(touchSession(session)),
      error: "你已被移出反思參與名單。"
    };
  }
  if (session.reflectionDeclinedIds.includes(playerId)) {
    return {
      session: await saveSession(touchSession(session)),
      error: "你已選擇略過反思。"
    };
  }
  if (session.reflectionStats[playerId]) {
    return {
      session: await saveSession(touchSession(session)),
      error: "你已經完成反思作答。"
    };
  }
  delete session.reflectionDisconnectedAt[playerId];
  session.reflectionDeclinedIds = session.reflectionDeclinedIds.filter((id) => id !== playerId);
  session.reflectionStartTimes[playerId] = session.reflectionStartTimes[playerId] || Date.now();
  return { session: await saveSession(touchSession(session)) };
};

export const skipReflection = async (sessionCode: string, playerId: string) => {
  const session = await getSession(sessionCode);
  const playerExists = session.players.some((player) => player.id === playerId);
  if (!playerExists) {
    return { session: await saveSession(touchSession(session)), error: "找不到玩家。" };
  }
  if (session.reflectionSettled) {
    return {
      session: await saveSession(touchSession(session)),
      error: "反思結算已完成。"
    };
  }
  if (session.reflectionStats[playerId]) {
    return {
      session: await saveSession(touchSession(session)),
      error: "你已經完成反思作答。"
    };
  }
  session.reflectionDeclinedIds = Array.from(
    new Set([...(session.reflectionDeclinedIds || []), playerId])
  );
  delete session.reflectionStartTimes[playerId];
  delete session.reflectionDisconnectedAt[playerId];
  delete session.reflectionStats[playerId];
  return { session: await saveSession(touchSession(session)) };
};

export const excludeReflectionParticipant = async (sessionCode: string, playerId: string) => {
  const session = await getSession(sessionCode);
  if (session.gameState !== "FINISHED") {
    return { session: await saveSession(touchSession(session)) };
  }
  session.reflectionExcludedIds = Array.from(
    new Set([...(session.reflectionExcludedIds || []), playerId])
  );
  delete session.reflectionStartTimes[playerId];
  delete session.reflectionDisconnectedAt[playerId];
  delete session.reflectionStats[playerId];
  session.reflectionDeclinedIds = session.reflectionDeclinedIds.filter((id) => id !== playerId);
  return { session: await saveSession(touchSession(session)) };
};

export const submitReflectionStats = async ({
  sessionCode,
  playerId,
  answers
}: {
  sessionCode: string;
  playerId: string;
  answers: Record<string, number[]>;
}) => {
  const session = await getSession(sessionCode);
  const player = session.players.find((entry) => entry.id === playerId);
  if (!player) {
    return { session: await saveSession(touchSession(session)), error: "找不到玩家。" };
  }
  if (session.reflectionSettled) {
    return {
      session: await saveSession(touchSession(session)),
      error: "反思結算已完成。"
    };
  }
  if (session.reflectionExcludedIds.includes(playerId)) {
    return {
      session: await saveSession(touchSession(session)),
      error: "你已被移出反思參與名單。"
    };
  }
  if (session.reflectionStats[playerId]) {
    return {
      session: await saveSession(touchSession(session)),
      error: "你已經送出反思作答。"
    };
  }
  if (!session.reflectionStartTimes[playerId]) {
    return {
      session: await saveSession(touchSession(session)),
      error: "你還沒有開始反思作答。"
    };
  }

  const safeAnswers = answers || {};
  const reflectionIds = resolveReflectionQuestionIds(session);
  const questions = mockQuestions.filter((question) => reflectionIds.includes(question.id));
  const correctCount = questions.reduce((accumulator, question) => {
    const expected = Array.from(new Set(question.answerIndices)).sort();
    const actual = Array.from(new Set(safeAnswers[question.id] || [])).sort();
    const isCorrect =
      expected.length === actual.length &&
      expected.every((value, index) => value === actual[index]);
    return accumulator + (isCorrect ? 1 : 0);
  }, 0);

  session.reflectionStats = session.reflectionStats || {};
  session.reflectionStats[playerId] = {
    correctCount: Math.max(0, Math.round(correctCount))
  };
  delete session.reflectionDisconnectedAt[playerId];
  return { session: await saveSession(touchSession(session)) };
};

export const settleReflection = async (sessionCode: string) => {
  const session = await getSession(sessionCode);
  session.reflectionStats = session.reflectionStats || {};
  const startedPlayerIds = Object.keys(session.reflectionStartTimes || {});
  const participants = session.players.filter(
    (player) =>
      startedPlayerIds.includes(player.id) &&
      !session.reflectionExcludedIds.includes(player.id) &&
      !session.reflectionDeclinedIds.includes(player.id)
  );

  if (participants.length === 0) {
    return {
      session: await saveSession(touchSession(session)),
      leaderboard: [],
      error: "目前沒有任何反思參與者。"
    };
  }

  const missingPlayers = participants.filter((player) => !session.reflectionStats[player.id]);
  if (missingPlayers.length > 0) {
    return {
      session: await saveSession(touchSession(session)),
      leaderboard: [],
      error: "仍有參與者尚未送出反思答案。"
    };
  }

  const leaderboard = Object.entries(session.reflectionStats)
    .map(([playerId, stats]) => ({
      playerId,
      correctCount: stats.correctCount,
      player: session.players.find((player) => player.id === playerId)
    }))
    .filter(
      (entry) =>
        entry.player && participants.some((participant) => participant.id === entry.playerId)
    )
    .sort((left, right) => {
      if (right.correctCount !== left.correctCount) return right.correctCount - left.correctCount;
      return (left.player?.seatNumber ?? Infinity) - (right.player?.seatNumber ?? Infinity);
    });

  if (!session.reflectionSettled && leaderboard.length > 0) {
    const prizeByRank = new Map<number, number>([
      [1, 500000],
      [2, 300000],
      [3, 200000]
    ]);
    const rankBuckets = new Map<number, typeof leaderboard>();
    let previousCorrectCount: number | null = null;
    let previousRank = 0;

    leaderboard.forEach((entry, index) => {
      const rank = previousCorrectCount === entry.correctCount ? previousRank : index + 1;
      previousCorrectCount = entry.correctCount;
      previousRank = rank;
      const bucket = rankBuckets.get(rank) || [];
      bucket.push(entry);
      rankBuckets.set(rank, bucket);
    });

    for (const [rank, prize] of prizeByRank.entries()) {
      const winners = rankBuckets.get(rank) || [];
      winners.forEach((entry) => {
        if (entry.player) {
          entry.player.chips += prize;
        }
      });
    }

    session.reflectionSettled = true;
  }

  return { session: await saveSession(touchSession(session)), leaderboard };
};

export const voteEndGame = async (sessionCode: string, playerId: string) => {
  const session = await getSession(sessionCode);
  if (!session.players.some((player) => player.id === playerId)) {
    return { session: await saveSession(touchSession(session)), error: "找不到玩家。" };
  }
  const threshold = session.endVoteThreshold;

  if (!shouldEndByChips(session)) {
    return {
      session: await saveSession(touchSession(session)),
      endVotes: session.endVotes || [],
      threshold,
      error:
        "目前還沒有玩家達到 300 萬籌碼，無法發起結束投票。"
    };
  }

  session.endVotes = Array.from(new Set([...(session.endVotes || []), playerId]));
  if (session.endVotes.length >= threshold && shouldEndByChips(session)) {
    finalizeEndGame(session);
  }
  return { session: await saveSession(touchSession(session)), endVotes: session.endVotes, threshold };
};

export const confirmReflectionExit = async (sessionCode: string, playerId: string) => {
  const session = await getSession(sessionCode);
  if (!session.players.some((player) => player.id === playerId)) {
    return { session: await saveSession(touchSession(session)), error: "Player not found." };
  }
  if (!session.reflectionSettled) {
    return { session: await saveSession(touchSession(session)), error: "Reflection is not settled yet." };
  }

  const eligiblePlayers = session.players.filter(
    (player) =>
      player.confirmed &&
      !session.reflectionExcludedIds.includes(player.id) &&
      !session.reflectionDeclinedIds.includes(player.id)
  );
  const threshold = (eligiblePlayers.length > 0 ? eligiblePlayers : session.players).length || 1;

  session.reflectionExitVotes = Array.from(
    new Set([...(session.reflectionExitVotes || []), playerId])
  );

  const shouldDestroy = session.reflectionExitVotes.length >= threshold;
  return {
    session: shouldDestroy ? session : await saveSession(touchSession(session)),
    exitVotes: session.reflectionExitVotes,
    threshold,
    shouldDestroy
  };
};

export const getState = async (sessionCode: string) => getSession(sessionCode);
