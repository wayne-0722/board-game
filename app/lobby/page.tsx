"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LobbyRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/session");
  }, [router]);

  return null;
}
