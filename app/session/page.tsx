"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Toast } from "../../components/Toast";
import { Button } from "../../components/ui/Button";
import { mockQuestions } from "../../src/lib/questions";
import { useGameStore } from "../../src/store/gameStore";

const formatChips = (value: number) =>
  `${Math.floor(value / 10000).toLocaleString()} 萬`;

const getTypeLabel = (type: "single" | "multi" | "boolean") => {
  if (type === "multi") return "複選";
  if (type === "boolean") return "是非";
  return "單選";
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
            <div className="text-sm text-slate-500">房號</div>
            <div className="text-2xl font-bold">
              {store.sessionCode || "未加入"}
            </div>
          </div>
          <div className="text-sm text-slate-600">
            連線狀態：{store.connectionStatus}
          </div>
        </div>
      </section>

      {store.currentView === "LOBBY" && (
        <section className="card space-y-4 p-6">
          <h1 className="text-2xl font-bold">等待室</h1>
          <input
            value={nameInput}
            onChange={(event) => setNameInput(event.target.value)}
            placeholder="輸入玩家名稱"
            className="w-full rounded-xl border border-slate-300 px-4 py-3"
          />
          <div className="grid gap-3 md:grid-cols-2">
            <Button
              onClick={async () => {
                if (!nameInput.trim()) {
                  store.showToast("請先輸入玩家名稱");
                  return;
                }
                store.setPlayerName(nameInput.trim());
                await store.confirmSeat();
              }}
            >
              確認入座
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
              開始遊戲
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
                  {player.confirmed ? "已就緒" : "未就緒"}
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
              ? `目前回合：${currentPlayer.name}`
              : "等待回合開始"}
          </h1>
          <div className="text-sm text-slate-600">
            你的籌碼：{formatChips(me?.chips ?? 0)}
          </div>

          {store.questionLock && store.currentQuestion ? (
            <div className="rounded-xl bg-emerald-50 p-4 text-emerald-800">
              題目已經開啟，請前往答題區。
            </div>
          ) : isTurnOwner ? (
            <div className="grid gap-3 md:grid-cols-2">
              <Button onClick={() => void store.startQuestion()}>
                開啟題目
              </Button>
              <Button
                variant="secondary"
                onClick={() => void store.advanceTurn()}
              >
                換下一位
              </Button>
            </div>
          ) : (
            <div className="rounded-xl bg-slate-50 p-4 text-slate-700">
              目前不是你的回合。
            </div>
          )}

          <Button variant="secondary" onClick={() => void store.voteEndGame()}>
            結束遊戲投票 ({store.endVotes.length}/{store.endThreshold})
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
              送出答案
            </Button>
            <Button
              variant="secondary"
              disabled={!isTurnOwner || Boolean(store.answerResult)}
              onClick={() => void store.forfeitQuestion()}
            >
              跳過這題
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
                  ? "答對了"
                  : "答錯了"}
              </div>
              {currentQuestion.explanation ? (
                <p className="mt-2 text-sm text-slate-700">
                  {currentQuestion.explanation}
                </p>
              ) : null}
              {store.buzzOpen ? (
                <p className="mt-2 text-sm text-slate-700">
                  已開啟搶答視窗，請等待結果。
                </p>
              ) : null}
              {canAdvanceAfterAnswer ? (
                <div className="mt-3">
                  <Button
                    variant="secondary"
                    onClick={() =>
                      void store.advanceTurn({
                        showToast: "已切換到下一位"
                      })
                    }
                  >
                    換下一位
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
            <div>
              回合玩家：
              {currentPlayer ? currentPlayer.name : "未指定"}
            </div>
            <div>
              作答控制：
              {currentResponder ? currentResponder.name : "待指定"}
            </div>
          </div>
        </section>
      )}

      {store.currentView === "REFLECT" && (
        <section className="card space-y-4 p-6">
          <h1 className="text-2xl font-bold">反思結算</h1>

          {!store.hasStartedReflection &&
          !store.hasDeclinedReflection &&
          !store.reflectionStats[store.playerId] ? (
            <div className="grid gap-3 md:grid-cols-2">
              <Button onClick={() => void store.startReflection()}>
                開始反思
              </Button>
              <Button variant="secondary" onClick={() => void store.skipReflection()}>
                略過反思
              </Button>
            </div>
          ) : null}

          {!store.reflectionStats[store.playerId] && reflectionQuestion ? (
            <>
              <div className="text-sm text-slate-600">
                題目 {reflectionIndex + 1} / {reflectionQuestions.length}
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
                  上一題
                </Button>
                {reflectionIndex < reflectionQuestions.length - 1 ? (
                  <Button
                    onClick={() =>
                      setReflectionIndex((value) =>
                        Math.min(reflectionQuestions.length - 1, value + 1)
                      )
                    }
                  >
                    下一題
                  </Button>
                ) : (
                  <Button
                    onClick={() => void store.submitReflection({ answers: reflectionAnswers })}
                  >
                    送出反思
                  </Button>
                )}
              </div>
            </>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            {!store.reflectionSettled ? (
              <Button onClick={() => void store.settleReflection()}>
                結算反思
              </Button>
            ) : null}
            {store.reflectionSettled ? (
              <Button
                variant="secondary"
                disabled={store.reflectionExitVotes.includes(store.playerId)}
                onClick={() => void store.confirmReflectionExit()}
              >
                確認離開 ({store.reflectionExitVotes.length}/
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
                <span>{entry.correctCount} 題</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {!["LOBBY", "PLAY", "QUESTION", "REFLECT"].includes(store.currentView) ? (
        <section className="card p-6 text-slate-700">
          正在載入遊戲狀態...
        </section>
      ) : null}

      {store.currentView === "QUESTION" && store.buzzOpen ? (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="pointer-events-auto w-full max-w-sm rounded-[2rem] border border-rose-200 bg-white p-6 text-center shadow-[0_30px_80px_rgba(15,23,42,0.35)]">
            <div className="text-sm font-semibold uppercase tracking-[0.25em] text-rose-500">
              Buzz
            </div>
            <div className="mt-3 text-4xl font-black text-rose-700">
              搶答開啟
            </div>
            <div className="mt-3 text-base text-slate-700">
              剩餘{" "}
              <span className="text-3xl font-black text-slate-950">
                {buzzCountdown}
              </span>{" "}
              秒
            </div>
            <p className="mt-3 text-sm text-slate-500">
              搶答視窗為 10 秒，搶答成功後可獲得作答權。
            </p>

            {isOriginalWrongResponder ? (
              <div className="mt-5 rounded-2xl bg-slate-100 px-4 py-4 text-sm text-slate-600">
                你是前一位答錯的玩家，不能參與這次搶答。
              </div>
            ) : store.buzzWinnerId === store.playerId ? (
              <div className="mt-5 rounded-2xl bg-emerald-50 px-4 py-4 text-sm font-semibold text-emerald-700">
                你已搶答成功，請準備作答。
              </div>
            ) : store.paidBuzzUsedIds.includes(store.playerId) ? (
              <div className="mt-5 rounded-2xl bg-slate-100 px-4 py-4 text-sm text-slate-600">
                你已使用過本題的搶答機會。
              </div>
            ) : (
              <div className="mt-5">
                <Button
                  variant="secondary"
                  className="mx-auto h-16 max-w-xs text-2xl"
                  disabled={!canBuzz}
                  onClick={() => void store.buzzIn()}
                >
                  我要搶答
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}
