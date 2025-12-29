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
};

type GameState = Session["gameState"];
type ConnectionState = "Connected" | "Disconnected";

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
  currentQuestion: Session["currentQuestion"];
  answerResult: Session["answerResult"];
  toast: string | null;
  setFromSession: (session: Session) => void;
  setSessionCode: (code: string) => void;
  setPlayerName: (name: string) => void;
  joinSession: (sessionCode: string, playerName?: string) => Promise<void>;
  refreshSession: (sessionCode?: string) => Promise<void>;
  confirmSeat: () => Promise<void>;
  startGame: () => Promise<void>;
  startQuestion: () => Promise<Session["currentQuestion"] | null>;
  submitAnswer: (selectedIndex: number) => Promise<Session["answerResult"] | null>;
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
      currentQuestion: null,
      answerResult: null,
      toast: null,

      setFromSession: (session) =>
        set(() => ({
          players: session.players,
          currentPlayerId: session.currentPlayerId,
          gameState: session.gameState,
          questionLock: session.questionLock,
          turnIndex: session.turnIndex,
          usedQuestionIds: session.usedQuestionIds,
          wrongQuestionIds: session.wrongQuestionIds || [],
          currentQuestion: session.currentQuestion,
          answerResult: session.answerResult
        })),

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
          get().showToast("請先輸入局碼加入");
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
          get().showToast("尚未取得座位，請重試");
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

      submitAnswer: async (selectedIndex) => {
        const { sessionCode } = get();
        if (!sessionCode) return null;
        try {
          const res = await api.submitAnswer(sessionCode, selectedIndex);
          get().setFromSession(res.session);
          return res.session.answerResult;
        } catch (err: any) {
          get().showToast(err.message || "送出失敗，請稍後再試");
          await get().refreshSession(sessionCode);
          return null;
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
          get().showToast(err.message || "回合結束失敗，請重試");
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
