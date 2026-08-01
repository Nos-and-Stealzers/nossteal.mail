"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "./api";

export function useAuth() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = window.localStorage.getItem("user");
    const token = window.localStorage.getItem("token");
    if (raw && token) {
      setUser(JSON.parse(raw));
    } else {
      router.replace("/login");
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function logout() {
    window.localStorage.removeItem("token");
    window.localStorage.removeItem("user");
    router.replace("/login");
  }

  return { user, loading, logout };
}

export function persistSession(user: User, token: string) {
  window.localStorage.setItem("token", token);
  window.localStorage.setItem("user", JSON.stringify(user));
}
