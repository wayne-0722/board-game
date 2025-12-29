"use client";

import { useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../../components/ui/Button";
import { Toast } from "../../components/Toast";
import { useGameStore } from "../../src/store/gameStore";

export default function PlayPage() {
  const router = useRouter();
  const players = useGameStore((s) => s.players);
  const playerId = useGameStore((s) => s.playerId);
  const currentPlayerId = useGameStore((s) => s.currentPlayerId);
  const connectionStatus = useGameStore((s) => s.connectionStatus);
  const startQuestion = useGameStore((s) => s.startQuestion);
  const advanceTurn = useGameStore((s) => s.advanceTurn);
  const questionLock = useGameStore((s) => s.questionLock);
  const currentQuestion = useGameStore((s) => s.currentQuestion);
  const sessionCode = useGameStore((s) => s.sessionCode);
  const refreshSession = useGameStore((s) => s.refreshSession);
  const joinSession = useGameStore((s) => s.joinSession);
  const gameState = useGameStore((s) => s.gameState);
  const wrongQuestionIds = useGameStore((s) => s.wrongQuestionIds);

  useEffect(() => {
    if (!sessionCode) {
      router.replace("/");
      return;
    }
    const sync = async () => {
      await refreshSession(sessionCode);
      const state = useGameStore.getState();
      const exists = state.players.some((p) => p.id === state.playerId);
      if (!exists) {
        await joinSession(sessionCode, state.playerName);
      }
    };
    sync();
    const id = setInterval(sync, 2000);
    return () => clearInterval(id);
  }, [sessionCode, refreshSession, joinSession, router]);

  const currentPlayer = useMemo(
    () => players.find((p) => p.id === currentPlayerId),
    [players, currentPlayerId]
  );

  const isMyTurn = playerId === currentPlayerId;
  const canAct = gameState === "TURN_ACTIVE" && isMyTurn;

  const handleQuestionTile = async () => {
    const q = await startQuestion();
    if (q) {
      router.push("/question");
    }
  };

  const handleNoQuestion = async () => {
    await advanceTurn({ showToast: "請把權杖交給下一位" });
  };

  return (
    <main className="pt-8 space-y-6">
      <Toast />
      <header className="card p-5 space-y-3 sticky top-0 z-20">
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-500">現在輪到</div>
          <div
            className={`rounded-full px-3 py-1 text-sm font-semibold ${
              connectionStatus === "Connected"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {connectionStatus}
          </div>
        </div>
        <div className="text-3xl font-bold">
          {currentPlayer?.name ?? "等待加入"}（P{currentPlayer?.seatNumber ?? "?"}）
        </div>
      </header>

      {gameState === "FINISHED" ? (
        <section className="card p-6 space-y-4">
          <div className="text-xl font-semibold text-slate-800">
            題庫已用完，是否進入反思？
          </div>
          <div className="text-slate-600">
            反思將使用你們答錯的題目（{wrongQuestionIds.length} 題）。
          </div>
          <Button onClick={() => router.push("/reflect")} className="h-14 text-xl">
            前往反思
          </Button>
          <Button
            variant="secondary"
            onClick={() => router.push("/")}
            className="h-14 text-xl"
          >
            回到主頁
          </Button>
        </section>
      ) : gameState !== "TURN_ACTIVE" ? (
        <section className="card p-6 space-y-4">
          <div className="text-xl font-semibold text-slate-800">
            等待遊戲開始或重新同步。
          </div>
          <p className="text-slate-600">
            確認等待室至少 2 人座位已確認，並請主持人按開始遊戲。
          </p>
        </section>
      ) : !isMyTurn ? (
        <section className="card p-6 space-y-4">
          <div className="text-xl font-semibold text-slate-800">
            現在不是你的回合，請等待。
          </div>
          <p className="text-slate-600">
            手機先放旁邊，等到你的座位號出現在上方時再操作。
          </p>
        </section>
      ) : questionLock && currentQuestion ? (
        <section className="card p-6 space-y-4">
          <div className="text-xl font-semibold text-brand-accent">
            題目尚未完成，請先作答或送出結果。
          </div>
          <Button
            onClick={() => router.push("/question")}
            className="h-14 text-xl"
          >
            回到題目 / Continue Question
          </Button>
        </section>
      ) : (
        <section className="space-y-4">
          <div className="text-lg font-semibold text-brand-accent">
            換你了！請先確認是否踩到答題格
          </div>
          <Button
            onClick={handleQuestionTile}
            className="h-16 text-xl shadow-card"
            disabled={!canAct}
          >
            我踩到答題格 I stepped on Question Tile
          </Button>
          <Button
            variant="secondary"
            onClick={handleNoQuestion}
            className="h-16 text-xl"
            disabled={!canAct}
          >
            我沒有踩到 No Question Tile
          </Button>
        </section>
      )}
    </main>
  );
}
