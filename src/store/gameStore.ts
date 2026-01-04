"use client";

import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";
import type { Session } from "../server/mockSessionStore";
import { api } from "../services/api";

type Player = {
  id: string;
  seatNumber: number;
  name: string;
  confirmed: boolean;
  chips: number;
};

type GameState = Session["gameState"];
type ConnectionState = "Connected" | "Disconnected";
type AnswerResult = Session["answerResult"];

type GameStore = {
  sessionCode: string;
  playerId: string;
  playerName: string;
  seatNumber: number;
  players: Player[];
  currentPlayerId: string | null;
  connectionStatus: ConnectionState;
  gameState: GameState;
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
  reflectionSettled: boolean;
  endVotes: string[];
  endThreshold: number;
  toast: string | null;
  setFromSession: (session: Session) => void;
  setSessionCode: (code: string) => void;
  setPlayerName: (name: string) => void;
  joinSession: (sessionCode: string, playerName?: string) => Promise<void>;
  refreshSession: (sessionCode?: string) => Promise<void>;
  confirmSeat: () => Promise<void>;
  startGame: () => Promise<void>;
  startQuestion: () => Promise<Session["currentQuestion"] | null>;
  submitAnswer: (selectedIndices: number[]) => Promise<Session["answerResult"] | null>;
  buzzIn: () => Promise<void>;
  startReflection: () => Promise<void>;
  submitReflection: (payload: { answers: Record<string, number[]>; totalTime?: number }) => Promise<void>;
  settleReflection: () => Promise<void>;
  voteEndGame: () => Promise<void>;
  forfeitQuestion: () => Promise<void>;
  advanceTurn: (opts?: { showToast?: string }) => Promise<void>;
  setConnectionStatus: (state: ConnectionState) => void;
  showToast: (message: string) => void;
  clearToast: () => void;
};

const memoryStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
};

const getStorage = () =>
  typeof window !== "undefined" ? localStorage : memoryStorage;

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      sessionCode: "",
      playerId: "",
      playerName: "",
      seatNumber: 1,
      players: [],
      currentPlayerId: null,
      connectionStatus: "Connected",
      gameState: "LOBBY",
      questionLock: false,
      turnIndex: 0,
      usedQuestionIds: [],
      wrongQuestionIds: [],
      reflectionQuestionIds: [],
      currentQuestion: null,
      answerResult: null,
      activeResponderId: null,
      buzzOpen: false,
      buzzReadyAt: null,
      buzzWinnerId: null,
      paidBuzzUsedIds: [],
      reflectionStats: {},
      reflectionSettled: false,
      endVotes: [],
      endThreshold: 0,
      toast: null,

      setFromSession: (session) =>
        set(() => {
          const confirmedCount = session.players.filter((p) => p.confirmed).length;
          const thresholdBase =
            confirmedCount > 0 ? confirmedCount : Math.max(1, session.players.length);
          return {
            players: session.players,
            currentPlayerId: session.currentPlayerId,
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
            reflectionSettled: Boolean(session.reflectionSettled),
            endVotes: session.endVotes || [],
            endThreshold: Math.ceil(thresholdBase / 2)
          };
        }),

      setSessionCode: (code) => set({ sessionCode: code }),

      setPlayerName: (name) =>
        set((state) => ({
          playerName: name,
          players: state.players.map((p) =>
            p.id === state.playerId ? { ...p, name: name || p.name } : p
          )
        })),

      joinSession: async (sessionCode, playerName) => {
        const res = await api.joinSession(
          sessionCode,
          playerName || get().playerName,
          get().playerId || undefined
        );
        set({
          sessionCode,
          playerId: res.playerId,
          playerName: playerName || get().playerName || "玩家",
          seatNumber:
            res.session.players.find((p) => p.id === res.playerId)?.seatNumber ??
            get().seatNumber
        });
        get().setFromSession(res.session);
      },

      refreshSession: async (sessionCode) => {
        const code = sessionCode || get().sessionCode;
        if (!code) return;
        const res = await api.getState(code);
        get().setFromSession(res.session);
      },

      confirmSeat: async () => {
        const { sessionCode, playerId, playerName } = get();
        if (!sessionCode) {
          get().showToast("請先輸入遊戲碼");
          return;
        }
        if (!playerId) {
          const name = playerName || "玩家";
          const resJoin = await api.joinSession(sessionCode, name, undefined);
          set({ playerId: resJoin.playerId, playerName: name });
          get().setFromSession(resJoin.session);
        }
        const id = get().playerId;
        if (!id) {
          get().showToast("尚未取得座位，請稍候");
          return;
        }
        const res = await api.confirmSeat(sessionCode, id, get().playerName);
        get().setFromSession(res.session);
      },

      startGame: async () => {
        const { sessionCode } = get();
        if (!sessionCode) return;
        const res = await api.startGame(sessionCode);
        get().setFromSession(res.session);
      },

      startQuestion: async () => {
        const { sessionCode } = get();
        if (!sessionCode) return null;
        try {
          const res = await api.startQuestion(sessionCode);
          get().setFromSession(res.session);
          return res.session.currentQuestion;
        } catch (err: any) {
          get().showToast(err.message || "題目取得失敗");
          return null;
        }
      },

      submitAnswer: async (selectedIndices) => {
        const { sessionCode } = get();
        if (!sessionCode) return null;
        try {
          const res = await api.submitAnswer(sessionCode, selectedIndices);
          get().setFromSession(res.session);
          return res.session.answerResult;
        } catch (err: any) {
          get().showToast(err.message || "送出失敗，請稍後再試");
          await get().refreshSession(sessionCode);
          return null;
        }
      },

      buzzIn: async () => {
        const { sessionCode, playerId } = get();
        if (!sessionCode || !playerId) return;
        try {
          const res = await api.buzzIn(sessionCode, playerId);
          get().setFromSession(res.session);
        } catch (err: any) {
          get().showToast(err.message || "搶答失敗，請稍後再試");
          await get().refreshSession(sessionCode);
        }
      },

      startReflection: async () => {
        const { sessionCode, playerId } = get();
        if (!sessionCode || !playerId) return;
        try {
          const res = await api.startReflection(sessionCode, playerId);
          get().setFromSession(res.session);
        } catch (err: any) {
          get().showToast(err.message || "反思開始失敗");
          await get().refreshSession(sessionCode);
        }
      },

      submitReflection: async ({ answers, totalTime }) => {
        const { sessionCode, playerId } = get();
        if (!sessionCode || !playerId) return;
        try {
          const res = await api.submitReflection(sessionCode, playerId, answers, totalTime);
          get().setFromSession(res.session);
          get().showToast("已送出反思答案");
        } catch (err: any) {
          get().showToast(err.message || "送出反思失敗");
          await get().refreshSession(sessionCode);
        }
      },

      settleReflection: async () => {
        const { sessionCode } = get();
        if (!sessionCode) return;
        try {
          const res = await api.settleReflection(sessionCode);
          get().setFromSession(res.session);
          get().showToast("已派發獎勵");
        } catch (err: any) {
          get().showToast(err.message || "派發失敗，請稍後再試");
          await get().refreshSession(sessionCode);
        }
      },

      voteEndGame: async () => {
        const { sessionCode, playerId } = get();
        if (!sessionCode || !playerId) return;
        try {
          const res = await api.voteEnd(sessionCode, playerId);
          get().setFromSession(res.session);
          const passed = res.session.gameState === "FINISHED";
          get().showToast(
            passed
              ? "已達成結束門檻，將進入反思"
              : `已送出結束投票 (${res.endVotes.length}/${res.threshold})`
          );
        } catch (err: any) {
          get().showToast(err.message || "結束投票失敗");
          await get().refreshSession(sessionCode);
        }
      },

      forfeitQuestion: async () => {
        const { sessionCode } = get();
        if (!sessionCode) return;
        try {
          const res = await api.forfeitQuestion(sessionCode);
          get().setFromSession(res.session);
        } catch (err: any) {
          get().showToast(err.message || "放棄題目失敗");
          await get().refreshSession(sessionCode);
        }
      },

      advanceTurn: async (opts) => {
        const { sessionCode } = get();
        if (!sessionCode) return;
        try {
          const res = await api.advanceTurn(sessionCode);
          get().setFromSession(res.session);
          if (opts?.showToast) {
            get().showToast(opts.showToast);
          }
        } catch (err: any) {
          get().showToast(err.message || "換人失敗，請稍後再試");
          await get().refreshSession(sessionCode);
        }
      },

      setConnectionStatus: (state) => set({ connectionStatus: state }),

      showToast: (message) => set({ toast: message }),

      clearToast: () => set({ toast: null })
    }),
    {
      name: "board-turn-mock",
      storage: createJSONStorage(getStorage)
    }
  )
);
