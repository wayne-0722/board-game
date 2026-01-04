"use client";

import { useMemo, useEffect, useState } from "react";
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
  const reflectionQuestionIds = useGameStore((s) => s.reflectionQuestionIds);
  const activeResponderId = useGameStore((s) => s.activeResponderId);
  const answerResult = useGameStore((s) => s.answerResult);
  const buzzOpen = useGameStore((s) => s.buzzOpen);
  const buzzReadyAt = useGameStore((s) => s.buzzReadyAt);
  const buzzWinnerId = useGameStore((s) => s.buzzWinnerId);
  const paidBuzzUsedIds = useGameStore((s) => s.paidBuzzUsedIds);
  const buzzIn = useGameStore((s) => s.buzzIn);
  const endVotes = useGameStore((s) => s.endVotes);
  const voteEndGame = useGameStore((s) => s.voteEndGame);

  const [buzzCountdown, setBuzzCountdown] = useState(0);
  const [buzzing, setBuzzing] = useState(false);

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
    if (gameState === "FINISHED") {
      router.replace("/reflect");
    }
  }, [gameState, router]);

  useEffect(() => {
    const tick = () => {
      if (!buzzReadyAt) {
        setBuzzCountdown(0);
        return;
      }
      const ms = buzzReadyAt - Date.now();
      setBuzzCountdown(ms > 0 ? Math.ceil(ms / 1000) : 0);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [buzzReadyAt]);

  const currentPlayer = useMemo(
    () => players.find((p) => p.id === currentPlayerId),
    [players, currentPlayerId]
  );

  const responder = useMemo(
    () => players.find((p) => p.id === activeResponderId) || null,
    [players, activeResponderId]
  );
  const lastAnswerer = useMemo(
    () => (answerResult?.playerId ? players.find((p) => p.id === answerResult.playerId) : null),
    [players, answerResult]
  );
  const stake = useMemo(() => (currentQuestion as any)?.stake ?? 100000, [currentQuestion]);

  const isTurnOwner = playerId === currentPlayerId;
  const isResponder = Boolean(playerId && activeResponderId && playerId === activeResponderId);
  const canAct = gameState === "TURN_ACTIVE" && isTurnOwner;
  const buzzReady = buzzOpen && buzzReadyAt !== null && buzzCountdown > 0 && !buzzWinnerId;
  const myChips = players.find((p) => p.id === playerId)?.chips ?? 0;
  const confirmedCount = players.filter((p) => p.confirmed).length;
  const endThreshold = Math.ceil(Math.max(1, confirmedCount > 0 ? confirmedCount : players.length) / 2);
  const hasPaidBuzzed = Boolean(playerId && paidBuzzUsedIds?.includes(playerId));
  const hasEndVoted = Boolean(playerId && endVotes?.includes(playerId));
  const endVotesCount = endVotes?.length ?? 0;
  const formatChips = (value: number) => `${(value / 10000).toLocaleString()} 萬`;
  const reflectionCount =
    reflectionQuestionIds.length > 0 ? reflectionQuestionIds.length : wrongQuestionIds.length;

  const handleQuestionTile = async () => {
    const q = await startQuestion();
    if (q) {
      router.push("/question");
    }
  };

  const handleNoQuestion = async () => {
    await advanceTurn({ showToast: "請把回合交給下一位" });
  };

  return (
    <main className="pt-8 space-y-6">
      <Toast />
      {gameState !== "FINISHED" && (
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
          <div className="text-sm text-slate-600">題目籌碼：{formatChips(stake)}</div>
          <div className="text-sm text-slate-600">我的籌碼：{formatChips(myChips)}</div>
        </header>
      )}

      {gameState === "FINISHED" ? (
        <section className="card p-6 space-y-4">
          <div className="text-xl font-semibold text-slate-800">
            遊戲已結束，是否進入反思結算？
          </div>
          <div className="text-slate-600">
            完成反思可依總回答時間與答對量排名發放籌碼（50 萬 / 25 萬 / 10 萬）。目前累積錯題{" "}
            {reflectionCount} 題。
          </div>
          <Button onClick={() => router.push("/reflect")} className="h-14 text-xl">
            前往反思並領取獎勵
          </Button>
          <Button
            variant="secondary"
            onClick={() => router.push("/reflect?skip=1")}
            className="h-14 text-xl"
          >
            不參加，直接結算
          </Button>
        </section>
      ) : gameState === "QUESTION_ACTIVE" && currentQuestion ? (
        <section className="card p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-xs inline-flex items-center rounded-full bg-brand-secondary/40 text-brand-accent px-3 py-1 font-semibold">
              {currentQuestion.category}
            </div>
            <div className="text-sm text-slate-600">
              回合玩家：{currentPlayer?.name ?? "等待加入"}（P{currentPlayer?.seatNumber ?? "?"}）
            </div>
          </div>
          <h2 className="text-2xl font-bold leading-9">{currentQuestion.text}</h2>
          <div className="text-sm text-slate-600">
            題目籌碼：{formatChips(stake)}，付費搶答會先扣題目籌碼，搶答答對由原回答者支付 1 倍，搶答答錯再扣 1 倍。
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <div className="font-semibold text-brand-accent">答題者</div>
            <div className="rounded-full bg-slate-100 px-3 py-1 font-semibold">
              {responder
                ? `P${responder.seatNumber} ${responder.name}`
                : "等待搶答 / 回合玩家"}
            </div>
            {answerResult?.isCorrect && (
              <div className="rounded-full bg-emerald-100 text-emerald-700 px-3 py-1 text-xs font-semibold">
                已答對
              </div>
            )}
          </div>

          {answerResult && !answerResult.isCorrect && (
            <div className="space-y-2 rounded-xl border border-rose-200 bg-rose-50 p-4">
              <div className="font-semibold text-rose-700">
                {lastAnswerer ? `P${lastAnswerer.seatNumber} ${lastAnswerer.name}` : "玩家"} 回答錯誤
              </div>
              {buzzOpen ? (
                <>
                  <div className="text-sm text-slate-700">
                    {buzzCountdown > 0
                      ? `倒數 ${buzzCountdown} 秒內按下付費搶答（每人一次）`
                      : "時間到，已關閉本題搶答"}
                  </div>
                  {lastAnswerer?.id === playerId ? (
                    <div className="text-sm text-slate-500">
                      你剛剛答錯，這題付費搶答輪到其他人。
                    </div>
                  ) : hasPaidBuzzed ? (
                    <div className="text-sm text-slate-500">
                      你已用過付費搶答（每局一次）。
                    </div>
                  ) : (
                    <Button
                      variant="secondary"
                      onClick={async () => {
                        setBuzzing(true);
                        await buzzIn();
                        setBuzzing(false);
                      }}
                      disabled={!buzzReady || !!buzzWinnerId || buzzing || hasPaidBuzzed}
                      className="h-12"
                    >
                      {buzzCountdown > 0 ? `搶答 (${buzzCountdown}s)` : "搶答已結束"}
                    </Button>
                  )}
                </>
              ) : buzzWinnerId ? (
                <div className="text-sm text-emerald-700">
                  {responder ? `P${responder.seatNumber} ${responder.name}` : "玩家"} 已付費搶答，等待作答。
                </div>
              ) : (
                <div className="text-sm text-slate-700">等待下一步</div>
              )}
            </div>
          )}

          {answerResult?.isCorrect && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
              {lastAnswerer
                ? `P${lastAnswerer.seatNumber} ${lastAnswerer.name}`
                : "玩家"}{" "}
              已答對，請在題目頁面結束本回合。
            </div>
          )}

          <Button onClick={() => router.push("/question")} className="h-14 text-xl">
            {isResponder ? "繼續作答 / 前往詳情" : "前往題目"}
          </Button>
        </section>
      ) : gameState !== "TURN_ACTIVE" ? (
        <section className="card p-6 space-y-4">
          <div className="text-xl font-semibold text-slate-800">等待遊戲開始或重新同步。</div>
          <p className="text-slate-600">
            確認等待室至少 2 人座位已確認，並請主持人按開始遊戲。
          </p>
        </section>
      ) : !isTurnOwner ? (
        <section className="card p-6 space-y-4">
          <div className="text-xl font-semibold text-slate-800">現在不是你的回合，請等待。</div>
          <p className="text-slate-600">
            請在自己的座位提示出現後再操作。
          </p>
        </section>
      ) : questionLock && currentQuestion ? (
        <section className="card p-6 space-y-4">
          <div className="text-xl font-semibold text-brand-accent">
            題目尚未完成，請先在題目頁面完成。
          </div>
          <Button onClick={() => router.push("/question")} className="h-14 text-xl">
            前往題目 / Continue Question
          </Button>
        </section>
      ) : (
        <section className="space-y-4">
          <div className="text-lg font-semibold text-brand-accent">換你了！請先確認是否踩到答題格</div>
          <Button
            onClick={handleQuestionTile}
            className="h-16 text-xl shadow-card"
            disabled={!canAct}
          >
            有踩到題目格 I stepped on Question Tile
          </Button>
          <Button
            variant="secondary"
            onClick={handleNoQuestion}
            className="h-16 text-xl"
            disabled={!canAct}
          >
            沒有踩到 No Question Tile
          </Button>
        </section>
      )}

      <section className="card p-4 flex items-center justify-between gap-3">
        <div className="space-y-1 text-sm text-slate-700">
          <div className="font-semibold text-slate-900">結束遊戲投票</div>
          <div>達成半數同意即可結束（{endVotesCount}/{endThreshold}）</div>
        </div>
        <Button
          variant={hasEndVoted ? "secondary" : "primary"}
          onClick={() => voteEndGame()}
          disabled={gameState === "FINISHED"}
        >
          {gameState === "FINISHED" ? "已結束" : hasEndVoted ? "已投票" : "同意結束遊戲"}
        </Button>
      </section>
    </main>
  );
}
