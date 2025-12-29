"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../components/ui/Button";
import { Toast } from "../components/Toast";
import { useGameStore } from "../src/store/gameStore";

export default function HomePage() {
  const router = useRouter();
  const savedCode = useGameStore((s) => s.sessionCode);
  const joinSession = useGameStore((s) => s.joinSession);
  const showToast = useGameStore((s) => s.showToast);
  const [inputCode, setInputCode] = useState("");

  useEffect(() => {
    if (savedCode) {
      setInputCode(savedCode);
    }
  }, [savedCode]);

  const handleJoin = () => {
    const playerName = useGameStore.getState().playerName;
    const trimmed = inputCode.trim().toUpperCase();
    if (!/^[A-Z0-9]{6,8}$/.test(trimmed)) {
      showToast("請輸入 6~8 碼英數局碼");
      return;
    }
    joinSession(trimmed, playerName)
      .then(() => router.push("/lobby"))
      .catch((err) => showToast(err.message || "加入失敗"));
  };

  return (
    <main className="pt-10 space-y-6">
      <Toast />
      <div className="text-sm text-brand-accent font-semibold uppercase tracking-wide">
        短碼加入 / 防呆回合制
      </div>
      <h1 className="text-3xl font-bold leading-tight">加入本局</h1>
      <section className="card p-6 space-y-5">
        <label className="space-y-2 block">
          <div className="text-lg font-semibold">本局代碼 Session Code</div>
          <input
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value)}
            placeholder="輸入 6~8 碼英數"
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-xl tracking-[0.2em] uppercase focus:outline-none focus:ring-2 focus:ring-brand-primary"
            maxLength={8}
          />
          <p className="text-slate-500 text-sm">
            只需輸入一次，裝置會記住這一局。
          </p>
        </label>
        <div className="space-y-3">
          <Button onClick={handleJoin}>加入遊戲 Join</Button>
          {savedCode && (
            <Button
              variant="secondary"
              onClick={() => router.push("/lobby")}
              aria-label="繼續本局"
            >
              繼續本局
            </Button>
          )}
        </div>
      </section>
      <section className="p-4 rounded-xl border border-dashed border-brand-accent/40 bg-brand-surface">
        <div className="font-semibold text-brand-accent mb-1">小提醒</div>
        <p className="text-slate-600">
          不用掃描 QR、不需要登入，只要分享短碼，就能加入同一局並輪流答題。
        </p>
      </section>
    </main>
  );
}
