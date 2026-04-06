"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ReflectRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/session");
  }, [router]);

  return null;
}
