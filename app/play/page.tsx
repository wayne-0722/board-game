"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PlayRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/session");
  }, [router]);

  return null;
}
