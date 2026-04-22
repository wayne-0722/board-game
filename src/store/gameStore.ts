"use client";

import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { io, type Socket } from "socket.io-client";
import type { Session } from "../server/mockSessionStore";
import type {
  ActionResult,
  ClientToServerEvents,
  ServerToClientEvents,
  SessionView
} from "../realtime/events";

type Player = {
  id: string;
  seatNumber: number;
  name: string;
  confirmed: boolean;
  chips: number;
};

type ConnectionState = "Connected" | "Connecting" | "Disconnected";
type AnswerResult = Session["answerResult"];
type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: ClientSocket | null = null;
let connectPromise: Promise<void> | null = null;

const memoryStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
};

const getStorage = () => (typeof window !== "undefined" ? localStorage : memoryStorage);

const getSocket = () => {
  if (socket) return socket;

  socket = io({
    path: "/socket.io",
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000
  });

  socket.on("connect", () => {
    useGameStore.getState().setConnectionStatus("Connected");
    const { sessionCode } = useGameStore.getState();
    if (sessionCode) {
      void useGameStore.getState().resumeSession();
    }
  });

  socket.on("disconnect", () => {
    useGameStore.getState().setConnectionStatus("Disconnected");
  });

  socket.on("connect_error", () => {
    useGameStore.getState().setConnectionStatus("Disconnected");
  });

  socket.io.on("reconnect_attempt", () => {
    useGameStore.getState().setConnectionStatus("Connecting");
  });

  socket.on("session_snapshot", (payload) => {
    useGameStore.getState().setFromSession(payload.session, payload.view);
  });

  socket.on("heartbeat", () => {
    if (useGameStore.getState().connectionStatus !== "Connected") {
      useGameStore.getState().setConnectionStatus("Connected");
    }
  });

  socket.on("session_expired", () => {
    useGameStore.getState().resetSession(
      "\u623f\u9593\u5df2\u5931\u6548\uff0c\u8acb\u91cd\u65b0\u8f38\u5165\u623f\u865f\u52a0\u5165\u3002"
    );
  });

  return socket;
};

const ensureSocketConnection = async () => {
  if (typeof window === "undefined") return;
  const instance = getSocket();

  if (instance.connected) {
    useGameStore.getState().setConnectionStatus("Connected");
    return;
  }
  if (connectPromise) {
    await connectPromise;
    return;
  }

  useGameStore.getState().setConnectionStatus("Connecting");
  connectPromise = new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      instance.off("connect", onConnect);
      instance.off("connect_error", onError);
      connectPromise = null;
    };

    const onConnect = () => {
      cleanup();
      resolve();
    };

    const onError = () => {
      cleanup();
      reject(new Error("Socket.IO connection failed"));
    };

    instance.once("connect", onConnect);
    instance.once("connect_error", onError);
    instance.connect();
  });

  await connectPromise;
};

const emitWithAck = async <T extends keyof ClientToServerEvents>(
  event: T,
  payload: Parameters<ClientToServerEvents[T]>[0],
  opts?: { suppressToast?: boolean }
) => {
  await ensureSocketConnection();
  const instance = getSocket();
  const result = await new Promise<ActionResult>((resolve, reject) => {
    const emitter = instance.timeout(10000) as any;
    emitter.emit(event, payload, (err: Error | null, response: ActionResult) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(response);
    });
  });

  if (!result.ok) {
    if (!opts?.suppressToast && result.error) {
      useGameStore.getState().showToast(result.error);
    }
    throw new Error(result.error || "Action failed");
  }
  return result;
};

type GameStore = {
  sessionCode: string;
  playerId: string;
  playerToken: string;
  playerName: string;
  seatNumber: number;
  players: Player[];
  currentPlayerId: string | null;
  connectionStatus: ConnectionState;
  currentView: SessionView;
  gameState: Session["gameState"];
  questionLock: boolean;
  turnIndex: number;
  usedQuestionIds: string[];
  wrongQuestionIds: string[];
  reflectionQuestionIds: string[];
  currentQuestion: Session["currentQuestion"];
  answerResult: AnswerResult;
  activeResponderId: string | null;
  buzzOpen: boolean;
  buzzReadyAt: number | null;
  buzzWinnerId: string | null;
  paidBuzzUsedIds: string[];
  reflectionStats: Record<string, { totalTime: number; correctCount: number }>;
  hasStartedReflection: boolean;
  hasDeclinedReflection: boolean;
  reflectionSettled: boolean;
  reflectionExitVotes: string[];
  reflectionExitThreshold: number;
  endVotes: string[];
  endThreshold: number;
  toast: string | null;
  setFromSession: (session: Session, view?: SessionView) => void;
  resetSession: (message?: string) => void;
  ensureRealtime: () => Promise<void>;
  disconnectRealtime: () => void;
  setSessionCode: (code: string) => void;
  setPlayerName: (name: string) => void;
  joinSession: (sessionCode: string, playerName?: string) => Promise<void>;
  resumeSession: () => Promise<void>;
  confirmSeat: () => Promise<void>;
  startGame: () => Promise<void>;
  startQuestion: () => Promise<Session["currentQuestion"] | null>;
  submitAnswer: (selectedIndices: number[]) => Promise<Session["answerResult"] | null>;
  buzzIn: () => Promise<void>;
  startReflection: () => Promise<void>;
  skipReflection: () => Promise<void>;
  submitReflection: (payload: { answers: Record<string, number[]>; totalTime?: number }) => Promise<void>;
  settleReflection: () => Promise<void>;
  confirmReflectionExit: () => Promise<void>;
  voteEndGame: () => Promise<void>;
  forfeitQuestion: () => Promise<void>;
  advanceTurn: (opts?: { showToast?: string }) => Promise<void>;
  setConnectionStatus: (state: ConnectionState) => void;
  showToast: (message: string) => void;
  clearToast: () => void;
};

const createSessionResetState = (message?: string) => ({
  sessionCode: "",
  playerId: "",
  playerToken: "",
  seatNumber: 1,
  players: [],
  currentPlayerId: null,
  currentView: "HOME" as SessionView,
  gameState: "LOBBY" as Session["gameState"],
  questionLock: false,
  turnIndex: 0,
  usedQuestionIds: [],
  wrongQuestionIds: [],
  reflectionQuestionIds: [],
  currentQuestion: null,
  answerResult: null as AnswerResult,
  activeResponderId: null,
  buzzOpen: false,
  buzzReadyAt: null,
  buzzWinnerId: null,
  paidBuzzUsedIds: [],
  reflectionStats: {},
  hasStartedReflection: false,
  hasDeclinedReflection: false,
  reflectionSettled: false,
  reflectionExitVotes: [],
  reflectionExitThreshold: 0,
  endVotes: [],
  endThreshold: 0,
  toast: message || null
});

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      ...createSessionResetState(),
      playerName: "",
      connectionStatus: "Disconnected",

      setFromSession: (session, view) =>
        set((state) => {
          const mySeat =
            session.players.find((player) => player.id === state.playerId)?.seatNumber ??
            state.seatNumber;

          return {
            players: session.players,
            currentPlayerId: session.currentPlayerId,
            currentView: view || state.currentView,
            gameState: session.gameState,
            questionLock: session.questionLock,
            turnIndex: session.turnIndex,
            usedQuestionIds: session.usedQuestionIds,
            wrongQuestionIds: session.wrongQuestionIds || [],
            reflectionQuestionIds: session.reflectionQuestionIds || [],
            currentQuestion: session.currentQuestion,
            answerResult: session.answerResult,
            activeResponderId: session.activeResponderId,
            buzzOpen: session.buzzOpen,
            buzzReadyAt: session.buzzReadyAt,
            buzzWinnerId: session.buzzWinnerId,
            paidBuzzUsedIds: session.paidBuzzUsedIds || [],
            reflectionStats: session.reflectionStats || {},
            hasStartedReflection: Boolean(
              state.playerId && session.reflectionStartTimes?.[state.playerId]
            ),
            hasDeclinedReflection: Boolean(
              state.playerId && session.reflectionDeclinedIds?.includes(state.playerId)
            ),
            reflectionSettled: Boolean(session.reflectionSettled),
            reflectionExitVotes: session.reflectionExitVotes || [],
            reflectionExitThreshold:
              session.players.filter(
                (player) =>
                  player.confirmed &&
                  !session.reflectionExcludedIds?.includes(player.id) &&
                  !session.reflectionDeclinedIds?.includes(player.id)
              ).length ||
              session.players.length ||
              1,
            endVotes: session.endVotes || [],
            endThreshold: session.endVoteThreshold || 0,
            seatNumber: mySeat
          };
        }),

      resetSession: (message) =>
        set((state) => ({
          ...createSessionResetState(message),
          playerName: state.playerName
        })),

      ensureRealtime: async () => {
        await ensureSocketConnection();
      },

      disconnectRealtime: () => {
        if (socket) {
          socket.disconnect();
        }
      },

      setSessionCode: (code) => set({ sessionCode: code }),

      setPlayerName: (name) =>
        set((state) => ({
          playerName: name,
          players: state.players.map((player) =>
            player.id === state.playerId ? { ...player, name: name || player.name } : player
          )
        })),

      joinSession: async (sessionCode, playerName) => {
        const result = await emitWithAck(
          "join_session",
          {
            sessionCode,
            playerName: playerName || get().playerName,
            playerId: get().playerId || undefined,
            playerToken: get().playerToken || undefined
          },
          { suppressToast: true }
        );

        set({
          sessionCode,
          playerId: String(result.data?.playerId || get().playerId || ""),
          playerToken: String(result.data?.playerToken || get().playerToken || ""),
          playerName: playerName || get().playerName || "\u73a9\u5bb6"
        });
      },

      resumeSession: async () => {
        const { sessionCode, playerId, playerToken } = get();
        if (!sessionCode) return;
        try {
          await emitWithAck(
            "resume_session",
            {
              sessionCode,
              playerId: playerId || undefined,
              playerToken: playerToken || undefined
            },
            { suppressToast: true }
          );
        } catch (error: any) {
          get().resetSession(
            error?.message ||
              "\u623f\u9593\u5df2\u5931\u6548\uff0c\u8acb\u91cd\u65b0\u8f38\u5165\u623f\u865f\u52a0\u5165\u3002"
          );
        }
      },

      confirmSeat: async () => {
        const { sessionCode, playerId, playerName } = get();
        if (!sessionCode || !playerId) {
          get().showToast(
            "\u8acb\u5148\u8f38\u5165\u623f\u865f\u4e26\u52a0\u5165\u623f\u9593\u3002"
          );
          return;
        }
        await emitWithAck("confirm_seat", { sessionCode, playerId, playerName });
      },

      startGame: async () => {
        const { sessionCode } = get();
        if (!sessionCode) return;
        await emitWithAck("start_game", { sessionCode });
      },

      startQuestion: async () => {
        const { sessionCode } = get();
        if (!sessionCode) return null;
        await emitWithAck("start_question", { sessionCode });
        return get().currentQuestion;
      },

      submitAnswer: async (selectedIndices) => {
        const { sessionCode } = get();
        if (!sessionCode) return null;
        await emitWithAck("submit_answer", { sessionCode, selectedIndices });
        return get().answerResult;
      },

      buzzIn: async () => {
        const { sessionCode, playerId } = get();
        if (!sessionCode || !playerId) return;
        await emitWithAck("buzz_in", { sessionCode, playerId });
      },

      startReflection: async () => {
        const { sessionCode, playerId } = get();
        if (!sessionCode || !playerId) return;
        await emitWithAck("start_reflection", { sessionCode, playerId });
      },

      skipReflection: async () => {
        const { sessionCode, playerId } = get();
        if (!sessionCode || !playerId) return;
        await emitWithAck("skip_reflection", { sessionCode, playerId });
      },

      submitReflection: async ({ answers, totalTime }) => {
        const { sessionCode, playerId } = get();
        if (!sessionCode || !playerId) return;
        await emitWithAck("submit_reflection", { sessionCode, playerId, answers, totalTime });
        get().showToast("\u53cd\u601d\u4f5c\u7b54\u5df2\u9001\u51fa\u3002");
      },

      settleReflection: async () => {
        const { sessionCode } = get();
        if (!sessionCode) return;
        await emitWithAck("settle_reflection", { sessionCode });
        get().showToast("\u53cd\u601d\u6392\u540d\u5df2\u7d50\u7b97\u3002");
      },

      confirmReflectionExit: async () => {
        const { sessionCode, playerId, reflectionExitThreshold } = get();
        if (!sessionCode || !playerId) return;
        const result = await emitWithAck("confirm_reflection_exit", { sessionCode, playerId });
        const currentVotes = Number(
          result.data?.exitVotes?.length || get().reflectionExitVotes.length
        );
        if (!result.data?.destroyed) {
          get().showToast(
            `\u5df2\u78ba\u8a8d\u96e2\u958b\u53cd\u601d\u9801\uff08${currentVotes}/${reflectionExitThreshold}\uff09`
          );
        }
      },

      voteEndGame: async () => {
        const { sessionCode, playerId, endThreshold } = get();
        if (!sessionCode || !playerId) return;
        const result = await emitWithAck("vote_end", { sessionCode, playerId });
        const currentVotes = Number(result.data?.endVotes?.length || get().endVotes.length);
        if (get().gameState === "FINISHED") {
          get().showToast(
            "\u904a\u6232\u5df2\u7d50\u675f\uff0c\u53ef\u4ee5\u9032\u5165\u53cd\u601d\u7d50\u7b97\u3002"
          );
        } else {
          get().showToast(
            `\u5df2\u9001\u51fa\u7d50\u675f\u6295\u7968\uff08${currentVotes}/${endThreshold}\uff09`
          );
        }
      },

      forfeitQuestion: async () => {
        const { sessionCode } = get();
        if (!sessionCode) return;
        await emitWithAck("forfeit_question", { sessionCode });
      },

      advanceTurn: async (opts) => {
        const { sessionCode } = get();
        if (!sessionCode) return;
        await emitWithAck("advance_turn", { sessionCode });
        if (opts?.showToast) {
          get().showToast(opts.showToast);
        }
      },

      setConnectionStatus: (state) => {
        if (get().connectionStatus !== state) {
          set({ connectionStatus: state });
        }
      },

      showToast: (message) => set({ toast: message }),

      clearToast: () => set({ toast: null })
    }),
    {
      name: "board-game-answer-system",
      storage: createJSONStorage(getStorage),
      partialize: (state) => ({
        sessionCode: state.sessionCode,
        playerId: state.playerId,
        playerToken: state.playerToken,
        playerName: state.playerName,
        seatNumber: state.seatNumber
      })
    }
  )
);
