"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import splashImage from "../S__4063236.jpg";
import { Button } from "../components/ui/Button";
import { Toast } from "../components/Toast";
import { useGameStore } from "../src/store/gameStore";

const highlights = [
  { label: "Realtime sync", value: "Socket.IO rooms" },
  { label: "Event scale", value: "100-player session target" },
  { label: "Data model", value: "In-memory, Redis-ready" }
];

const flowSteps = ["Join room", "Sync turn", "Answer", "Buzz", "Score"];

const zh = {
  enterAria: "進入答題系統",
  invalidRoom: "請輸入 2 位數房號。",
  joinFailed: "加入房間失敗。",
  eyebrow: "加入房間",
  title: "輸入房號",
  description:
    "請輸入玩家名稱與 2 位數房號，手機瀏覽器即可參加。",
  playerName: "玩家名稱",
  playerPlaceholder: "玩家",
  roomCode: "房號",
  join: "加入房間",
  resume: "回到房間",
  back: "回到入口"
};

export default function HomePage() {
  const router = useRouter();
  const savedCode = useGameStore((state) => state.sessionCode);
  const joinSession = useGameStore((state) => state.joinSession);
  const ensureRealtime = useGameStore((state) => state.ensureRealtime);
  const showToast = useGameStore((state) => state.showToast);
  const setPlayerName = useGameStore((state) => state.setPlayerName);
  const savedName = useGameStore((state) => state.playerName);
  const [inputCode, setInputCode] = useState("");
  const [nameInput, setNameInput] = useState(savedName);
  const [showJoinPanel, setShowJoinPanel] = useState(false);

  const handleJoin = async (fallbackMessage: string) => {
    const trimmedCode = inputCode.trim();
    const trimmedName = nameInput.trim();

    if (!/^\d{2}$/.test(trimmedCode)) {
      showToast(zh.invalidRoom);
      return;
    }

    try {
      setPlayerName(trimmedName);
      await ensureRealtime();
      await joinSession(trimmedCode, trimmedName);
      router.push("/session");
    } catch (error: any) {
      showToast(error?.message || fallbackMessage);
    }
  };

  if (!showJoinPanel) {
    return (
      <>
        <main className="fixed inset-0 z-40 overflow-hidden bg-black md:hidden">
          <Toast />
          <Image
            src={splashImage}
            alt=""
            aria-hidden="true"
            fill
            priority
            sizes="100vw"
            className="scale-110 object-cover opacity-55 blur-2xl"
          />
          <Image
            src={splashImage}
            alt="Board game answer system entry screen"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <button
            type="button"
            aria-label={zh.enterAria}
            onClick={() => setShowJoinPanel(true)}
            className="absolute left-1/2 top-[66.5%] h-[8.5dvh] min-h-14 w-[48vw] -translate-x-1/2 -translate-y-1/2 rounded-[999px] bg-transparent"
          />
        </main>

        <DesktopPortfolio
          inputCode={inputCode}
          nameInput={nameInput}
          onInputCodeChange={setInputCode}
          onNameInputChange={setNameInput}
          onJoin={() => void handleJoin("Failed to join room.")}
          onResume={() => router.push("/session")}
          savedCode={savedCode}
        />
      </>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f7f2] px-5 py-6 md:hidden">
      <Toast />
      <MobileJoinPanel
        inputCode={inputCode}
        nameInput={nameInput}
        onInputCodeChange={setInputCode}
        onNameInputChange={setNameInput}
        onJoin={() => void handleJoin(zh.joinFailed)}
        onResume={() => router.push("/session")}
        onBack={() => setShowJoinPanel(false)}
        savedCode={savedCode}
      />
    </main>
  );
}

function DesktopPortfolio({
  inputCode,
  nameInput,
  onInputCodeChange,
  onNameInputChange,
  onJoin,
  onResume,
  savedCode
}: {
  inputCode: string;
  nameInput: string;
  onInputCodeChange: (value: string) => void;
  onNameInputChange: (value: string) => void;
  onJoin: () => void;
  onResume: () => void;
  savedCode: string;
}) {
  return (
    <main className="hidden min-h-screen overflow-hidden bg-[#f3efe2] text-slate-950 md:block">
      <Toast />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_16%,rgba(244,162,97,0.32),transparent_28%),radial-gradient(circle_at_82%_12%,rgba(14,124,123,0.24),transparent_30%),linear-gradient(135deg,#f7f7f2_0%,#eef5ed_58%,#f5e6c7_100%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-8 py-8">
        <header className="flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.36em] text-brand-primary">
              Portfolio Project
            </div>
            <h1 className="mt-2 text-2xl font-black tracking-tight">Board Game Answer System</h1>
          </div>
          <a
            href="https://board-game-oclb.onrender.com"
            className="rounded-full border border-brand-accent/30 bg-white/70 px-5 py-2 text-sm font-bold text-brand-accent shadow-sm backdrop-blur"
          >
            Live on Render
          </a>
        </header>

        <section className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="inline-flex rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white">
              Physical board game companion
            </div>
            <h2 className="mt-6 max-w-4xl text-6xl font-black leading-[0.95] tracking-[-0.055em] text-slate-950 xl:text-7xl">
              Realtime quiz, buzz-in and scoring for live tabletop events.
            </h2>
            <p className="mt-6 max-w-2xl text-xl leading-8 text-slate-700">
              A mobile-first web system that coordinates room entry, turn state, answer
              submission, wrong-answer buzz windows, reflection rounds and live scoring
              for a physical board-game activity.
            </p>

            <div className="mt-8 grid max-w-3xl grid-cols-3 gap-3">
              {highlights.map((item) => (
                <div key={item.label} className="rounded-3xl border border-white/80 bg-white/70 p-5 shadow-card backdrop-blur">
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-brand-primary">
                    {item.label}
                  </div>
                  <div className="mt-3 text-lg font-black text-slate-950">{item.value}</div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              {flowSteps.map((step, index) => (
                <div key={step} className="flex items-center gap-3 rounded-full bg-white/75 px-4 py-3 shadow-sm">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-primary text-sm font-black text-white">
                    {index + 1}
                  </span>
                  <span className="text-sm font-bold text-slate-800">{step}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-5">
            <div className="rounded-[2rem] border border-slate-950/10 bg-slate-950 p-5 text-white shadow-[0_30px_80px_rgba(15,23,42,0.25)]">
              <div className="rounded-[1.5rem] bg-[#f8f3e5] p-3">
                <div className="relative aspect-[9/16] overflow-hidden rounded-[1.2rem] bg-black">
                  <Image
                    src={splashImage}
                    alt="Mobile launch screen used by players"
                    fill
                    priority
                    sizes="360px"
                    className="object-cover"
                  />
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-white/10 p-4">
                  <div className="text-white/55">Client</div>
                  <div className="mt-1 font-bold">Next.js + Zustand</div>
                </div>
                <div className="rounded-2xl bg-white/10 p-4">
                  <div className="text-white/55">Server</div>
                  <div className="mt-1 font-bold">Node + Socket.IO</div>
                </div>
              </div>
            </div>

            <DesktopJoinCard
              inputCode={inputCode}
              nameInput={nameInput}
              onInputCodeChange={onInputCodeChange}
              onNameInputChange={onNameInputChange}
              onJoin={onJoin}
              onResume={onResume}
              savedCode={savedCode}
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function MobileJoinPanel({
  inputCode,
  nameInput,
  onInputCodeChange,
  onNameInputChange,
  onJoin,
  onResume,
  onBack,
  savedCode
}: {
  inputCode: string;
  nameInput: string;
  onInputCodeChange: (value: string) => void;
  onNameInputChange: (value: string) => void;
  onJoin: () => void;
  onResume: () => void;
  onBack: () => void;
  savedCode: string;
}) {
  return (
    <section className="mx-auto flex min-h-[calc(100dvh-3rem)] max-w-sm flex-col justify-center">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 self-start rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm"
      >
        {zh.back}
      </button>

      <div className="rounded-[1.6rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.14)]">
        <div className="text-sm font-bold tracking-[0.18em] text-brand-primary">{zh.eyebrow}</div>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">{zh.title}</h1>
        <p className="mt-3 text-base leading-7 text-slate-600">{zh.description}</p>

        <div className="mt-7 space-y-5">
          <label className="block space-y-2">
            <div className="text-base font-bold text-slate-800">{zh.playerName}</div>
            <input
              value={nameInput}
              onChange={(event) => onNameInputChange(event.target.value)}
              placeholder={zh.playerPlaceholder}
              maxLength={18}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-4 text-xl font-bold text-slate-950 outline-none focus:border-brand-primary focus:ring-4 focus:ring-emerald-100"
            />
          </label>

          <label className="block space-y-2">
            <div className="text-base font-bold text-slate-800">{zh.roomCode}</div>
            <input
              value={inputCode}
              onChange={(event) => onInputCodeChange(event.target.value.replace(/\D/g, "").slice(0, 2))}
              placeholder="12"
              maxLength={2}
              inputMode="numeric"
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-5 text-center text-5xl font-black tracking-[0.45em] text-slate-950 outline-none focus:border-brand-primary focus:ring-4 focus:ring-emerald-100"
            />
          </label>

          <Button onClick={onJoin} className="h-16 rounded-2xl text-xl font-black">
            {zh.join}
          </Button>

          {savedCode && (
            <Button variant="secondary" onClick={onResume} className="h-14 rounded-2xl">
              {zh.resume} {savedCode}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

function DesktopJoinCard({
  inputCode,
  nameInput,
  onInputCodeChange,
  onNameInputChange,
  onJoin,
  onResume,
  savedCode
}: {
  inputCode: string;
  nameInput: string;
  onInputCodeChange: (value: string) => void;
  onNameInputChange: (value: string) => void;
  onJoin: () => void;
  onResume: () => void;
  savedCode: string;
}) {
  return (
    <section className="mx-auto max-w-md overflow-hidden rounded-[2rem] border border-white/70 bg-white/90 shadow-[0_24px_70px_rgba(15,23,42,0.18)] backdrop-blur">
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-700 to-amber-500 p-6 text-white">
        <div className="text-sm font-bold uppercase tracking-[0.25em] text-white/75">Join Room</div>
        <h2 className="mt-3 text-3xl font-black leading-tight tracking-tight">
          Enter a live tabletop session.
        </h2>
        <p className="mt-3 text-sm leading-6 text-white/80">
          Use a two-digit room code. No app installation is required.
        </p>
      </div>

      <div className="space-y-4 p-6">
        <label className="block space-y-2">
          <div className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">Player name</div>
          <input
            value={nameInput}
            onChange={(event) => onNameInputChange(event.target.value)}
            placeholder="Player"
            maxLength={18}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-lg font-bold text-slate-900 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-200"
          />
        </label>

        <label className="block space-y-2">
          <div className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">Room code</div>
          <input
            value={inputCode}
            onChange={(event) => onInputCodeChange(event.target.value.replace(/\D/g, "").slice(0, 2))}
            placeholder="12"
            maxLength={2}
            inputMode="numeric"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-center text-4xl font-black tracking-[0.35em] text-slate-900 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-200"
          />
        </label>

        <Button onClick={onJoin} className="h-16 rounded-2xl text-xl font-black">
          Join Session
        </Button>

        {savedCode && (
          <Button variant="secondary" onClick={onResume} className="h-14 rounded-2xl">
            Resume Room {savedCode}
          </Button>
        )}
      </div>
    </section>
  );
}
