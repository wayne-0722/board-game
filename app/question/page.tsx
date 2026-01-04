"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../../components/ui/Button";
import { Toast } from "../../components/Toast";
import { useGameStore } from "../../src/store/gameStore";

export default function QuestionPage() {
  const router = useRouter();
  const question = useGameStore((s) => s.currentQuestion);
  const answerResult = useGameStore((s) => s.answerResult);
  const submitAnswer = useGameStore((s) => s.submitAnswer);
  const advanceTurn = useGameStore((s) => s.advanceTurn);
  const showToast = useGameStore((s) => s.showToast);
  const sessionCode = useGameStore((s) => s.sessionCode);
  const refreshSession = useGameStore((s) => s.refreshSession);
  const joinSession = useGameStore((s) => s.joinSession);
  const startQuestion = useGameStore((s) => s.startQuestion);
  const playerId = useGameStore((s) => s.playerId);
  const currentPlayerId = useGameStore((s) => s.currentPlayerId);
  const gameState = useGameStore((s) => s.gameState);
  const players = useGameStore((s) => s.players);
  const activeResponderId = useGameStore((s) => s.activeResponderId);
  const buzzOpen = useGameStore((s) => s.buzzOpen);
  const buzzReadyAt = useGameStore((s) => s.buzzReadyAt);
  const buzzWinnerId = useGameStore((s) => s.buzzWinnerId);
  const paidBuzzUsedIds = useGameStore((s) => s.paidBuzzUsedIds);
  const buzzIn = useGameStore((s) => s.buzzIn);
  const forfeitQuestion = useGameStore((s) => s.forfeitQuestion);

  const [selected, setSelected] = useState<number[]>(
    answerResult?.selectedIndices ?? []
  );
  const [syncing, setSyncing] = useState(false);
  const [buzzCountdown, setBuzzCountdown] = useState(0);
  const [buzzing, setBuzzing] = useState(false);
  const [buzzCountdownStarted, setBuzzCountdownStarted] = useState(false);
  const isTurnOwner = Boolean(playerId && currentPlayerId && playerId === currentPlayerId);
  const isResponder = Boolean(playerId && activeResponderId && playerId === activeResponderId);
  const canAnswer = gameState === "QUESTION_ACTIVE" && isResponder;
  const buzzReady = buzzOpen && buzzReadyAt !== null && buzzCountdown > 0 && !buzzWinnerId;
  const hasPaidBuzzed = Boolean(playerId && paidBuzzUsedIds?.includes(playerId));
  const isMyBuzzWinner = Boolean(playerId && buzzWinnerId === playerId);
  const responder = useMemo(
    () => players.find((p) => p.id === activeResponderId) || null,
    [players, activeResponderId]
  );
  const lastAnswerer = useMemo(
    () => (answerResult?.playerId ? players.find((p) => p.id === answerResult.playerId) : null),
    [players, answerResult]
  );
  const stake = useMemo(() => (question as any)?.stake ?? 100000, [question]);
  const myChips = useMemo(
    () => players.find((p) => p.id === playerId)?.chips ?? 0,
    [players, playerId]
  );
  const formatChips = (value: number) => `${(value / 10000).toLocaleString()} 萬`;
  const [autoEnded, setAutoEnded] = useState(false);
  const canFinishTurn = Boolean(
    answerResult && playerId && playerId === (answerResult.playerId || activeResponderId)
  );
  const typeLabel =
    question?.type === "multi" ? "複選" : question?.type === "boolean" ? "是非" : "單選";

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
    if (!question && isTurnOwner && gameState === "QUESTION_ACTIVE") {
      startQuestion().catch(() => {
        showToast("題目開始失敗，請再試一次");
      });
    }
  }, [question, isTurnOwner, gameState, startQuestion, showToast]);

  useEffect(() => {
    if (!question && gameState !== "QUESTION_ACTIVE") {
      router.replace("/play");
    }
  }, [question, gameState, router]);

  useEffect(() => {
    if (answerResult?.isCorrect) {
      setSelected(answerResult.selectedIndices);
    } else {
      setSelected([]);
    }
  }, [answerResult]);

  useEffect(() => {
    const tick = () => {
      if (!buzzReadyAt) {
        setBuzzCountdown(0);
        setBuzzCountdownStarted(false);
        return;
      }
      const ms = buzzReadyAt - Date.now();
      const next = ms > 0 ? Math.ceil(ms / 1000) : 0;
      if (next > 0) setBuzzCountdownStarted(true);
      setBuzzCountdown(next);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [buzzReadyAt]);

  useEffect(() => {
    if (buzzOpen) {
      setAutoEnded(false);
    }
  }, [buzzOpen, buzzReadyAt]);

  useEffect(() => {
    const maybeForfeit = async () => {
      if (
        buzzCountdownStarted &&
        buzzCountdown === 0 &&
        buzzOpen &&
        !buzzWinnerId &&
        !autoEnded &&
        gameState === "QUESTION_ACTIVE" &&
        buzzReadyAt &&
        Date.now() >= buzzReadyAt
      ) {
        setAutoEnded(true);
        await forfeitQuestion();
        router.push("/play");
      }
    };
    void maybeForfeit();
  }, [buzzCountdownStarted, buzzCountdown, buzzOpen, buzzWinnerId, autoEnded, forfeitQuestion, router, gameState, buzzReadyAt]);

  if (!question) {
    return (
      <main className="pt-10 space-y-4">
        <Toast />
        <div className="card p-6 space-y-3">
          <div className="text-xl font-semibold">尚未抽到題目</div>
          <p className="text-slate-600">
            請等待並重新同步題目，或嘗試重新抽題。
          </p>
          <div className="space-y-3">
            <Button
              variant="secondary"
              disabled={syncing}
              onClick={async () => {
                if (!sessionCode) return;
                setSyncing(true);
                await refreshSession(sessionCode);
                if (isTurnOwner && gameState === "QUESTION_ACTIVE") {
                  await startQuestion().catch(() =>
                    showToast("題目開始失敗，請再試一次")
                  );
                }
                setSyncing(false);
              }}
            >
              重新同步題目
            </Button>
            <Button onClick={() => router.push("/play")}>返回遊戲畫面</Button>
          </div>
        </div>
      </main>
    );
  }

  const handleSubmit = async () => {
    if (!canAnswer) {
      showToast("只有回答者可以送出答案");
      return;
    }
    if (answerResult?.isCorrect) {
      showToast("此題已經答對，請結束回合");
      return;
    }
    if (selected.length === 0) {
      showToast("請先選擇至少一個選項");
      return;
    }
    if (question?.type !== "multi" && selected.length > 1) {
      showToast("此題為單選，請只選一個選項");
      return;
    }
    await submitAnswer(selected);
  };

  const handleFinish = async () => {
    if (!canFinishTurn) {
      showToast(answerResult ? "請由搶答者結束回合" : "請先作答，再結束回合");
      return;
    }
    if (answerResult?.isCorrect) {
      await advanceTurn();
    } else {
      await forfeitQuestion();
    }
    router.push("/play");
  };

  return (
    <main className="pt-6 space-y-5">
      <Toast />
      <div className="text-sm font-semibold uppercase text-brand-accent tracking-wide">
        題目 / Question
      </div>
      <section className="card p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center rounded-full bg-brand-secondary/40 text-brand-accent px-3 py-1 font-semibold">
            {question.category}
          </span>
          <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-700 px-3 py-1 font-semibold">
            題目類型：{typeLabel}
          </span>
          <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-700 px-3 py-1 font-semibold">
            難度：{question.difficulty}
          </span>
        </div>
        <h1 className="text-2xl font-bold leading-9">{question.text}</h1>
        <div className="text-sm text-slate-600">
          題目籌碼：{formatChips(stake)}（付費搶答會先扣題目籌碼；搶答答對由原回答者支付 1 倍，搶答答錯再扣 1 倍）。
        </div>
        <div className="text-sm text-slate-600">我的籌碼：{formatChips(myChips)}</div>

        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
          <div className="font-semibold text-brand-accent">答題者</div>
          <div className="rounded-full bg-slate-100 px-3 py-1 font-semibold">
            {responder
              ? `P${responder.seatNumber} ${responder.name}`
              : "等待搶答 / 回合玩家"}
          </div>
          {buzzWinnerId && (
            <div className="rounded-full bg-emerald-100 text-emerald-700 px-3 py-1 text-xs font-semibold">
              已搶答
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
                ) : isMyBuzzWinner ? (
                  <Button variant="secondary" disabled className="h-12">
                    已搶答
                  </Button>
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
                    disabled={!buzzReady || !!buzzWinnerId || buzzing || hasPaidBuzzed || isMyBuzzWinner}
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
          <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="text-lg font-bold text-emerald-700">答對！</div>
            <div className="text-sm text-emerald-700">
              {lastAnswerer
                ? `P${lastAnswerer.seatNumber} ${lastAnswerer.name}`
                : "玩家"} 已答對，請按「回合結束」。
            </div>
          </div>
        )}

        <div className="space-y-3">
          {question.options.map((option, idx) => {
            const isSelected = selected.includes(idx);
            return (
              <button
                key={option}
                onClick={() => {
                  if (answerResult?.isCorrect) return;
                  if (question.type === "multi") {
                    setSelected((prev) =>
                      prev.includes(idx) ? prev.filter((v) => v !== idx) : [...prev, idx]
                    );
                  } else {
                    setSelected([idx]);
                  }
                }}
                className={`w-full text-left rounded-xl border px-4 py-3 text-lg font-semibold transition-colors ${
                  isSelected
                    ? "border-brand-primary bg-brand-primary/10 text-brand-accent"
                    : "border-slate-200 bg-white hover:border-brand-primary/60"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>

        <div className="flex gap-3">
          <Button onClick={handleSubmit} disabled={!canAnswer} className="whitespace-nowrap">
            {canAnswer ? "送出答案" : "等待回答者"}
          </Button>
          <Button variant="secondary" onClick={handleFinish} disabled={!canFinishTurn}>
            回合結束
          </Button>
        </div>
      </section>
    </main>
  );
}
