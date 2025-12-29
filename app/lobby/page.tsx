"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../../components/ui/Button";
import { Toast } from "../../components/Toast";
import { useGameStore } from "../../src/store/gameStore";

export default function LobbyPage() {
  const router = useRouter();
  const sessionCode = useGameStore((s) => s.sessionCode);
  const playerName = useGameStore((s) => s.playerName);
  const players = useGameStore((s) => s.players);
  const playerId = useGameStore((s) => s.playerId);
  const currentPlayerId = useGameStore((s) => s.currentPlayerId);
  const gameState = useGameStore((s) => s.gameState);
  const setPlayerName = useGameStore((s) => s.setPlayerName);
  const confirmSeat = useGameStore((s) => s.confirmSeat);
  const startGame = useGameStore((s) => s.startGame);
  const refreshSession = useGameStore((s) => s.refreshSession);
  const joinSession = useGameStore((s) => s.joinSession);
  const showToast = useGameStore((s) => s.showToast);

  const [nameInput, setNameInput] = useState(playerName);

  useEffect(() => {
    setNameInput(playerName);
  }, [playerName]);

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

  useEffect(() => {
    if (gameState !== "LOBBY") {
      router.replace("/play");
    }
  }, [gameState, router]);

  const confirmedCount = useMemo(
    () => players.filter((p) => p.confirmed).length,
    [players]
  );

  const mySeat = players.find((p) => p.id === playerId);
  const currentPlayer = players.find((p) => p.id === currentPlayerId);
  const playerReady = !!playerId && players.some((p) => p.id === playerId);

  const handleConfirm = async () => {
    setPlayerName(nameInput.trim());
    await confirmSeat();
    showToast("座位已確認");
  };

  const handleStart = async () => {
    if (confirmedCount < 2) {
      showToast("請至少 2 人確認座位");
      return;
    }
    await startGame();
    router.push("/play");
  };

  return (
    <main className="pt-8 space-y-5">
      <Toast />
      <div className="text-xs font-semibold uppercase text-brand-accent tracking-wide">
        等待室 Lobby
      </div>
      <h1 className="text-2xl font-bold">本局資訊</h1>

      <section className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-slate-500">本局代碼</div>
            <div className="text-2xl font-bold tracking-[0.2em]">
              {sessionCode || "------"}
            </div>
          </div>
          <div className="bg-brand-secondary/20 text-brand-accent text-sm px-3 py-2 rounded-xl">
            現在輪到：{currentPlayer?.name ?? "待定"}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-brand-primary/10">
            <div className="text-sm text-slate-600">我的座位</div>
            <div className="text-3xl font-bold">
              P{mySeat?.seatNumber ?? "-"}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-brand-secondary/20">
            <div className="text-sm text-slate-600">我的名字</div>
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
              placeholder="可選填"
            />
          </div>
        </div>

        <div className="space-y-3">
          <Button onClick={handleConfirm} disabled={!playerReady}>
            {playerReady ? "確認準備" : "正在加入座位..."}
          </Button>
          <Button
            variant="secondary"
            onClick={handleStart}
            disabled={confirmedCount < 2}
          >
            開始遊戲（需 2 人確認）
          </Button>
        </div>
      </section>

      <section className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-semibold text-lg">目前玩家</div>
          <div className="text-sm text-slate-500">
            已確認 {confirmedCount} 人
          </div>
        </div>
        <div className="space-y-2">
          {players.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 bg-white"
            >
              <div>
                <div className="text-sm text-slate-500">P{p.seatNumber}</div>
                <div className="text-lg font-semibold">{p.name}</div>
              </div>
              <div
                className={`text-sm font-semibold px-3 py-1 rounded-full ${
                  p.confirmed
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {p.confirmed ? "已確認" : "未確認"}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
