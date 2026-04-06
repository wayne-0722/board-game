"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import splashImage from "../S__4063236.jpg";
import { Button } from "../components/ui/Button";
import { Toast } from "../components/Toast";
import { useGameStore } from "../src/store/gameStore";

export default function HomePage() {
  const router = useRouter();
  const savedCode = useGameStore((state) => state.sessionCode);
  const joinSession = useGameStore((state) => state.joinSession);
  const ensureRealtime = useGameStore((state) => state.ensureRealtime);
  const showToast = useGameStore((state) => state.showToast);
  const [inputCode, setInputCode] = useState("");
  const [showJoinPanel, setShowJoinPanel] = useState(false);

  const handleJoin = async () => {
    const playerName = useGameStore.getState().playerName;
    const trimmed = inputCode.trim();
    if (!/^\d{2}$/.test(trimmed)) {
      showToast("房號必須是 2 位數字");
      return;
    }

    try {
      await ensureRealtime();
      await joinSession(trimmed, playerName);
      router.push("/session");
    } catch (error: any) {
      showToast(error?.message || "加入房間失敗");
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
            alt="網站入口畫面"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <button
            type="button"
            aria-label="進入網站"
            onClick={() => setShowJoinPanel(true)}
            className="absolute left-1/2 top-[66.5%] h-[8.5dvh] min-h-14 w-[48vw] -translate-x-1/2 -translate-y-1/2 rounded-[999px] bg-transparent"
          />
        </main>
        <main className="hidden space-y-6 pt-10 md:block">
          <JoinPanel
            inputCode={inputCode}
            onInputCodeChange={setInputCode}
            onJoin={handleJoin}
            onResume={() => router.push("/session")}
            savedCode={savedCode}
          />
        </main>
      </>
    );
  }

  return (
    <main className="space-y-6 pt-10">
      <JoinPanel
        inputCode={inputCode}
        onInputCodeChange={setInputCode}
        onJoin={handleJoin}
        onResume={() => router.push("/session")}
        savedCode={savedCode}
      />
    </main>
  );
}

function JoinPanel({
  inputCode,
  onInputCodeChange,
  onJoin,
  onResume,
  savedCode
}: {
  inputCode: string;
  onInputCodeChange: (value: string) => void;
  onJoin: () => void;
  onResume: () => void;
  savedCode: string;
}) {
  return (
    <>
      <Toast />

      <section className="card overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-amber-500 p-6 text-white">
          <div className="text-sm font-semibold uppercase tracking-[0.25em]">Join Room</div>
          <h1 className="mt-3 text-3xl font-bold leading-tight">輸入房號後加入同一個遊戲房間</h1>
        </div>

        <div className="p-6">
          <div className="space-y-4">
            <label className="block space-y-2">
              <div className="text-base font-semibold text-slate-800">房號</div>
              <input
                value={inputCode}
                onChange={(event) => onInputCodeChange(event.target.value)}
                placeholder="例如 12"
                maxLength={2}
                inputMode="numeric"
                className="w-full rounded-2xl border border-slate-300 px-4 py-4 text-3xl font-bold tracking-[0.35em] text-slate-900 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-200"
              />
            </label>

            <Button onClick={onJoin} className="h-16 text-xl">
              加入房間
            </Button>

            {savedCode && (
              <Button variant="secondary" onClick={onResume} className="h-14">
                回到目前房間
              </Button>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
