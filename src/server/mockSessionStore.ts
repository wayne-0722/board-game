import { mockQuestions, type Question } from "../lib/questions";

type Player = {
  id: string;
  seatNumber: number;
  name: string;
  confirmed: boolean;
};

type GameState = "LOBBY" | "TURN_ACTIVE" | "QUESTION_ACTIVE" | "FINISHED";

export type Session = {
  code: string;
  players: Player[];
  currentPlayerId: string | null;
  gameState: GameState;
  questionLock: boolean;
  usedQuestionIds: string[];
  wrongQuestionIds: string[];
  currentQuestion: Question | null;
  answerResult: { selectedIndex: number; isCorrect: boolean } | null;
  turnIndex: number;
};

// Keep sessions in a global map so dev hot-reload / serverless reuses state.
const globalForSessions = global as unknown as { _sessions?: Map<string, Session> };
globalForSessions._sessions = globalForSessions._sessions || new Map<string, Session>();
const sessions: Map<string, Session> = globalForSessions._sessions;

const getSession = (code: string): Session => {
  const existing = sessions.get(code);
  if (existing) return existing;
  const fresh: Session = {
    code,
    players: [],
    currentPlayerId: null,
    gameState: "LOBBY",
    questionLock: false,
    usedQuestionIds: [],
    wrongQuestionIds: [],
    currentQuestion: null,
    answerResult: null,
    turnIndex: 0
  };
  sessions.set(code, fresh);
  return fresh;
};

const saveSession = (session: Session) => {
  sessions.set(session.code, session);
  return session;
};

export const joinSession = ({
  sessionCode,
  playerName,
  playerId
}: {
  sessionCode: string;
  playerName?: string;
  playerId?: string;
}) => {
  const code = sessionCode.trim().toUpperCase();
  const session = getSession(code);
  const existing = playerId
    ? session.players.find((p) => p.id === playerId)
    : undefined;

  if (existing) {
    existing.name = playerName || existing.name;
    return saveSession(session);
  }

  const seatNumber = session.players.length + 1;
  const newId = playerId || `player-${Math.floor(Math.random() * 90000) + 10000}`;
  const newPlayer: Player = {
    id: newId,
    seatNumber,
    name: playerName || `玩家 ${seatNumber}`,
    confirmed: false
  };
  session.players.push(newPlayer);
  if (!session.currentPlayerId) {
    session.currentPlayerId = newPlayer.id;
  }

  return saveSession(session);
};

export const confirmSeat = ({
  sessionCode,
  playerId,
  playerName
}: {
  sessionCode: string;
  playerId: string;
  playerName?: string;
}) => {
  const session = getSession(sessionCode);
  session.players = session.players.map((p) =>
    p.id === playerId
      ? { ...p, confirmed: true, name: playerName || p.name }
      : p
  );
  return saveSession(session);
};

export const startGame = (sessionCode: string) => {
  const session = getSession(sessionCode);
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
  return saveSession(session);
};

const pickQuestion = (usedQuestionIds: string[]) => {
  const available = mockQuestions.filter((q) => !usedQuestionIds.includes(q.id));
  if (available.length === 0) return null;
  const index = Math.floor(Math.random() * available.length);
  return available[index];
};

export const startQuestion = (sessionCode: string) => {
  const session = getSession(sessionCode);
  if (session.questionLock && session.currentQuestion) {
    return { session: saveSession(session) };
  }
  if (session.questionLock && !session.currentQuestion) {
    session.questionLock = false;
    return { session: saveSession(session), error: "上一題尚未完成，請稍後" };
  }

  session.usedQuestionIds = Array.from(new Set(session.usedQuestionIds));

  const question = pickQuestion(session.usedQuestionIds);
  if (!question) {
    session.gameState = "FINISHED";
    session.questionLock = false;
    session.currentQuestion = null;
    return { session: saveSession(session), error: "題目已用完，請進入反思或結束" };
  }
  session.currentQuestion = question;
  session.usedQuestionIds.push(question.id);
  session.gameState = "QUESTION_ACTIVE";
  session.questionLock = true;
  session.answerResult = null;
  return { session: saveSession(session) };
};

export const submitAnswer = ({
  sessionCode,
  selectedIndex
}: {
  sessionCode: string;
  selectedIndex: number;
}) => {
  const session = getSession(sessionCode);
  if (!session.currentQuestion) {
    session.questionLock = false;
    return { session: saveSession(session), error: "尚未抽題" };
  }
  const isCorrect = selectedIndex === session.currentQuestion.answerIndex;
  session.answerResult = { selectedIndex, isCorrect };
  if (!isCorrect) {
    session.wrongQuestionIds = Array.from(
      new Set([...session.wrongQuestionIds, session.currentQuestion.id])
    );
  }
  return { session: saveSession(session) };
};

export const advanceTurn = (sessionCode: string) => {
  const session = getSession(sessionCode);
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
  return saveSession(session);
};

export const getState = (sessionCode: string) => getSession(sessionCode);
