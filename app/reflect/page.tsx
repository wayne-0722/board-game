"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../../components/ui/Button";
import { Toast } from "../../components/Toast";
import { useGameStore } from "../../src/store/gameStore";
import { mockQuestions } from "../../src/lib/questions";

type AnswerMap = Record<string, number[]>;

export default function ReflectPage() {
  const router = useRouter();
  const sessionCode = useGameStore((s) => s.sessionCode);
  const playerId = useGameStore((s) => s.playerId);
  const players = useGameStore((s) => s.players);
  const usedQuestionIds = useGameStore((s) => s.usedQuestionIds);
  const wrongQuestionIds = useGameStore((s) => s.wrongQuestionIds);
  const reflectionQuestionIds = useGameStore((s) => s.reflectionQuestionIds);
  const reflectionStats = useGameStore((s) => s.reflectionStats);
  const startReflection = useGameStore((s) => s.startReflection);
  const submitReflection = useGameStore((s) => s.submitReflection);
  const settleReflection = useGameStore((s) => s.settleReflection);
  const reflectionSettled = useGameStore((s) => s.reflectionSettled);
  const refreshSession = useGameStore((s) => s.refreshSession);
  const joinSession = useGameStore((s) => s.joinSession);
  const showToast = useGameStore((s) => s.showToast);

  const hasSubmitted = Boolean(reflectionStats[playerId]);

  const effectiveWrongIds = useMemo(() => {
    if (reflectionQuestionIds.length > 0) {
      return reflectionQuestionIds;
    }
    const usedSet = new Set(usedQuestionIds);
    const ids = wrongQuestionIds.filter((id) => usedSet.has(id));
    return Array.from(new Set(ids));
  }, [reflectionQuestionIds, wrongQuestionIds, usedQuestionIds]);

  const questions = useMemo(
    () => mockQuestions.filter((q) => effectiveWrongIds.includes(q.id)),
    [effectiveWrongIds]
  );
  const wrongKey = useMemo(() => effectiveWrongIds.join(","), [effectiveWrongIds]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [startTime, setStartTime] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [questionDeadline, setQuestionDeadline] = useState<number | null>(null);
  const expireHandledRef = useRef(false);
  const [decided, setDecided] = useState(() => hasSubmitted);
  const [skipped, setSkipped] = useState(false);
  const currentQuestion = questions[index] || null;

  useEffect(() => {
    if (hasSubmitted) {
      setDecided(true);
    }
  }, [hasSubmitted]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("skip") === "1") {
      setDecided(true);
      setSkipped(true);
    }
  }, []);

  useEffect(() => {
    if (!decided || hasSubmitted || skipped) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [decided, hasSubmitted, skipped]);

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
    if (!decided || hasSubmitted || skipped) return;
    setIndex(0);
    setAnswers({});
    setStartTime(Date.now());
    setNow(Date.now());
    setQuestionDeadline(Date.now() + 15000);
    expireHandledRef.current = false;
  }, [playerId, decided, hasSubmitted, wrongKey, skipped]);

  useEffect(() => {
    if (!decided || skipped || hasSubmitted) return;
    setStartTime(Date.now());
    setNow(Date.now());
    setQuestionDeadline(Date.now() + 15000);
    expireHandledRef.current = false;
  }, [decided, skipped, hasSubmitted]);

  useEffect(() => {
    if (!decided || hasSubmitted || skipped || !currentQuestion) return;
    setQuestionDeadline(Date.now() + 15000);
    expireHandledRef.current = false;
  }, [decided, currentQuestion, hasSubmitted, skipped]);

  useEffect(() => {
    if (!decided || skipped || hasSubmitted || questions.length === 0) return;
    void startReflection();
  }, [decided, skipped, hasSubmitted, questions.length, startReflection]);

  const handleSelect = (qid: string, choice: number) => {
    if (hasSubmitted) return;
    const questionType = currentQuestion?.type ?? "single";
    setAnswers((prev) => {
      const existing = prev[qid] || [];
      if (questionType === "multi") {
        const next = existing.includes(choice)
          ? existing.filter((v) => v !== choice)
          : [...existing, choice];
        return { ...prev, [qid]: next };
      }
      return { ...prev, [qid]: [choice] };
    });
  };

  const handleNext = () => {
    if (!currentQuestion) return;
    if (answers[currentQuestion.id] === undefined || answers[currentQuestion.id] === null) {
      showToast("請先選擇選項");
      return;
    }
    if (index < questions.length - 1) {
      setIndex((i) => i + 1);
    } else {
      finishAndSubmit();
    }
  };

  const finishAndSubmit = useCallback(async () => {
    if (hasSubmitted || submitting) return;
    expireHandledRef.current = true;
    setQuestionDeadline(null);
    const elapsed = Math.max(1, Math.round((Date.now() - startTime) / 1000));
    setSubmitting(true);
    await submitReflection({ answers, totalTime: elapsed });
    setSubmitting(false);
  }, [answers, hasSubmitted, startTime, submitReflection, submitting]);

  useEffect(() => {
    if (hasSubmitted || skipped || submitting) return;
    if (!questionDeadline) return;
    if (expireHandledRef.current) return;
    if (now >= questionDeadline) {
      expireHandledRef.current = true;
      if (index < questions.length - 1) {
        setIndex((i) => Math.min(i + 1, questions.length - 1));
      } else {
        finishAndSubmit();
      }
    }
  }, [now, questionDeadline, hasSubmitted, skipped, submitting, index, questions.length, finishAndSubmit]);

  const participantLeaderboard = useMemo(() => {
    return players
      .map((p) => ({
        player: p,
        totalTime: reflectionStats[p.id]?.totalTime ?? null,
        correctCount: reflectionStats[p.id]?.correctCount ?? null
      }))
      .filter((e) => e.correctCount !== null && e.totalTime !== null)
      .sort((a, b) => {
        if ((b.correctCount ?? 0) !== (a.correctCount ?? 0)) {
          return (b.correctCount ?? 0) - (a.correctCount ?? 0);
        }
        return (a.totalTime ?? Infinity) - (b.totalTime ?? Infinity);
      });
  }, [players, reflectionStats]);

  const nonParticipants = useMemo(
    () =>
      players
        .filter((p) => !reflectionStats[p.id])
        .sort((a, b) => b.chips - a.chips)
        .map((p) => ({
          player: p,
          totalTime: null,
          correctCount: null
        })),
    [players, reflectionStats]
  );

  const leaderboard = [...participantLeaderboard, ...nonParticipants];
  const hasParticipants = participantLeaderboard.length > 0;

  const elapsedSeconds = decided ? Math.max(0, Math.floor((now - startTime) / 1000)) : 0;
  const questionSeconds = decided && questionDeadline
    ? Math.max(0, Math.ceil((questionDeadline - now) / 1000))
    : 0;

  const formatWan = (value: number) => `${Math.floor(value / 10000).toLocaleString()} 萬`;

  return (
    <main className="pt-8 space-y-5">
      <Toast />
      <div className="text-xs font-semibold uppercase text-brand-accent tracking-wide">
        反思 / Review
      </div>
      <h1 className="text-2xl font-bold">反思測驗：前測錯題複盤</h1>
      <p className="text-slate-600">
        題目來自前測錯題，共 {questions.length} 題，每位玩家做相同題目。開始即計時，提交後依
        <span className="font-semibold"> 答對量、耗時 </span>
        排名，發放 50 萬 / 25 萬 / 10 萬。
      </p>

      {!decided ? (
        <section className="card p-6 space-y-4">
          <h2 className="text-xl font-semibold">要參加反思嗎？</h2>
          <p className="text-slate-700">
            反思使用本局的錯題。參加可依答對數、耗時排名發放獎勵；不參加則直接以籌碼數結算排名。
          </p>
          <div className="flex gap-3">
            <Button onClick={() => setDecided(true)}>參加反思</Button>
            <Button
              variant="ghost"
              onClick={() => {
                setDecided(true);
                setSkipped(true);
              }}
            >
              不參加，直接結算
            </Button>
          </div>
        </section>
      ) : hasSubmitted ? (
        <section className="card p-6 space-y-3">
          <div className="text-lg font-semibold">已送出答案</div>
          <div className="text-slate-700">答對：{reflectionStats[playerId]?.correctCount ?? 0} 題</div>
          <div className="text-slate-700">總耗時：{reflectionStats[playerId]?.totalTime ?? 0} 秒</div>
        </section>
      ) : !skipped && questions.length > 0 ? (
        <section className="card p-6 space-y-4">
          <div className="flex items-center justify-between text-sm text-slate-600">
            <div>
              進度：{index + 1} / {questions.length}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">已用時間：{elapsedSeconds} 秒</span>
              <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 px-3 py-1 font-semibold text-base shadow-sm">
                倒數：{questionSeconds}s
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center rounded-full bg-brand-secondary/40 text-brand-accent px-3 py-1 font-semibold">
                反思題
              </span>
              <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-700 px-3 py-1 font-semibold">
                題目類型：
                {currentQuestion?.type === "multi"
                  ? "複選"
                  : currentQuestion?.type === "boolean"
                  ? "是非"
                  : "單選"}
              </span>
              <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-700 px-3 py-1 font-semibold">
                難度：{currentQuestion?.difficulty ?? "未知"}
              </span>
            </div>
            <h2 className="text-xl font-bold leading-8">{currentQuestion?.text}</h2>
          </div>

          <div className="space-y-3">
            {currentQuestion?.options.map((opt, idx) => {
              const sel = answers[currentQuestion.id] || [];
              const isSelected = sel.includes(idx);
              return (
                <button
                  key={opt}
                  onClick={() => handleSelect(currentQuestion.id, idx)}
                  className={`w-full text-left rounded-xl border px-4 py-3 text-lg font-semibold transition-colors ${
                    isSelected
                      ? "border-brand-primary bg-brand-primary/10 text-brand-accent"
                      : "border-slate-200 bg-white hover:border-brand-primary/60"
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>

          <div className="flex gap-3">
            {index < questions.length - 1 ? (
              <Button onClick={handleNext}>下一題</Button>
            ) : (
              <Button onClick={finishAndSubmit} disabled={submitting}>
                {submitting ? "送出中..." : "完成並送出"}
              </Button>
            )}
          </div>
        </section>
      ) : null}

      <section className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">反思排行榜</h2>
          <div className="text-sm text-slate-600">獎勵 50 萬 / 25 萬 / 10 萬</div>
        </div>
        {leaderboard.length === 0 ? (
          <div className="text-slate-600">還沒有紀錄，請完成反思或直接結算。</div>
        ) : (
          <div className="divide-y rounded-xl border border-slate-200 bg-white">
            {leaderboard.map((entry, idx) => {
              const isParticipant = entry.correctCount !== null && entry.totalTime !== null;
              const prize = isParticipant ? [500000, 250000, 100000][idx] : null;
              return (
                <div
                  key={entry.player.id}
                  className="grid grid-cols-4 gap-2 px-4 py-3 text-sm items-center"
                >
                  <div className="font-semibold">
                    #{idx + 1} P{entry.player.seatNumber} {entry.player.name}
                  </div>
                  <div>{isParticipant ? `答對：${entry.correctCount}` : "未參加，籌碼結算"}</div>
                  <div>{isParticipant ? `總耗時：${entry.totalTime} 秒` : "--"}</div>
                  <div className="text-right space-y-1">
                    <div>籌碼：{formatWan(entry.player.chips)}</div>
                    <div className="text-brand-accent font-semibold">
                      {prize ? `獎勵：${Math.floor(prize / 10000)} 萬` : "--"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={() => {
              if (!hasParticipants) {
                showToast("尚無反思成績，無法派發獎勵");
                return;
              }
              void settleReflection();
            }}
            disabled={reflectionSettled || !hasParticipants}
          >
            {reflectionSettled ? "已派發獎勵" : "派發獎勵"}
          </Button>
          <Button variant="ghost" onClick={() => router.push("/")}>
            回到主畫面
          </Button>
        </div>
      </section>
    </main>
  );
}
