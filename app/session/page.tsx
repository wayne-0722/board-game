"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Toast } from "../../components/Toast";
import { Button } from "../../components/ui/Button";
import { mockQuestions } from "../../src/lib/questions";
import { useGameStore } from "../../src/store/gameStore";

const formatChips = (value: number) =>
  `${Math.floor(value / 10000).toLocaleString()} \u842c`;

const getTypeLabel = (type: "single" | "multi" | "boolean") => {
  if (type === "multi") return "\u8907\u9078";
  if (type === "boolean") return "\u662f\u975e";
  return "\u55ae\u9078";
};

export default function SessionPage() {
  const router = useRouter();
  const store = useGameStore();
  const sessionCode = store.sessionCode;
  const ensureRealtime = store.ensureRealtime;
  const reflectionQuestionKey = store.reflectionQuestionIds.join(",");
  const [nameInput, setNameInput] = useState(store.playerName);
  const [selectedAnswer, setSelectedAnswer] = useState<number[]>([]);
  const [reflectionAnswers, setReflectionAnswers] = useState<Record<string, number[]>>({});
  const [reflectionIndex, setReflectionIndex] = useState(0);
  const [buzzCountdown, setBuzzCountdown] = useState(0);

  useEffect(() => setNameInput(store.playerName), [store.playerName]);
  useEffect(
    () => setSelectedAnswer(store.answerResult?.selectedIndices ?? []),
    [store.answerResult, store.currentQuestion?.id]
  );
  useEffect(() => setReflectionIndex(0), [reflectionQuestionKey]);

  useEffect(() => {
    if (!sessionCode) {
      router.replace("/");
      return;
    }
    void ensureRealtime();
  }, [ensureRealtime, router, sessionCode]);

  useEffect(() => {
    const tick = () => {
      if (!store.buzzReadyAt) {
        setBuzzCountdown(0);
        return;
      }
      const ms = store.buzzReadyAt - Date.now();
      setBuzzCountdown(ms > 0 ? Math.ceil(ms / 1000) : 0);
    };

    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [store.buzzReadyAt]);

  const me = store.players.find((player) => player.id === store.playerId) || null;
  const currentPlayer =
    store.players.find((player) => player.id === store.currentPlayerId) || null;
  const currentResponder =
    store.players.find(
      (player) => player.id === (store.activeResponderId || store.buzzWinnerId)
    ) || null;

  const isTurnOwner = Boolean(store.playerId && store.playerId === store.currentPlayerId);
  const isResponder = Boolean(
    store.playerId &&
      (store.playerId === store.activeResponderId ||
        store.playerId === store.buzzWinnerId)
  );
  const isOriginalWrongResponder = Boolean(
    store.playerId &&
      store.answerResult &&
      !store.answerResult.isCorrect &&
      store.answerResult.playerId === store.playerId &&
      store.buzzOpen
  );
  const canBuzz =
    store.buzzOpen &&
    !isOriginalWrongResponder &&
    !store.paidBuzzUsedIds.includes(store.playerId) &&
    store.buzzWinnerId !== store.playerId;
  const canAdvanceAfterAnswer = Boolean(
    store.answerResult &&
      store.answerResult.playerId === store.playerId &&
      !store.buzzOpen
  );

  const reflectionIds = store.reflectionQuestionIds.length
    ? store.reflectionQuestionIds
    : Array.from(
        new Set(
          store.wrongQuestionIds.filter((id) => store.usedQuestionIds.includes(id))
        )
      );
  const reflectionQuestions = mockQuestions.filter((question) =>
    reflectionIds.includes(question.id)
  );
  const reflectionQuestion = reflectionQuestions[reflectionIndex] || null;
  const currentQuestion = store.currentQuestion;

  const ranking = useMemo(
    () => [...store.players].sort((a, b) => b.chips - a.chips),
    [store.players]
  );
  const reflectionRanking = useMemo(
    () => {
      const sorted = store.players
        .filter((player) => store.reflectionStats[player.id])
        .map((player) => ({ player, ...store.reflectionStats[player.id] }))
        .sort(
          (a, b) =>
            b.correctCount - a.correctCount ||
            a.player.seatNumber - b.player.seatNumber
        );

      let previousCorrectCount: number | null = null;
      let previousRank = 0;

      return sorted.map((entry, index) => {
        const rank =
          previousCorrectCount === entry.correctCount ? previousRank : index + 1;
        previousCorrectCount = entry.correctCount;
        previousRank = rank;
        return { ...entry, rank };
      });
    },
    [store.players, store.reflectionStats]
  );

  const toggleChoice = (
    questionId: string,
    type: "single" | "multi" | "boolean",
    index: number,
    reflection = false
  ) => {
    if (reflection) {
      setReflectionAnswers((prev) => {
        const current = prev[questionId] || [];
        const next =
          type === "single" || type === "boolean"
            ? [index]
            : current.includes(index)
              ? current.filter((value) => value !== index)
              : [...current, index].sort();
        return { ...prev, [questionId]: next };
      });
      return;
    }

    if (!isResponder || store.answerResult) return;

    setSelectedAnswer((prev) =>
      type === "single" || type === "boolean"
        ? [index]
        : prev.includes(index)
          ? prev.filter((value) => value !== index)
          : [...prev, index].sort()
    );
  };

  return (
    <main className="mx-auto min-h-screen max-w-6xl space-y-6 px-4 py-6 md:px-6">
      <Toast />

      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm text-slate-500">\u623f\u865f</div>
            <div className="text-2xl font-bold">
              {store.sessionCode || "\u672a\u52a0\u5165"}
            </div>
          </div>
          <div className="text-sm text-slate-600">
            \u9023\u7dda\u72c0\u614b\uff1a{store.connectionStatus}
          </div>
        </div>
      </section>

      {store.currentView === "LOBBY" && (
        <section className="card space-y-4 p-6">
          <h1 className="text-2xl font-bold">\u7b49\u5f85\u5ba4</h1>
          <input
            value={nameInput}
            onChange={(event) => setNameInput(event.target.value)}
            placeholder="\u8f38\u5165\u73a9\u5bb6\u540d\u7a31"
            className="w-full rounded-xl border border-slate-300 px-4 py-3"
          />
          <div className="grid gap-3 md:grid-cols-2">
            <Button
              onClick={async () => {
                if (!nameInput.trim()) {
                  store.showToast("\u8acb\u5148\u8f38\u5165\u73a9\u5bb6\u540d\u7a31");
                  return;
                }
                store.setPlayerName(nameInput.trim());
                await store.confirmSeat();
              }}
            >
              \u78ba\u8a8d\u5165\u5ea7
            </Button>
            <Button
              variant="secondary"
              disabled={
                !(
                  store.players.length >= 2 &&
                  store.players.every((player) => player.confirmed)
                )
              }
              onClick={() => void store.startGame()}
            >
              \u958b\u59cb\u904a\u6232
            </Button>
          </div>
          <div className="space-y-2">
            {store.players.map((player) => (
              <div
                key={player.id}
                className="flex justify-between rounded-xl border border-slate-200 px-4 py-3"
              >
                <span>
                  P{player.seatNumber} {player.name}
                </span>
                <span>
                  {player.confirmed ? "\u5df2\u5c31\u7dd2" : "\u672a\u5c31\u7dd2"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {store.currentView === "PLAY" && (
        <section className="card space-y-4 p-6">
          <h1 className="text-2xl font-bold">
            {currentPlayer
              ? `\u76ee\u524d\u56de\u5408\uff1a${currentPlayer.name}`
              : "\u7b49\u5f85\u56de\u5408\u958b\u59cb"}
          </h1>
          <div className="text-sm text-slate-600">
            \u4f60\u7684\u7c4c\u78bc\uff1a{formatChips(me?.chips ?? 0)}
          </div>

          {store.questionLock && store.currentQuestion ? (
            <div className="rounded-xl bg-emerald-50 p-4 text-emerald-800">
              \u984c\u76ee\u5df2\u7d93\u958b\u555f\uff0c\u8acb\u524d\u5f80\u7b54\u984c\u5340\u3002
            </div>
          ) : isTurnOwner ? (
            <div className="grid gap-3 md:grid-cols-2">
              <Button onClick={() => void store.startQuestion()}>
                \u958b\u555f\u984c\u76ee
              </Button>
              <Button
                variant="secondary"
                onClick={() => void store.advanceTurn()}
              >
                \u63db\u4e0b\u4e00\u4f4d
              </Button>
            </div>
          ) : (
            <div className="rounded-xl bg-slate-50 p-4 text-slate-700">
              \u76ee\u524d\u4e0d\u662f\u4f60\u7684\u56de\u5408\u3002
            </div>
          )}

          <Button variant="secondary" onClick={() => void store.voteEndGame()}>
            \u7d50\u675f\u904a\u6232\u6295\u7968 ({store.endVotes.length}/{store.endThreshold})
          </Button>

          <div className="space-y-2">
            {ranking.map((player, index) => (
              <div
                key={player.id}
                className="flex justify-between rounded-xl border border-slate-200 px-4 py-3"
              >
                <span>
                  #{index + 1} P{player.seatNumber} {player.name}
                </span>
                <span>{formatChips(player.chips)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {store.currentView === "QUESTION" && currentQuestion && (
        <section className="card space-y-4 p-6">
          <div className="flex flex-wrap gap-3 text-sm text-slate-600">
            <span>{getTypeLabel(currentQuestion.type)}</span>
            <span>{currentQuestion.difficulty}</span>
            <span>{formatChips(currentQuestion.stake ?? 0)}</span>
          </div>
          <h1 className="text-2xl font-bold">{currentQuestion.text}</h1>

          <div className="space-y-3">
            {currentQuestion.options.map((option, index) => (
              <button
                key={`${currentQuestion.id}-${index}`}
                type="button"
                onClick={() =>
                  toggleChoice(
                    currentQuestion.id,
                    currentQuestion.type,
                    index
                  )
                }
                disabled={!isResponder || Boolean(store.answerResult)}
                className={`w-full rounded-xl border px-4 py-3 text-left ${
                  selectedAnswer.includes(index)
                    ? "border-emerald-600 bg-emerald-50"
                    : "border-slate-200 bg-white"
                }`}
              >
                {index + 1}. {option}
              </button>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Button
              disabled={
                !isResponder || !selectedAnswer.length || Boolean(store.answerResult)
              }
              onClick={() => void store.submitAnswer(selectedAnswer)}
            >
              \u9001\u51fa\u7b54\u6848
            </Button>
            <Button
              variant="secondary"
              disabled={!isTurnOwner || Boolean(store.answerResult)}
              onClick={() => void store.forfeitQuestion()}
            >
              \u8df3\u904e\u9019\u984c
            </Button>
          </div>

          {store.answerResult ? (
            <div
              className={`rounded-xl p-4 ${
                store.answerResult.isCorrect
                  ? "bg-emerald-50 text-emerald-800"
                  : "bg-rose-50 text-rose-800"
              }`}
            >
              <div className="text-xl font-bold">
                {store.answerResult.isCorrect
                  ? "\u7b54\u5c0d\u4e86"
                  : "\u7b54\u932f\u4e86"}
              </div>
              {currentQuestion.explanation ? (
                <p className="mt-2 text-sm text-slate-700">
                  {currentQuestion.explanation}
                </p>
              ) : null}
              {store.buzzOpen ? (
                <p className="mt-2 text-sm text-slate-700">
                  \u5df2\u958b\u555f\u640d\u7b54\u8996\u7a97\uff0c\u8acb\u7b49\u5f85\u7d50\u679c\u3002
                </p>
              ) : null}
              {canAdvanceAfterAnswer ? (
                <div className="mt-3">
                  <Button
                    variant="secondary"
                    onClick={() =>
                      void store.advanceTurn({
                        showToast: "\u5df2\u5207\u63db\u5230\u4e0b\u4e00\u4f4d"
                      })
                    }
                  >
                    \u63db\u4e0b\u4e00\u4f4d
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
            <div>
              \u56de\u5408\u73a9\u5bb6\uff1a
              {currentPlayer ? currentPlayer.name : "\u672a\u6307\u5b9a"}
            </div>
            <div>
              \u4f5c\u7b54\u63a7\u5236\uff1a
              {currentResponder ? currentResponder.name : "\u5f85\u6307\u5b9a"}
            </div>
          </div>
        </section>
      )}

      {store.currentView === "REFLECT" && (
        <section className="card space-y-4 p-6">
          <h1 className="text-2xl font-bold">\u53cd\u601d\u7d50\u7b97</h1>

          {!store.hasStartedReflection &&
          !store.hasDeclinedReflection &&
          !store.reflectionStats[store.playerId] ? (
            <div className="grid gap-3 md:grid-cols-2">
              <Button onClick={() => void store.startReflection()}>
                \u958b\u59cb\u53cd\u601d
              </Button>
              <Button variant="secondary" onClick={() => void store.skipReflection()}>
                \u7565\u904e\u53cd\u601d
              </Button>
            </div>
          ) : null}

          {!store.reflectionStats[store.playerId] && reflectionQuestion ? (
            <>
              <div className="text-sm text-slate-600">
                \u984c\u76ee {reflectionIndex + 1} / {reflectionQuestions.length}
              </div>
              <h2 className="text-xl font-semibold">{reflectionQuestion.text}</h2>
              <div className="space-y-3">
                {reflectionQuestion.options.map((option, index) => (
                  <button
                    key={`${reflectionQuestion.id}-${index}`}
                    type="button"
                    onClick={() =>
                      toggleChoice(reflectionQuestion.id, reflectionQuestion.type, index, true)
                    }
                    className={`w-full rounded-xl border px-4 py-3 text-left ${
                      (reflectionAnswers[reflectionQuestion.id] || []).includes(index)
                        ? "border-sky-600 bg-sky-50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    {index + 1}. {option}
                  </button>
                ))}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Button
                  variant="secondary"
                  disabled={reflectionIndex === 0}
                  onClick={() => setReflectionIndex((value) => Math.max(0, value - 1))}
                >
                  \u4e0a\u4e00\u984c
                </Button>
                {reflectionIndex < reflectionQuestions.length - 1 ? (
                  <Button
                    onClick={() =>
                      setReflectionIndex((value) =>
                        Math.min(reflectionQuestions.length - 1, value + 1)
                      )
                    }
                  >
                    \u4e0b\u4e00\u984c
                  </Button>
                ) : (
                  <Button
                    onClick={() => void store.submitReflection({ answers: reflectionAnswers })}
                  >
                    \u9001\u51fa\u53cd\u601d
                  </Button>
                )}
              </div>
            </>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            {!store.reflectionSettled ? (
              <Button onClick={() => void store.settleReflection()}>
                \u7d50\u7b97\u53cd\u601d
              </Button>
            ) : null}
            {store.reflectionSettled ? (
              <Button
                variant="secondary"
                disabled={store.reflectionExitVotes.includes(store.playerId)}
                onClick={() => void store.confirmReflectionExit()}
              >
                \u78ba\u8a8d\u96e2\u958b ({store.reflectionExitVotes.length}/
                {store.reflectionExitThreshold})
              </Button>
            ) : null}
          </div>

          <div className="space-y-2">
            {reflectionRanking.map((entry, index) => (
              <div
                key={entry.player.id}
                className="flex justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm"
              >
                <span>
                  #{entry.rank} {entry.player.name}
                </span>
                <span>{entry.correctCount} \u984c</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {!["LOBBY", "PLAY", "QUESTION", "REFLECT"].includes(store.currentView) ? (
        <section className="card p-6 text-slate-700">
          \u6b63\u5728\u8f09\u5165\u904a\u6232\u72c0\u614b...
        </section>
      ) : null}

      {store.currentView === "QUESTION" && store.buzzOpen ? (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="pointer-events-auto w-full max-w-sm rounded-[2rem] border border-rose-200 bg-white p-6 text-center shadow-[0_30px_80px_rgba(15,23,42,0.35)]">
            <div className="text-sm font-semibold uppercase tracking-[0.25em] text-rose-500">
              Buzz
            </div>
            <div className="mt-3 text-4xl font-black text-rose-700">
              \u640d\u7b54\u958b\u555f
            </div>
            <div className="mt-3 text-base text-slate-700">
              \u5269\u9918{" "}
              <span className="text-3xl font-black text-slate-950">
                {buzzCountdown}
              </span>{" "}
              \u79d2
            </div>
            <p className="mt-3 text-sm text-slate-500">
              \u640d\u7b54\u8996\u7a97\u70ba 10 \u79d2\uff0c\u640d\u7b54\u6210\u529f\u5f8c\u53ef\u7372\u5f97\u4f5c\u7b54\u6b0a\u3002
            </p>

            {isOriginalWrongResponder ? (
              <div className="mt-5 rounded-2xl bg-slate-100 px-4 py-4 text-sm text-slate-600">
                \u4f60\u662f\u524d\u4e00\u4f4d\u7b54\u932f\u7684\u73a9\u5bb6\uff0c\u4e0d\u80fd\u53c3\u8207\u9019\u6b21\u640d\u7b54\u3002
              </div>
            ) : store.buzzWinnerId === store.playerId ? (
              <div className="mt-5 rounded-2xl bg-emerald-50 px-4 py-4 text-sm font-semibold text-emerald-700">
                \u4f60\u5df2\u640d\u7b54\u6210\u529f\uff0c\u8acb\u6e96\u5099\u4f5c\u7b54\u3002
              </div>
            ) : store.paidBuzzUsedIds.includes(store.playerId) ? (
              <div className="mt-5 rounded-2xl bg-slate-100 px-4 py-4 text-sm text-slate-600">
                \u4f60\u5df2\u4f7f\u7528\u904e\u672c\u984c\u7684\u640d\u7b54\u6a5f\u6703\u3002
              </div>
            ) : (
              <div className="mt-5">
                <Button
                  variant="secondary"
                  className="mx-auto h-16 max-w-xs text-2xl"
                  disabled={!canBuzz}
                  onClick={() => void store.buzzIn()}
                >
                  \u6211\u8981\u640d\u7b54
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}
