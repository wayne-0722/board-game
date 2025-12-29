"use client";

import { useEffect } from "react";
import { useGameStore } from "../src/store/gameStore";

export const Toast = () => {
  const toast = useGameStore((s) => s.toast);
  const clearToast = useGameStore((s) => s.clearToast);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => clearToast(), 2600);
    return () => clearTimeout(id);
  }, [toast, clearToast]);

  if (!toast) return null;

  return (
    <div className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <div className="glass rounded-xl border border-brand-primary/30 bg-white px-4 py-3 text-center text-brand-accent shadow-lg">
        {toast}
      </div>
    </div>
  );
};
