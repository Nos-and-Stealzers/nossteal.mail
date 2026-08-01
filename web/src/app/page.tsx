"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = window.localStorage.getItem("token");
    router.replace(token ? "/inbox" : "/login");
  }, [router]);

  return null;
}
