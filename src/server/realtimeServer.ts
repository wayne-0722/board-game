import type { Server as HttpServer } from "http";
import { Server, type Socket } from "socket.io";
import {
  advanceTurn,
  buzzIn,
  confirmSeat,
  confirmReflectionExit,
  deleteSession,
  excludeReflectionParticipant,
  forfeitQuestion,
  getExistingSession,
  getSessionAuth,
  joinSession,
  listSessionCodes,
  settleReflection,
  skipReflection,
  startGame,
  startQuestion,
  startReflection,
  submitAnswer,
  submitReflectionStats,
  voteEndGame,
  type Session
} from "./mockSessionStore";
import type {
  ActionResult,
  ClientToServerEvents,
  ServerToClientEvents,
  SessionExpiredPayload,
  SessionView
} from "../realtime/events";

type InterServerEvents = Record<string, never>;
type SocketData = {
  clientId: string;
  sessionCode: string | null;
  playerId: string | null;
  playerToken: string | null;
};

const SESSION_ROOM_PREFIX = "session:";
const HEARTBEAT_INTERVAL_MS = 10000;
const EMPTY_ROOM_TTL_MS = 60000;
const INACTIVE_ROOM_TTL_MS = 30 * 60000;
const INACTIVITY_SWEEP_INTERVAL_MS = 60000;
const REFLECTION_DISCONNECT_TTL_MS = 2 * 60000;

const roomCleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();
const reflectionDisconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
const buzzExpiryTimers = new Map<string, ReturnType<typeof setTimeout>>();

const getRoomName = (sessionCode: string) => `${SESSION_ROOM_PREFIX}${sessionCode.trim().toUpperCase()}`;

const getViewFromSession = (session: Session): SessionView => {
  if (session.gameState === "FINISHED") return "REFLECT";
  if (session.gameState === "QUESTION_ACTIVE" || (session.questionLock && session.currentQuestion)) {
    return "QUESTION";
  }
  if (session.gameState === "TURN_ACTIVE") return "PLAY";
  return "LOBBY";
};

const ok = (data?: Record<string, unknown>): ActionResult => ({ ok: true, data });
const fail = (error: string, data?: Record<string, unknown>): ActionResult => ({ ok: false, error, data });

const normalizeSessionCode = (sessionCode: string) => sessionCode.trim().toUpperCase();

export const initRealtimeServer = (server: HttpServer) => {
  const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(server, {
    path: "/socket.io",
    cors: { origin: true, credentials: true },
    transports: ["websocket", "polling"],
    pingInterval: 25000,
    pingTimeout: 20000
  });

  const clearSocketSession = (
    socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
  ) => {
    socket.data.sessionCode = null;
    socket.data.playerId = null;
    socket.data.playerToken = null;
  };

  const emitSessionExpired = (sessionCode: string, reason: SessionExpiredPayload["reason"]) => {
    io.to(getRoomName(sessionCode)).emit("session_expired", {
      sessionCode: normalizeSessionCode(sessionCode),
      reason
    });
  };

  const broadcastSession = async (sessionCode: string) => {
    const session = await getExistingSession(sessionCode);
    if (!session) return;
    scheduleBuzzExpiry(session);
    io.to(getRoomName(session.code)).emit("session_snapshot", {
      session,
      view: getViewFromSession(session),
      timestamp: Date.now()
    });
  };

  const cancelBuzzExpiry = (sessionCode: string | null) => {
    if (!sessionCode) return;
    const normalized = normalizeSessionCode(sessionCode);
    const timer = buzzExpiryTimers.get(normalized);
    if (!timer) return;
    clearTimeout(timer);
    buzzExpiryTimers.delete(normalized);
  };

  const scheduleBuzzExpiry = (session: Session) => {
    const normalized = normalizeSessionCode(session.code);
    cancelBuzzExpiry(normalized);

    if (
      session.gameState !== "QUESTION_ACTIVE" ||
      !session.buzzOpen ||
      !session.buzzReadyAt ||
      session.buzzWinnerId
    ) {
      return;
    }

    const delay = Math.max(0, session.buzzReadyAt - Date.now());
    const timer = setTimeout(async () => {
      buzzExpiryTimers.delete(normalized);
      const latest = await getExistingSession(normalized);
      if (!latest) return;
      if (
        latest.gameState !== "QUESTION_ACTIVE" ||
        !latest.buzzOpen ||
        !latest.buzzReadyAt ||
        latest.buzzWinnerId ||
        Date.now() <= latest.buzzReadyAt
      ) {
        return;
      }

      const nextSession = await advanceTurn(normalized);
      await broadcastSession(nextSession.code);
    }, delay + 10);

    buzzExpiryTimers.set(normalized, timer);
  };

  const getActivePlayersInRoom = async (sessionCode: string) => {
    const sockets = await io.in(getRoomName(normalizeSessionCode(sessionCode))).fetchSockets();
    return new Set(
      sockets
        .map((socket) => socket.data.playerId)
        .filter((playerId): playerId is string => Boolean(playerId))
    );
  };

  const cancelRoomCleanup = (sessionCode: string | null) => {
    if (!sessionCode) return;
    const normalized = normalizeSessionCode(sessionCode);
    const timer = roomCleanupTimers.get(normalized);
    if (!timer) return;
    clearTimeout(timer);
    roomCleanupTimers.delete(normalized);
  };

  const getReflectionDisconnectKey = (sessionCode: string, playerId: string) =>
    `${normalizeSessionCode(sessionCode)}:${playerId}`;

  const cancelReflectionDisconnect = (sessionCode: string | null, playerId: string | null) => {
    if (!sessionCode || !playerId) return;
    const key = getReflectionDisconnectKey(sessionCode, playerId);
    const timer = reflectionDisconnectTimers.get(key);
    if (!timer) return;
    clearTimeout(timer);
    reflectionDisconnectTimers.delete(key);
  };

  const scheduleReflectionDisconnect = async (sessionCode: string | null, playerId: string | null) => {
    if (!sessionCode || !playerId) return;
    const session = await getExistingSession(sessionCode);
    if (!session || session.gameState !== "FINISHED") return;
    if (!session.reflectionStartTimes[playerId] || session.reflectionStats[playerId]) return;

    const key = getReflectionDisconnectKey(sessionCode, playerId);
    if (reflectionDisconnectTimers.has(key)) return;

    const timer = setTimeout(async () => {
      reflectionDisconnectTimers.delete(key);
      await excludeReflectionParticipant(sessionCode, playerId);
      await broadcastSession(sessionCode);
    }, REFLECTION_DISCONNECT_TTL_MS);

    reflectionDisconnectTimers.set(key, timer);
  };

  const expireSession = async (sessionCode: string, reason: SessionExpiredPayload["reason"]) => {
    const normalized = normalizeSessionCode(sessionCode);
    cancelRoomCleanup(normalized);
    cancelBuzzExpiry(normalized);
    emitSessionExpired(normalized, reason);
    io.in(getRoomName(normalized)).socketsLeave(getRoomName(normalized));
    await deleteSession(normalized);
  };

  const pruneRoomIfEmpty = async (sessionCode: string | null) => {
    if (!sessionCode) return;
    const normalized = normalizeSessionCode(sessionCode);
    const activePlayers = await getActivePlayersInRoom(normalized);
    if (activePlayers.size > 0) {
      cancelRoomCleanup(normalized);
      return;
    }
    if (roomCleanupTimers.has(normalized)) return;

    const timer = setTimeout(async () => {
      roomCleanupTimers.delete(normalized);
      const latestPlayers = await getActivePlayersInRoom(normalized);
      if (latestPlayers.size > 0) return;
      await expireSession(normalized, "empty_timeout");
    }, EMPTY_ROOM_TTL_MS);

    roomCleanupTimers.set(normalized, timer);
  };

  const sweepInactiveRooms = async () => {
    const sessionCodes = await listSessionCodes();
    const now = Date.now();
    await Promise.all(
      sessionCodes.map(async (sessionCode) => {
        const session = await getExistingSession(sessionCode);
        if (!session) return;
        if (now - session.lastActivityAt < INACTIVE_ROOM_TTL_MS) return;
        await expireSession(session.code, "inactive_timeout");
      })
    );
  };

  const joinRoom = async (
    socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
    sessionCode: string,
    playerId?: string,
    playerToken?: string
  ) => {
    const normalized = normalizeSessionCode(sessionCode);
    cancelRoomCleanup(normalized);
    cancelReflectionDisconnect(normalized, playerId || socket.data.playerId || null);

    const previousSessionCode = socket.data.sessionCode;
    if (previousSessionCode) {
      await socket.leave(getRoomName(previousSessionCode));
      await pruneRoomIfEmpty(previousSessionCode);
    }

    await socket.join(getRoomName(normalized));
    socket.data.sessionCode = normalized;
    socket.data.playerId = playerId || socket.data.playerId || null;
    socket.data.playerToken = playerToken || socket.data.playerToken || null;
  };

  const getAuthorizedSession = async (
    socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
    sessionCode: string
  ) => {
    const normalized = normalizeSessionCode(sessionCode);
    const actorId = socket.data.playerId;
    const playerToken = socket.data.playerToken;
    if (!actorId || !playerToken) {
      throw new Error("Player identity is missing. Please rejoin the room.");
    }

    const session = await getExistingSession(normalized);
    if (!session) {
      clearSocketSession(socket);
      throw new Error("Room is no longer available. Please rejoin.");
    }

    const auth = await getSessionAuth(normalized);
    if (auth[actorId] !== playerToken) {
      clearSocketSession(socket);
      throw new Error("Player token mismatch. Please rejoin the room.");
    }

    const player = session.players.find((entry) => entry.id === actorId);
    if (!player) {
      clearSocketSession(socket);
      throw new Error("Player is no longer in this room.");
    }

    return { session, actorId, player };
  };

  const assertCurrentTurnOwner = (session: Session, actorId: string) => {
    if (session.currentPlayerId !== actorId) {
      throw new Error("It is not your turn.");
    }
  };

  const assertCurrentResponder = (session: Session, actorId: string) => {
    const responderId =
      session.activeResponderId ??
      session.buzzWinnerId ??
      (session.buzzOpen ? null : session.currentPlayerId);
    if (responderId !== actorId) {
      throw new Error("You do not currently have answer control.");
    }
  };

  const assertCanAdvanceTurn = (session: Session, actorId: string) => {
    if (session.gameState === "TURN_ACTIVE" && session.currentPlayerId === actorId) return;
    if (session.buzzOpen) {
      throw new Error("Buzz is still open. Wait for the buzzer window to finish.");
    }
    if (session.answerResult?.playerId === actorId) return;
    if (session.activeResponderId === actorId) return;
    throw new Error("You cannot advance the turn right now.");
  };

  const heartbeatId = setInterval(() => {
    io.emit("heartbeat", { timestamp: Date.now() });
  }, HEARTBEAT_INTERVAL_MS);

  const inactivitySweepId = setInterval(() => {
    void sweepInactiveRooms();
  }, INACTIVITY_SWEEP_INTERVAL_MS);

  io.on("connection", (socket) => {
    socket.data.clientId = `client-${Math.random().toString(36).slice(2, 10)}`;
    clearSocketSession(socket);

    socket.emit("connected", { clientId: socket.data.clientId });

    socket.on("resume_session", async (payload, ack) => {
      try {
        const normalized = normalizeSessionCode(payload.sessionCode);
        const session = await getExistingSession(normalized);
        if (!session || !payload.playerId || !payload.playerToken) {
          clearSocketSession(socket);
          socket.emit("session_expired", { sessionCode: normalized, reason: "invalid_resume" });
          ack(fail("Room is no longer available. Please rejoin."));
          return;
        }

        const auth = await getSessionAuth(normalized);
        if (auth[payload.playerId] !== payload.playerToken) {
          clearSocketSession(socket);
          socket.emit("session_expired", { sessionCode: normalized, reason: "invalid_resume" });
          ack(fail("Player token mismatch. Please rejoin."));
          return;
        }

        const playerExists = session.players.some((player) => player.id === payload.playerId);
        if (!playerExists) {
          clearSocketSession(socket);
          socket.emit("session_expired", { sessionCode: normalized, reason: "invalid_resume" });
          ack(fail("Player is no longer in this room."));
          return;
        }

        await joinRoom(socket, normalized, payload.playerId, payload.playerToken);
        socket.emit("session_snapshot", {
          session,
          view: getViewFromSession(session),
          timestamp: Date.now()
        });
        ack(ok());
      } catch (error: any) {
        ack(fail(error?.message || "resume_session failed"));
      }
    });

    socket.on("join_session", async (payload, ack) => {
      try {
        const result = await joinSession(payload);
        await joinRoom(socket, result.session.code, result.playerId, result.playerToken);
        await broadcastSession(result.session.code);
        ack(ok({ playerId: result.playerId, playerToken: result.playerToken }));
      } catch (error: any) {
        ack(fail(error?.message || "join_session failed"));
      }
    });

    socket.on("confirm_seat", async (payload, ack) => {
      try {
        const { actorId } = await getAuthorizedSession(socket, payload.sessionCode);
        const session = await confirmSeat({
          sessionCode: payload.sessionCode,
          playerId: actorId,
          playerName: payload.playerName
        });
        await broadcastSession(session.code);
        ack(ok());
      } catch (error: any) {
        ack(fail(error?.message || "confirm_seat failed"));
      }
    });

    socket.on("start_game", async (payload, ack) => {
      try {
        await getAuthorizedSession(socket, payload.sessionCode);
        const result = await startGame(payload.sessionCode);
        await broadcastSession(result.session.code);
        ack(result.error ? fail(result.error) : ok());
      } catch (error: any) {
        ack(fail(error?.message || "start_game failed"));
      }
    });

    socket.on("start_question", async (payload, ack) => {
      try {
        const { session, actorId } = await getAuthorizedSession(socket, payload.sessionCode);
        assertCurrentTurnOwner(session, actorId);
        if (session.gameState !== "TURN_ACTIVE") {
          throw new Error("Question cannot be started right now.");
        }
        const result = await startQuestion(payload.sessionCode);
        await broadcastSession(result.session.code);
        ack(result.error ? fail(result.error) : ok());
      } catch (error: any) {
        ack(fail(error?.message || "start_question failed"));
      }
    });

    socket.on("submit_answer", async (payload, ack) => {
      try {
        const { session, actorId } = await getAuthorizedSession(socket, payload.sessionCode);
        assertCurrentResponder(session, actorId);
        const result = await submitAnswer({
          sessionCode: payload.sessionCode,
          selectedIndices: payload.selectedIndices
        });
        await broadcastSession(result.session.code);
        ack(result.error ? fail(result.error) : ok());
      } catch (error: any) {
        ack(fail(error?.message || "submit_answer failed"));
      }
    });

    socket.on("buzz_in", async (payload, ack) => {
      try {
        const { session, actorId } = await getAuthorizedSession(socket, payload.sessionCode);
        if (session.gameState !== "QUESTION_ACTIVE" || !session.buzzOpen) {
          throw new Error("Buzz is not available right now.");
        }
        const result = await buzzIn({ sessionCode: payload.sessionCode, playerId: actorId });
        await broadcastSession(result.session.code);
        ack(result.error ? fail(result.error) : ok());
      } catch (error: any) {
        ack(fail(error?.message || "buzz_in failed"));
      }
    });

    socket.on("start_reflection", async (payload, ack) => {
      try {
        const { session, actorId } = await getAuthorizedSession(socket, payload.sessionCode);
        if (session.gameState !== "FINISHED") {
          throw new Error("Game is not finished yet.");
        }
        const result = await startReflection(payload.sessionCode, actorId);
        await broadcastSession(result.session.code);
        ack(result.error ? fail(result.error) : ok());
      } catch (error: any) {
        ack(fail(error?.message || "start_reflection failed"));
      }
    });

    socket.on("skip_reflection", async (payload, ack) => {
      try {
        const { session, actorId } = await getAuthorizedSession(socket, payload.sessionCode);
        if (session.gameState !== "FINISHED") {
          throw new Error("Game is not finished yet.");
        }
        const result = await skipReflection(payload.sessionCode, actorId);
        await broadcastSession(result.session.code);
        ack(result.error ? fail(result.error) : ok());
      } catch (error: any) {
        ack(fail(error?.message || "skip_reflection failed"));
      }
    });

    socket.on("submit_reflection", async (payload, ack) => {
      try {
        const { session, actorId } = await getAuthorizedSession(socket, payload.sessionCode);
        if (session.gameState !== "FINISHED") {
          throw new Error("Game is not finished yet.");
        }
        const result = await submitReflectionStats({
          sessionCode: payload.sessionCode,
          playerId: actorId,
          answers: payload.answers
        });
        await broadcastSession(result.session.code);
        ack(result.error ? fail(result.error) : ok());
      } catch (error: any) {
        ack(fail(error?.message || "submit_reflection failed"));
      }
    });

    socket.on("settle_reflection", async (payload, ack) => {
      try {
        const { session } = await getAuthorizedSession(socket, payload.sessionCode);
        if (session.gameState !== "FINISHED") {
          throw new Error("Game is not finished yet.");
        }
        const result = await settleReflection(payload.sessionCode);
        await broadcastSession(result.session.code);
        ack(result.error ? fail(result.error) : ok());
      } catch (error: any) {
        ack(fail(error?.message || "settle_reflection failed"));
      }
    });

    socket.on("vote_end", async (payload, ack) => {
      try {
        const { actorId } = await getAuthorizedSession(socket, payload.sessionCode);
        const result = await voteEndGame(payload.sessionCode, actorId);
        await broadcastSession(result.session.code);
        ack(
          result.error
            ? fail(result.error, { endVotes: result.endVotes, threshold: result.threshold })
            : ok({ endVotes: result.endVotes, threshold: result.threshold })
        );
      } catch (error: any) {
        ack(fail(error?.message || "vote_end failed"));
      }
    });

    socket.on("confirm_reflection_exit", async (payload, ack) => {
      try {
        const { actorId } = await getAuthorizedSession(socket, payload.sessionCode);
        const result = await confirmReflectionExit(payload.sessionCode, actorId);
        if (result.error) {
          ack(fail(result.error, { exitVotes: result.exitVotes, threshold: result.threshold }));
          return;
        }
        if (result.shouldDestroy) {
          await expireSession(payload.sessionCode, "finished_cleanup");
          ack(ok({ exitVotes: result.exitVotes, threshold: result.threshold, destroyed: true }));
          return;
        }
        await broadcastSession(result.session.code);
        ack(ok({ exitVotes: result.exitVotes, threshold: result.threshold, destroyed: false }));
      } catch (error: any) {
        ack(fail(error?.message || "confirm_reflection_exit failed"));
      }
    });

    socket.on("forfeit_question", async (payload, ack) => {
      try {
        const { session, actorId } = await getAuthorizedSession(socket, payload.sessionCode);
        assertCanAdvanceTurn(session, actorId);
        const result = await forfeitQuestion(payload.sessionCode);
        await broadcastSession(result.session.code);
        ack(ok());
      } catch (error: any) {
        ack(fail(error?.message || "forfeit_question failed"));
      }
    });

    socket.on("advance_turn", async (payload, ack) => {
      try {
        const { session, actorId } = await getAuthorizedSession(socket, payload.sessionCode);
        assertCanAdvanceTurn(session, actorId);
        const nextSession = await advanceTurn(payload.sessionCode);
        await broadcastSession(nextSession.code);
        ack(ok());
      } catch (error: any) {
        ack(fail(error?.message || "advance_turn failed"));
      }
    });

    socket.on("disconnect", async () => {
      await scheduleReflectionDisconnect(socket.data.sessionCode, socket.data.playerId);
      await pruneRoomIfEmpty(socket.data.sessionCode);
    });
  });

  io.engine.on("close", () => {
    clearInterval(heartbeatId);
    clearInterval(inactivitySweepId);
    roomCleanupTimers.forEach((timer) => clearTimeout(timer));
    roomCleanupTimers.clear();
    buzzExpiryTimers.forEach((timer) => clearTimeout(timer));
    buzzExpiryTimers.clear();
    reflectionDisconnectTimers.forEach((timer) => clearTimeout(timer));
    reflectionDisconnectTimers.clear();
  });

  return io;
};
