"use client";

import { useEffect, useState } from "react";
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

  const [selected, setSelected] = useState<number | null>(
    answerResult?.selectedIndex ?? null
  );
  const [syncing, setSyncing] = useState(false);
  const isMyTurn = Boolean(playerId && currentPlayerId && playerId === currentPlayerId);

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
    if (!question && isMyTurn && gameState === "QUESTION_ACTIVE") {
      startQuestion().catch(() => {
        showToast("抽題失敗，請再試一次");
      });
    }
  }, [question, isMyTurn, gameState, startQuestion, showToast]);

  if (!question) {
    return (
      <main className="pt-10 space-y-4">
        <Toast />
        <div className="card p-6 space-y-3">
          <div className="text-xl font-semibold">尚未抽到題目</div>
          <p className="text-slate-600">
            請返回並重新選擇答題格，或嘗試重新同步。
          </p>
          <div className="space-y-3">
            <Button
              variant="secondary"
              disabled={syncing}
              onClick={async () => {
                if (!sessionCode) return;
                setSyncing(true);
                await refreshSession(sessionCode);
                if (isMyTurn && gameState === "QUESTION_ACTIVE") {
                  await startQuestion().catch(() =>
                    showToast("抽題失敗，請再試一次")
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
    if (!isMyTurn) {
      showToast("請等待輪到你再作答");
      return;
    }
    if (selected === null) {
      showToast("請先選擇一個選項");
      return;
    }
    await submitAnswer(selected);
  };

  const handleFinish = async () => {
    if (!isMyTurn) {
      showToast("請等待輪到你再操作");
      return;
    }
    await advanceTurn({ showToast: "請把權杖交給下一位" });
    router.push("/play");
  };

  return (
    <main className="pt-6 space-y-5">
      <Toast />
      <div className="text-sm font-semibold uppercase text-brand-accent tracking-wide">
        題目 / Question
      </div>
      <section className="card p-6 space-y-4">
        <div className="text-xs inline-flex items-center rounded-full bg-brand-secondary/40 text-brand-accent px-3 py-1 font-semibold">
          {question.category}
        </div>
        <h1 className="text-2xl font-bold leading-9">{question.text}</h1>

        <div className="space-y-3">
          {question.options.map((option, idx) => {
            const isSelected = selected === idx;
            return (
              <button
                key={option}
                onClick={() => setSelected(idx)}
                className={`w-full text-left rounded-xl border px-4 py-4 text-lg font-semibold transition-colors ${
                  isSelected
                    ? "border-brand-primary bg-brand-primary/10 text-brand-accent"
                    : "border-slate-200 bg-white hover:border-brand-primary/60"
                }`}
                aria-pressed={isSelected}
              >
                {option}
              </button>
            );
          })}
        </div>

        {!answerResult && (
          <Button onClick={handleSubmit} className="h-14 text-xl">
            送出答案 Submit
          </Button>
        )}
      </section>

      {answerResult && (
        <section className="card p-6 space-y-4 border-2 border-brand-primary/40">
          <div className="text-3xl font-bold flex items-center gap-3">
            {answerResult.isCorrect ? "✅ 答對了" : "❌ 這題沒過"}
          </div>
          <div className="text-lg font-semibold">
            正確答案：{question.options[question.answerIndex]}
          </div>
          <div className="space-y-2 text-slate-700">
            <div>
              <div className="font-semibold text-brand-accent">為什麼？</div>
              <p className="leading-7">{question.explanation}</p>
            </div>
            <div>
              <div className="font-semibold text-brand-accent">防詐技巧</div>
              <p className="leading-7">{question.tip}</p>
            </div>
          </div>
          <Button onClick={handleFinish} className="h-14 text-xl">
            回合結束 / 交棒給下一位
          </Button>
        </section>
      )}
    </main>
  );
}
