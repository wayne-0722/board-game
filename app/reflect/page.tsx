"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../../components/ui/Button";
import { Toast } from "../../components/Toast";
import { useGameStore } from "../../src/store/gameStore";
import { mockQuestions } from "../../src/lib/questions";

export default function ReflectPage() {
  const router = useRouter();
  const sessionCode = useGameStore((s) => s.sessionCode);
  const wrongIds = useGameStore((s) => s.wrongQuestionIds);
  const refreshSession = useGameStore((s) => s.refreshSession);
  const joinSession = useGameStore((s) => s.joinSession);

  const wrongQuestions = useMemo(
    () => mockQuestions.filter((q) => wrongIds.includes(q.id)),
    [wrongIds]
  );

  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<{ isCorrect: boolean; selected: number | null } | null>(null);
  const [countdown, setCountdown] = useState(10);

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
  }, [sessionCode, refreshSession, joinSession, router]);

  useEffect(() => {
    setSelected(null);
    setResult(null);
    setCountdown(10);
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          setResult({ isCorrect: false, selected: null });
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [index]);

  if (wrongQuestions.length === 0) {
    return (
      <main className="pt-8 space-y-5">
        <Toast />
        <div className="text-xs font-semibold uppercase text-brand-accent tracking-wide">
          反思 / Review
        </div>
        <section className="card p-6 space-y-3">
          <div className="text-lg font-semibold">沒有錯題可以反思</div>
          <p className="text-slate-600">可以直接回主頁或重新開局。</p>
          <Button onClick={() => router.push("/")}>回到主頁</Button>
        </section>
      </main>
    );
  }

  const question = wrongQuestions[index];
  const handleSubmit = () => {
    if (result) return;
    if (selected === null) {
      useGameStore.getState().showToast("請先選擇一個選項");
      return;
    }
    const isCorrect = selected === question.answerIndex;
    setResult({ isCorrect, selected });
  };

  const handleNext = () => {
    if (index < wrongQuestions.length - 1) {
      setIndex((i) => i + 1);
    } else {
      router.push("/");
    }
  };

  return (
    <main className="pt-8 space-y-5">
      <Toast />
      <div className="text-xs font-semibold uppercase text-brand-accent tracking-wide">
        反思 / Review
      </div>
      <div className="text-sm text-slate-600">
        錯題 {index + 1} / {wrongQuestions.length} ・ 倒數 {result ? 0 : countdown} 秒
      </div>
      <section className="card p-6 space-y-4">
        <div className="text-xs inline-flex items-center rounded-full bg-brand-secondary/40 text-brand-accent px-3 py-1 font-semibold">
          {question.category}
        </div>
        <h1 className="text-2xl font-bold leading-9">{question.text}</h1>

        <div className="space-y-3">
          {question.options.map((option, idx) => {
            const isSelected = selected === idx;
            const isAnswer = result && idx === question.answerIndex;
            return (
              <button
                key={option}
                onClick={() => !result && setSelected(idx)}
                className={`w-full text-left rounded-xl border px-4 py-4 text-lg font-semibold transition-colors ${
                  isSelected
                    ? "border-brand-primary bg-brand-primary/10 text-brand-accent"
                    : "border-slate-200 bg-white hover:border-brand-primary/60"
                } ${result && isAnswer ? "border-emerald-500 bg-emerald-50" : ""}`}
                aria-pressed={isSelected}
                disabled={Boolean(result)}
              >
                {option}
              </button>
            );
          })}
        </div>

        {!result ? (
          <Button onClick={handleSubmit} className="h-14 text-xl">
            送出答案
          </Button>
        ) : (
          <section className="space-y-3 pt-3">
            <div className="text-2xl font-bold">
              {result.isCorrect ? "✅ 答對了" : "❌ 這題沒過"}
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
            <Button onClick={handleNext} className="h-14 text-xl">
              {index < wrongQuestions.length - 1 ? "下一題" : "完成 / 回到主頁"}
            </Button>
          </section>
        )}
      </section>
    </main>
  );
}
